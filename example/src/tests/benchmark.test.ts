import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB, withAppender, streamChunks } from 'react-native-duckdb'

const ROW_COUNT = 10_000
const BATCH_SIZE = 1_000

function generateRow(i: number): [number, string, number, boolean] {
  return [i, `row_${i}`, i * 1.1, i % 2 === 0]
}

TestRegistry.registerTest('Benchmarks', 'Row-by-row: appendRow vs INSERT — 10K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // --- INSERT one-by-one ---
    db.executeSync('CREATE TABLE bench_ins (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insStart = Date.now()
    for (let i = 0; i < ROW_COUNT; i++) {
      db.executeSync('INSERT INTO bench_ins VALUES (?, ?, ?, ?)', [
        i, `row_${i}`, i * 1.1, i % 2 === 0,
      ])
    }
    const insMs = Date.now() - insStart

    const insCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_ins').toRows()[0].cnt)
    if (insCount !== ROW_COUNT) throw new Error(`INSERT: expected ${ROW_COUNT}, got ${insCount}`)

    // --- appendRow one-by-one (fair comparison) ---
    db.executeSync('DROP TABLE bench_ins')
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

    const speedup = insMs / Math.max(appMs, 1)
    console.debug(`=== Row-by-row: appendRow vs INSERT (${ROW_COUNT} rows) ===`)
    console.debug(`  INSERT (one-by-one):   ${insMs}ms`)
    console.debug(`  appendRow (one-by-one): ${appMs}ms`)
    console.debug(`  Speedup: ${speedup.toFixed(1)}x faster`)

    if (appMs >= insMs) {
      console.debug('WARNING: appendRow was not faster than INSERT')
    }
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Batch: appendRows vs batch INSERT — 10K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // --- Batch INSERT using executeBatch ---
    db.executeSync('CREATE TABLE bench_batch_ins (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    const insStart = Date.now()
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
    const insMs = Date.now() - insStart

    const insCount = Number(db.executeSync('SELECT count(*) as cnt FROM bench_batch_ins').toRows()[0].cnt)
    if (insCount !== ROW_COUNT) throw new Error(`Batch INSERT: expected ${ROW_COUNT}, got ${insCount}`)

    // --- Batch appendRows ---
    db.executeSync('DROP TABLE bench_batch_ins')
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

    const speedup = insMs / Math.max(appMs, 1)
    console.debug(`=== Batch: appendRows vs batch INSERT (${ROW_COUNT} rows, ${BATCH_SIZE}/batch) ===`)
    console.debug(`  executeBatchSync: ${insMs}ms`)
    console.debug(`  appendRows:       ${appMs}ms`)
    console.debug(`  Speedup: ${speedup.toFixed(1)}x faster`)

    if (appMs >= insMs) {
      console.debug('WARNING: appendRows was not faster than batch INSERT')
    }
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Streaming vs materialized — 10K rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // Populate with Appender for speed
    db.executeSync('CREATE TABLE bench_stream (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    await withAppender(db, 'bench_stream', (appender) => {
      for (let offset = 0; offset < ROW_COUNT; offset += BATCH_SIZE) {
        const end = Math.min(offset + BATCH_SIZE, ROW_COUNT)
        const batch: [number, string, number, boolean][] = []
        for (let i = offset; i < end; i++) {
          batch.push(generateRow(i))
        }
        appender.appendRows(batch)
      }
    })

    // --- Materialized approach ---
    const matStart = Date.now()
    const matResult = await db.execute('SELECT * FROM bench_stream')
    const matRows = matResult.rowCount
    const matMs = Date.now() - matStart

    if (matRows !== ROW_COUNT) throw new Error(`Materialized: expected ${ROW_COUNT} rows, got ${matRows}`)

    // --- Streaming approach ---
    const streamStart = Date.now()
    const stream = await db.stream('SELECT * FROM bench_stream')
    let streamRows = 0
    let chunkCount = 0
    for await (const chunk of streamChunks(stream)) {
      streamRows += chunk.rowCount
      chunkCount++
    }
    const streamMs = Date.now() - streamStart

    if (streamRows !== ROW_COUNT) throw new Error(`Streaming: expected ${ROW_COUNT} rows, got ${streamRows}`)

    console.debug(`=== Streaming vs Materialized (${ROW_COUNT} rows) ===`)
    console.debug(`  Materialized: ${matMs}ms (${matRows} rows)`)
    console.debug(`  Streaming:    ${streamMs}ms (${streamRows} rows in ${chunkCount} chunks)`)
    console.debug('  Both completed without OOM/crash')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Benchmarks', 'Streaming 10K rows stress test', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE bench_stress (id INTEGER, name VARCHAR, value DOUBLE, flag BOOLEAN)')
    await withAppender(db, 'bench_stress', (appender) => {
      for (let offset = 0; offset < ROW_COUNT; offset += BATCH_SIZE) {
        const end = Math.min(offset + BATCH_SIZE, ROW_COUNT)
        const batch: [number, string, number, boolean][] = []
        for (let i = offset; i < end; i++) {
          batch.push(generateRow(i))
        }
        appender.appendRows(batch)
      }
    })

    const start = Date.now()
    const stream = await db.stream('SELECT * FROM bench_stress')
    let totalRows = 0
    let chunkCount = 0
    for await (const chunk of streamChunks(stream)) {
      totalRows += chunk.rowCount
      chunkCount++
    }
    const elapsed = Date.now() - start

    console.debug(`=== Streaming Stress Test (${ROW_COUNT} rows) ===`)
    console.debug(`  Total rows: ${totalRows}`)
    console.debug(`  Chunks:     ${chunkCount}`)
    console.debug(`  Time:       ${elapsed}ms`)
    console.debug('  Result:     PASSED (no crash, no OOM)')

    if (totalRows !== ROW_COUNT) throw new Error(`Expected ${ROW_COUNT} rows, got ${totalRows}`)
  } finally {
    db.close()
  }
})
