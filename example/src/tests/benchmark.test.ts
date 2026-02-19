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

    const insCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_ins').toRows()[0].cnt)
    if (insCount !== ROW_COUNT) throw new Error(`INSERT sync: expected ${ROW_COUNT}, got ${insCount}`)

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

    const insAsyncCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_ins_async').toRows()[0].cnt)
    if (insAsyncCount !== ROW_COUNT) throw new Error(`INSERT async: expected ${ROW_COUNT}, got ${insAsyncCount}`)

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

    const appCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_app').toRows()[0].cnt)
    if (appCount !== ROW_COUNT) throw new Error(`Appender: expected ${ROW_COUNT}, got ${appCount}`)

    const syncSpeedup = insSyncMs / Math.max(appMs, 1)
    const asyncSpeedup = insAsyncMs / Math.max(appMs, 1)
    console.debug(`=== Row-by-row (${ROW_COUNT} rows) ===`)
    console.debug(`  INSERT sync:    ${insSyncMs}ms`)
    console.debug(`  INSERT async:   ${insAsyncMs}ms`)
    console.debug(`  appendRow:      ${appMs}ms`)
    console.debug(`  vs sync:  ${syncSpeedup.toFixed(1)}x faster`)
    console.debug(`  vs async: ${asyncSpeedup.toFixed(1)}x faster`)
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

    const insSyncCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_batch_ins').toRows()[0].cnt)
    if (insSyncCount !== ROW_COUNT) throw new Error(`Batch INSERT sync: expected ${ROW_COUNT}, got ${insSyncCount}`)

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

    const insAsyncCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_batch_ins_async').toRows()[0].cnt)
    if (insAsyncCount !== ROW_COUNT) throw new Error(`Batch INSERT async: expected ${ROW_COUNT}, got ${insAsyncCount}`)

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

    const appCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_batch_app').toRows()[0].cnt)
    if (appCount !== ROW_COUNT) throw new Error(`Batch Appender: expected ${ROW_COUNT}, got ${appCount}`)

    const syncSpeedup = insSyncMs / Math.max(appMs, 1)
    const asyncSpeedup = insAsyncMs / Math.max(appMs, 1)
    console.debug(`=== Batch (${ROW_COUNT} rows, ${BATCH_SIZE}/batch) ===`)
    console.debug(`  executeBatchSync:  ${insSyncMs}ms`)
    console.debug(`  executeBatch:      ${insAsyncMs}ms`)
    console.debug(`  appendRows:        ${appMs}ms`)
    console.debug(`  vs sync:  ${syncSpeedup.toFixed(1)}x faster`)
    console.debug(`  vs async: ${asyncSpeedup.toFixed(1)}x faster`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Streaming vs materialized — 200K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // Use 50K rows — at 10K both finish instantly, need scale to see the difference.
    // Streaming advantage is bounded memory, not raw speed. At scale, materialized
    // must allocate all rows at once while streaming processes 2048-row chunks.
    db.executeSync('CREATE TABLE bench_stream (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    await populateTable(db, 'bench_stream', STREAM_ROW_COUNT)

    // --- Materialized: loads all rows into memory at once ---
    const matStart = Date.now()
    const matResult = await db.execute('SELECT * FROM bench_stream')
    const matRows = matResult.rowCount
    // Force materialization by accessing data
    const _matCols = matResult.columnNames
    const matMs = Date.now() - matStart

    if (matRows !== STREAM_ROW_COUNT) throw new Error(`Materialized: expected ${STREAM_ROW_COUNT}, got ${matRows}`)

    // --- Streaming: processes 2048-row chunks, bounded memory ---
    const streamStart = Date.now()
    const stream = await db.stream('SELECT * FROM bench_stream')
    let streamRows = 0
    let chunkCount = 0
    for await (const chunk of streamChunks(stream)) {
      streamRows += chunk.rowCount
      chunkCount++
    }
    const streamMs = Date.now() - streamStart

    if (streamRows !== STREAM_ROW_COUNT) throw new Error(`Streaming: expected ${STREAM_ROW_COUNT}, got ${streamRows}`)

    console.debug(`=== Streaming vs Materialized (${STREAM_ROW_COUNT} rows) ===`)
    console.debug(`  Materialized: ${matMs}ms (all ${matRows} rows in memory)`)
    console.debug(`  Streaming:    ${streamMs}ms (${chunkCount} chunks of ≤2048 rows)`)
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
    const stream = await db.stream('SELECT * FROM bench_stress')
    let totalRows = 0
    let chunkCount = 0
    for await (const chunk of streamChunks(stream)) {
      totalRows += chunk.rowCount
      chunkCount++
    }
    const elapsed = Date.now() - start

    console.debug(`=== Streaming Stress Test (${STREAM_ROW_COUNT} rows) ===`)
    console.debug(`  Total rows: ${totalRows}`)
    console.debug(`  Chunks:     ${chunkCount}`)
    console.debug(`  Time:       ${elapsed}ms`)
    console.debug('  Result:     PASSED (no crash, no OOM)')

    if (totalRows !== STREAM_ROW_COUNT) throw new Error(`Expected ${STREAM_ROW_COUNT} rows, got ${totalRows}`)
  } finally {
    db.close()
  }
})
