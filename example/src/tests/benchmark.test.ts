import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB, withAppender, streamChunks } from 'react-native-duckdb'

const ROW_COUNT = 10_000
const BATCH_SIZE = 1_000
const STREAM_ROW_COUNT = 200_000

function generateRow(i: number): [number, string, number, boolean] {
  return [i, `row_${i}`, i * 1.1, i % 2 === 0]
}

function populateTable(db: ReturnType<typeof HybridDuckDB.open>, table: string, count: number) {
  return withAppender(db, table, (appender) => {
    for (let offset = 0; offset < count; offset += BATCH_SIZE) {
      const end = Math.min(offset + BATCH_SIZE, count)
      const batch: [number, string, number, boolean][] = []
      for (let i = offset; i < end; i++) {
        batch.push(generateRow(i))
      }
      appender.appendRows(batch)
    }
  })
}

// Verify row content at specific positions — not just count
function verifyContent(
  db: ReturnType<typeof HybridDuckDB.open>,
  table: string,
  totalRows: number,
  label: string
) {
  const count = Number(db.executeSync(`SELECT count(*) as cnt FROM ${table}`).toRows()[0].cnt)
  if (count !== totalRows) throw new Error(`${label}: expected ${totalRows} rows, got ${count}`)

  // Check first row
  const first = db.executeSync(`SELECT * FROM ${table} WHERE id = 0`).toRows()
  if (first.length !== 1) throw new Error(`${label}: first row missing`)
  if (first[0].name !== 'row_0') throw new Error(`${label}: first row name=${first[0].name}, expected row_0`)
  if (first[0].flag !== true) throw new Error(`${label}: first row flag=${first[0].flag}, expected true`)

  // Check last row
  const lastId = totalRows - 1
  const last = db.executeSync(`SELECT * FROM ${table} WHERE id = ?`, [lastId]).toRows()
  if (last.length !== 1) throw new Error(`${label}: last row missing (id=${lastId})`)
  if (last[0].name !== `row_${lastId}`) throw new Error(`${label}: last row name=${last[0].name}, expected row_${lastId}`)

  // Check middle row
  const midId = Math.floor(totalRows / 2)
  const mid = db.executeSync(`SELECT * FROM ${table} WHERE id = ?`, [midId]).toRows()
  if (mid.length !== 1) throw new Error(`${label}: mid row missing (id=${midId})`)
  if (mid[0].name !== `row_${midId}`) throw new Error(`${label}: mid row name=${mid[0].name}, expected row_${midId}`)
  const expectedVal = midId * 1.1
  if (Math.abs((mid[0].value as number) - expectedVal) > 0.01) {
    throw new Error(`${label}: mid row value=${mid[0].value}, expected ~${expectedVal}`)
  }

  // Checksum: verify min/max id range covers expected span
  const minMax = db.executeSync(`SELECT min(id) as lo, max(id) as hi FROM ${table}`).toRows()[0]
  const lo = Number(minMax.lo)
  const hi = Number(minMax.hi)
  if (lo !== 0) throw new Error(`${label}: min id=${lo}, expected 0`)
  if (hi !== totalRows - 1) throw new Error(`${label}: max id=${hi}, expected ${totalRows - 1}`)
}

TestRegistry.registerTest('Benchmarks', 'Row-by-row: appendRow vs INSERT — 10K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // --- INSERT one-by-one (sync) ---
    db.executeSync('CREATE TABLE bench_ins (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insStart = Date.now()
    for (let i = 0; i < ROW_COUNT; i++) {
      db.executeSync('INSERT INTO bench_ins VALUES (?, ?, ?, ?)', [
        i, `row_${i}`, i * 1.1, i % 2 === 0,
      ])
    }
    const insSyncMs = Date.now() - insStart
    verifyContent(db, 'bench_ins', ROW_COUNT, 'INSERT sync')

    // --- INSERT one-by-one (async) ---
    db.executeSync('DROP TABLE bench_ins')
    db.executeSync('CREATE TABLE bench_ins_async (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insAsyncStart = Date.now()
    for (let i = 0; i < ROW_COUNT; i++) {
      await db.execute('INSERT INTO bench_ins_async VALUES (?, ?, ?, ?)', [
        i, `row_${i}`, i * 1.1, i % 2 === 0,
      ])
    }
    const insAsyncMs = Date.now() - insAsyncStart
    verifyContent(db, 'bench_ins_async', ROW_COUNT, 'INSERT async')

    // --- appendRow one-by-one ---
    db.executeSync('DROP TABLE bench_ins_async')
    db.executeSync('CREATE TABLE bench_app (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const appStart = Date.now()
    await withAppender(db, 'bench_app', (appender) => {
      for (let i = 0; i < ROW_COUNT; i++) {
        appender.appendRow([i, `row_${i}`, i * 1.1, i % 2 === 0])
      }
    })
    const appMs = Date.now() - appStart
    verifyContent(db, 'bench_app', ROW_COUNT, 'appendRow')

    const syncSpeedup = insSyncMs / Math.max(appMs, 1)
    const asyncSpeedup = insAsyncMs / Math.max(appMs, 1)
    console.debug(`=== Row-by-row (${ROW_COUNT} rows) ===`)
    console.debug(`  INSERT sync:    ${insSyncMs}ms`)
    console.debug(`  INSERT async:   ${insAsyncMs}ms`)
    console.debug(`  appendRow:      ${appMs}ms`)
    console.debug(`  vs sync:  ${syncSpeedup.toFixed(1)}x faster`)
    console.debug(`  vs async: ${asyncSpeedup.toFixed(1)}x faster`)
    console.debug(`  Content: verified (first/mid/last rows + id checksum)`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Batch: appendRows vs batch INSERT — 10K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // --- Batch INSERT using executeBatchSync ---
    db.executeSync('CREATE TABLE bench_batch_ins (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insSyncStart = Date.now()
    for (let offset = 0; offset < ROW_COUNT; offset += BATCH_SIZE) {
      const end = Math.min(offset + BATCH_SIZE, ROW_COUNT)
      const commands: { query: string; params: (number | string | boolean)[] }[] = []
      for (let i = offset; i < end; i++) {
        commands.push({
          query: 'INSERT INTO bench_batch_ins VALUES (?, ?, ?, ?)',
          params: [i, `row_${i}`, i * 1.1, i % 2 === 0],
        })
      }
      db.executeBatchSync(commands)
    }
    const insSyncMs = Date.now() - insSyncStart
    verifyContent(db, 'bench_batch_ins', ROW_COUNT, 'Batch INSERT sync')

    // --- Batch INSERT using executeBatch (async) ---
    db.executeSync('DROP TABLE bench_batch_ins')
    db.executeSync('CREATE TABLE bench_batch_ins_async (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insAsyncStart = Date.now()
    for (let offset = 0; offset < ROW_COUNT; offset += BATCH_SIZE) {
      const end = Math.min(offset + BATCH_SIZE, ROW_COUNT)
      const commands: { query: string; params: (number | string | boolean)[] }[] = []
      for (let i = offset; i < end; i++) {
        commands.push({
          query: 'INSERT INTO bench_batch_ins_async VALUES (?, ?, ?, ?)',
          params: [i, `row_${i}`, i * 1.1, i % 2 === 0],
        })
      }
      await db.executeBatch(commands)
    }
    const insAsyncMs = Date.now() - insAsyncStart
    verifyContent(db, 'bench_batch_ins_async', ROW_COUNT, 'Batch INSERT async')

    // --- Batch appendRows ---
    db.executeSync('DROP TABLE bench_batch_ins_async')
    db.executeSync('CREATE TABLE bench_batch_app (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const appStart = Date.now()
    await withAppender(db, 'bench_batch_app', (appender) => {
      for (let offset = 0; offset < ROW_COUNT; offset += BATCH_SIZE) {
        const end = Math.min(offset + BATCH_SIZE, ROW_COUNT)
        const batch: [number, string, number, boolean][] = []
        for (let i = offset; i < end; i++) {
          batch.push(generateRow(i))
        }
        appender.appendRows(batch)
      }
    })
    const appMs = Date.now() - appStart
    verifyContent(db, 'bench_batch_app', ROW_COUNT, 'Batch appendRows')

    const syncSpeedup = insSyncMs / Math.max(appMs, 1)
    const asyncSpeedup = insAsyncMs / Math.max(appMs, 1)
    console.debug(`=== Batch (${ROW_COUNT} rows, ${BATCH_SIZE}/batch) ===`)
    console.debug(`  executeBatchSync:  ${insSyncMs}ms`)
    console.debug(`  executeBatch:      ${insAsyncMs}ms`)
    console.debug(`  appendRows:        ${appMs}ms`)
    console.debug(`  vs sync:  ${syncSpeedup.toFixed(1)}x faster`)
    console.debug(`  vs async: ${asyncSpeedup.toFixed(1)}x faster`)
    console.debug(`  Content: verified (first/mid/last rows + id checksum)`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Streaming vs materialized — 200K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // 200K rows — at small scale both finish instantly. At scale, materialized
    // must allocate all rows at once while streaming processes 2048-row chunks.
    db.executeSync('CREATE TABLE bench_stream (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    await populateTable(db, 'bench_stream', STREAM_ROW_COUNT)

    // --- Materialized: loads all rows into memory at once ---
    const matStart = Date.now()
    const matResult = await db.execute('SELECT * FROM bench_stream ORDER BY id')
    const matRows = matResult.rowCount
    const matMs = Date.now() - matStart

    if (matRows !== STREAM_ROW_COUNT) throw new Error(`Materialized: expected ${STREAM_ROW_COUNT}, got ${matRows}`)

    // Verify materialized content via toRows spot check
    const matData = matResult.toRows()
    if (matData[0].id !== 0 || matData[0].name !== 'row_0') {
      throw new Error(`Materialized: first row wrong — id=${matData[0].id}, name=${matData[0].name}`)
    }
    const matLastIdx = matData.length - 1
    if (matData[matLastIdx].id !== STREAM_ROW_COUNT - 1) {
      throw new Error(`Materialized: last row id=${matData[matLastIdx].id}, expected ${STREAM_ROW_COUNT - 1}`)
    }

    // --- Streaming: processes 2048-row chunks, bounded memory ---
    const streamStart = Date.now()
    const stream = await db.stream('SELECT * FROM bench_stream ORDER BY id')
    let streamRows = 0
    let chunkCount = 0
    let firstRow: Record<string, any> | null = null
    let lastRow: Record<string, any> | null = null
    for await (const chunk of streamChunks(stream)) {
      streamRows += chunk.rowCount
      chunkCount++
      // Spot-check first and last chunks only (don't toRows all 200K — defeats the point)
      if (!firstRow) {
        const rows = chunk.toRows()
        if (rows.length > 0) firstRow = rows[0]
      }
      // Always keep last chunk's last row
      if (chunkCount > 0) {
        const rows = chunk.toRows()
        if (rows.length > 0) lastRow = rows[rows.length - 1]
      }
    }
    const streamMs = Date.now() - streamStart

    if (streamRows !== STREAM_ROW_COUNT) throw new Error(`Streaming: expected ${STREAM_ROW_COUNT}, got ${streamRows}`)

    // Verify streaming content
    if (!firstRow || firstRow.id !== 0 || firstRow.name !== 'row_0') {
      throw new Error(`Streaming: first row wrong — ${JSON.stringify(firstRow)}`)
    }
    if (!lastRow || lastRow.id !== STREAM_ROW_COUNT - 1) {
      throw new Error(`Streaming: last row id=${lastRow?.id}, expected ${STREAM_ROW_COUNT - 1}`)
    }

    console.debug(`=== Streaming vs Materialized (${STREAM_ROW_COUNT} rows) ===`)
    console.debug(`  Materialized: ${matMs}ms (all ${matRows} rows in memory)`)
    console.debug(`  Streaming:    ${streamMs}ms (${chunkCount} chunks of ≤2048 rows)`)
    console.debug(`  Content: verified (first/last rows on both)`)
    console.debug(`  Note: Streaming wins on memory, not speed — bounded vs unbounded allocation`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Streaming 200K rows stress test', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE bench_stress (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    await populateTable(db, 'bench_stress', STREAM_ROW_COUNT)

    const start = Date.now()
    const stream = await db.stream('SELECT * FROM bench_stress ORDER BY id')
    let totalRows = 0
    let chunkCount = 0
    let firstRow: Record<string, any> | null = null
    let lastRow: Record<string, any> | null = null
    for await (const chunk of streamChunks(stream)) {
      totalRows += chunk.rowCount
      chunkCount++
      if (!firstRow) {
        const rows = chunk.toRows()
        if (rows.length > 0) firstRow = rows[0]
      }
      // Keep updating last row from final chunk
      const rows = chunk.toRows()
      if (rows.length > 0) lastRow = rows[rows.length - 1]
    }
    const elapsed = Date.now() - start

    if (totalRows !== STREAM_ROW_COUNT) throw new Error(`Expected ${STREAM_ROW_COUNT} rows, got ${totalRows}`)
    if (!firstRow || firstRow.id !== 0) throw new Error(`First row id=${firstRow?.id}, expected 0`)
    if (!lastRow || lastRow.id !== STREAM_ROW_COUNT - 1) throw new Error(`Last row id=${lastRow?.id}, expected ${STREAM_ROW_COUNT - 1}`)

    console.debug(`=== Streaming Stress Test (${STREAM_ROW_COUNT} rows) ===`)
    console.debug(`  Total rows: ${totalRows}`)
    console.debug(`  Chunks:     ${chunkCount}`)
    console.debug(`  Time:       ${elapsed}ms`)
    console.debug(`  First: id=${firstRow.id}, name=${firstRow.name}`)
    console.debug(`  Last:  id=${lastRow.id}, name=${lastRow.name}`)
    console.debug('  Result:     PASSED (no crash, no OOM, data correct)')
  } finally {
    db.close()
  }
})
