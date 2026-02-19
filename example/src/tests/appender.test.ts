import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB, DuckDBError, withAppender } from 'react-native-duckdb'

TestRegistry.registerTest('Appender', 'appendRow basic — 10 rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_basic (id INTEGER, name VARCHAR)')
    const appender = db.createAppender('app_basic')
    for (let i = 0; i < 10; i++) {
      appender.appendRow([i, `name_${i}`])
    }
    appender.close()
    const result = db.executeSync('SELECT count(*) as cnt FROM app_basic')
    const rows = result.toRows()
    const cnt = Number(rows[0].cnt)
    console.debug(`appendRow basic: count=${cnt}`)
    if (cnt !== 10) throw new Error(`Expected 10 rows, got ${cnt}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'appendRows batch — 100 rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_batch (id INTEGER, val DOUBLE)')
    const appender = db.createAppender('app_batch')
    const batch: [number, number][] = []
    for (let i = 0; i < 100; i++) {
      batch.push([i, i * 2.5])
    }
    appender.appendRows(batch)
    appender.close()
    const result = db.executeSync('SELECT count(*) as cnt FROM app_batch')
    const rows = result.toRows()
    const cnt = Number(rows[0].cnt)
    console.debug(`appendRows batch: count=${cnt}`)
    if (cnt !== 100) throw new Error(`Expected 100 rows, got ${cnt}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'appendColumns columnar — 3 columns', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_col (id INTEGER, name VARCHAR, flag BOOLEAN)')
    const appender = db.createAppender('app_col')
    const ids = [1, 2, 3, 4, 5]
    const names = ['a', 'b', 'c', 'd', 'e']
    const flags = [true, false, true, false, true]
    appender.appendColumns([ids, names, flags])
    appender.close()
    const result = db.executeSync('SELECT * FROM app_col ORDER BY id')
    const rows = result.toRows()
    console.debug(`appendColumns: ${JSON.stringify(rows[0])}`)
    if (rows.length !== 5) throw new Error(`Expected 5 rows, got ${rows.length}`)
    if (rows[0].id !== 1) throw new Error(`Expected id=1, got ${rows[0].id}`)
    if (rows[0].name !== 'a') throw new Error(`Expected name='a', got ${rows[0].name}`)
    if (rows[0].flag !== true) throw new Error(`Expected flag=true, got ${rows[0].flag}`)
    if (rows[4].name !== 'e') throw new Error(`Expected last name='e', got ${rows[4].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'appendColumns length validation — throws on mismatch', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_col_val (id INTEGER, name VARCHAR)')
    const appender = db.createAppender('app_col_val')
    let threw = false
    try {
      appender.appendColumns([[1, 2, 3], ['a', 'b']])
    } catch (e: any) {
      threw = true
      console.debug(`appendColumns validation threw: ${e.message}`)
    }
    if (!threw) throw new Error('Expected appendColumns to throw on mismatched lengths')
    appender.close()
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'flush manual — data visible mid-stream', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_flush (id INTEGER)')
    const appender = db.createAppender('app_flush')
    for (let i = 0; i < 50; i++) {
      appender.appendRow([i])
    }
    appender.flush()
    const mid = db.executeSync('SELECT count(*) as cnt FROM app_flush')
    const midCount = Number(mid.toRows()[0].cnt)
    console.debug(`after flush: ${midCount} rows`)
    if (midCount !== 50) throw new Error(`Expected 50 rows after flush, got ${midCount}`)
    for (let i = 50; i < 100; i++) {
      appender.appendRow([i])
    }
    appender.close()
    const final = db.executeSync('SELECT count(*) as cnt FROM app_flush')
    const finalCount = Number(final.toRows()[0].cnt)
    console.debug(`after close: ${finalCount} rows`)
    if (finalCount !== 100) throw new Error(`Expected 100 rows after close, got ${finalCount}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'flushEvery option — auto-flush every N rows', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_flush_every (id INTEGER)')
    const appender = db.createAppender('app_flush_every', { flushEvery: 10 })
    for (let i = 0; i < 25; i++) {
      appender.appendRow([i])
    }
    appender.close()
    const result = db.executeSync('SELECT count(*) as cnt FROM app_flush_every')
    const rows = result.toRows()
    const cnt = Number(rows[0].cnt)
    console.debug(`flushEvery: count=${cnt}`)
    if (cnt !== 25) throw new Error(`Expected 25 rows, got ${cnt}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'withAppender wrapper — auto-close lifecycle', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_with (id INTEGER, name VARCHAR)')
    await withAppender(db, 'app_with', (app) => {
      app.appendRow([1, 'alice'])
      app.appendRow([2, 'bob'])
      app.appendRow([3, 'charlie'])
    })
    const result = db.executeSync('SELECT * FROM app_with ORDER BY id')
    const rows = result.toRows()
    console.debug(`withAppender: ${rows.length} rows`)
    if (rows.length !== 3) throw new Error(`Expected 3 rows, got ${rows.length}`)
    if (rows[0].name !== 'alice') throw new Error(`Expected 'alice', got ${rows[0].name}`)
    if (rows[2].name !== 'charlie') throw new Error(`Expected 'charlie', got ${rows[2].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'withAppender error handling — wraps in DuckDBError', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_err (id INTEGER)')
    let caught: any = null
    try {
      await withAppender(db, 'app_err', (app) => {
        app.appendRow([1])
        app.appendRow([2])
        throw new Error('intentional error')
      })
    } catch (e) {
      caught = e
    }
    if (!caught) throw new Error('Expected withAppender to throw')
    console.debug(`withAppender error: ${caught.constructor.name}: ${caught.message}`)
    if (!(caught instanceof DuckDBError)) throw new Error(`Expected DuckDBError, got ${caught.constructor.name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'Appender to non-existent table — throws', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    let threw = false
    try {
      db.createAppender('no_such_table_xyz')
    } catch (e: any) {
      threw = true
      console.debug(`non-existent table threw: ${e.message || e}`)
    }
    if (!threw) throw new Error('Expected createAppender on non-existent table to throw')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Appender', 'Type coercion — string values to integer columns', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE app_coerce (id INTEGER, val DOUBLE)')
    const appender = db.createAppender('app_coerce')
    appender.appendRow(['1', '3.14'])
    appender.appendRow(['2', '2.718'])
    appender.close()
    const result = db.executeSync('SELECT * FROM app_coerce ORDER BY id')
    const rows = result.toRows()
    console.debug(`coercion: ${JSON.stringify(rows)}`)
    if (rows.length !== 2) throw new Error(`Expected 2 rows, got ${rows.length}`)
    if (rows[0].id !== 1) throw new Error(`Expected id=1, got ${rows[0].id}`)
    if (Math.abs((rows[0].val as number) - 3.14) > 0.01) throw new Error(`Expected val≈3.14, got ${rows[0].val}`)
  } finally {
    db.close()
  }
})
