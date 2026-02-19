import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB, streamChunks } from 'react-native-duckdb'
import type { QueryResult } from 'react-native-duckdb'

TestRegistry.registerTest('Streaming', 'Pull-based fetchChunk — collects all rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_pull (id INTEGER, name VARCHAR)')
    for (let i = 0; i < 100; i++) {
      db.executeSync('INSERT INTO stream_pull VALUES (?, ?)', [i, `row_${i}`])
    }
    const stream = await db.stream('SELECT * FROM stream_pull ORDER BY id')
    let totalRows = 0
    let chunkCount = 0
    while (true) {
      const chunk = await stream.fetchChunk()
      if (chunk === undefined || chunk === null) break
      const rows = chunk.toRows()
      totalRows += rows.length
      chunkCount++
      if (rows.length > 0) {
        const col = chunk.getColumn(0)
        if (!('data' in col)) throw new Error('Expected NumericColumn for id')
        if (!chunk.columnNames.includes('id')) throw new Error('Missing column name "id"')
        if (!chunk.columnNames.includes('name')) throw new Error('Missing column name "name"')
      }
    }
    console.debug(`pull-based: ${totalRows} rows in ${chunkCount} chunks`)
    if (totalRows !== 100) throw new Error(`Expected 100 rows, got ${totalRows}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Push-based onChunk/start — receives all rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_push (id INTEGER, val DOUBLE)')
    for (let i = 0; i < 100; i++) {
      db.executeSync('INSERT INTO stream_push VALUES (?, ?)', [i, i * 1.5])
    }
    const stream = await db.stream('SELECT * FROM stream_push')
    let totalRows = 0
    let chunkCount = 0
    stream.onChunk((chunk: QueryResult) => {
      totalRows += chunk.toRows().length
      chunkCount++
    })
    await stream.start()
    console.debug(`push-based: ${totalRows} rows in ${chunkCount} chunks`)
    if (totalRows !== 100) throw new Error(`Expected 100 rows, got ${totalRows}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Async iterator (streamChunks) — iterates all chunks', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_iter (id INTEGER)')
    for (let i = 0; i < 100; i++) {
      db.executeSync('INSERT INTO stream_iter VALUES (?)', [i])
    }
    const stream = await db.stream('SELECT * FROM stream_iter')
    let totalRows = 0
    let chunkCount = 0
    for await (const chunk of streamChunks(stream)) {
      totalRows += chunk.toRows().length
      chunkCount++
    }
    console.debug(`async iterator: ${totalRows} rows in ${chunkCount} chunks`)
    if (totalRows !== 100) throw new Error(`Expected 100 rows, got ${totalRows}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Stream metadata — columnNames, columnTypes, columnCount', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_meta (id INTEGER, name VARCHAR, score DOUBLE)')
    db.executeSync("INSERT INTO stream_meta VALUES (1, 'test', 9.5)")
    const stream = await db.stream('SELECT * FROM stream_meta')
    console.debug(`stream meta: count=${stream.columnCount}, names=${stream.columnNames}, types=${stream.columnTypes}`)
    if (stream.columnCount !== 3) throw new Error(`Expected columnCount=3, got ${stream.columnCount}`)
    if (stream.columnNames[0] !== 'id') throw new Error(`Expected col0='id', got ${stream.columnNames[0]}`)
    if (stream.columnNames[1] !== 'name') throw new Error(`Expected col1='name', got ${stream.columnNames[1]}`)
    if (stream.columnNames[2] !== 'score') throw new Error(`Expected col2='score', got ${stream.columnNames[2]}`)
    if (!stream.columnTypes[0].includes('INTEGER')) throw new Error(`Expected INTEGER type, got ${stream.columnTypes[0]}`)
    if (!stream.columnTypes[1].includes('VARCHAR')) throw new Error(`Expected VARCHAR type, got ${stream.columnTypes[1]}`)
    if (!stream.columnTypes[2].includes('DOUBLE')) throw new Error(`Expected DOUBLE type, got ${stream.columnTypes[2]}`)
    stream.close()
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Stream auto-close on exhaustion — isDone becomes true', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_done (id INTEGER)')
    db.executeSync('INSERT INTO stream_done VALUES (1), (2), (3)')
    const stream = await db.stream('SELECT * FROM stream_done')
    while (true) {
      const chunk = await stream.fetchChunk()
      if (chunk === undefined || chunk === null) break
    }
    console.debug(`isDone after exhaustion: ${stream.isDone}`)
    if (!stream.isDone) throw new Error('Expected isDone=true after consuming all chunks')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Stream early close — fetchChunk returns undefined after close', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_early (id INTEGER)')
    for (let i = 0; i < 50; i++) {
      db.executeSync('INSERT INTO stream_early VALUES (?)', [i])
    }
    const stream = await db.stream('SELECT * FROM stream_early')
    const first = await stream.fetchChunk()
    if (first === undefined || first === null) throw new Error('Expected at least one chunk')
    console.debug(`first chunk rows: ${first.toRows().length}`)
    stream.close()
    const after = await stream.fetchChunk()
    console.debug(`after close: ${after}`)
    if (after !== undefined && after !== null) throw new Error('Expected undefined after close')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Stream with params — parameter binding works', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_params (id INTEGER, name VARCHAR)')
    for (let i = 0; i < 100; i++) {
      db.executeSync('INSERT INTO stream_params VALUES (?, ?)', [i, `item_${i}`])
    }
    const stream = await db.stream('SELECT * FROM stream_params WHERE id > ?', [50])
    let totalRows = 0
    for await (const chunk of streamChunks(stream)) {
      totalRows += chunk.toRows().length
    }
    console.debug(`parameterized stream: ${totalRows} rows (expected 49, ids 51-99)`)
    if (totalRows !== 49) throw new Error(`Expected 49 rows (id > 50), got ${totalRows}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Streaming', 'Empty result stream — fetchChunk returns undefined immediately', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE stream_empty (id INTEGER)')
    const stream = await db.stream('SELECT * FROM stream_empty')
    const chunk = await stream.fetchChunk()
    console.debug(`empty stream chunk: ${chunk}`)
    if (chunk !== undefined && chunk !== null) {
      const rows = chunk.toRows()
      if (rows.length !== 0) throw new Error(`Expected 0 rows from empty table, got ${rows.length}`)
    }
    console.debug('empty stream: correctly returned no data')
  } finally {
    db.close()
  }
})
