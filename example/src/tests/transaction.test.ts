import { TestRegistry } from '../testing/TestRegistry'
import {
  HybridDuckDB,
  DuckDBError,
  createWrappedDatabase,
} from 'react-native-duckdb'

// ── Transactions ──

TestRegistry.registerTest('Transactions', 'Transaction commit persists data', async () => {
  const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    await db.transaction(async (tx) => {
      tx.executeSync("INSERT INTO t VALUES (1, 'alice')")
    })
    const result = db.executeSync('SELECT * FROM t')
    const rows = result.toRows()
    console.debug(`commit test rows: ${JSON.stringify(rows)}`)
    if (rows.length !== 1) throw new Error(`Expected 1 row, got ${rows.length}`)
    if (rows[0].name !== 'alice') throw new Error(`Expected 'alice', got ${rows[0].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Transactions', 'Transaction rollback reverts data', async () => {
  const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    db.executeSync("INSERT INTO t VALUES (1, 'original')")
    try {
      await db.transaction(async (tx) => {
        tx.executeSync("INSERT INTO t VALUES (2, 'bob')")
        throw new Error('intentional')
      })
    } catch {
      // expected
    }
    const result = db.executeSync('SELECT * FROM t')
    const rows = result.toRows()
    console.debug(`rollback test rows: ${JSON.stringify(rows)}`)
    if (rows.length !== 1) throw new Error(`Expected 1 row after rollback, got ${rows.length}`)
    if (rows[0].name !== 'original') throw new Error(`Expected 'original', got ${rows[0].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Transactions', 'Auto-rollback on error preserves DuckDBError', async () => {
  const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
  try {
    db.executeSync('CREATE TABLE t (id INTEGER)')
    let caught: any = null
    try {
      await db.transaction(async (tx) => {
        tx.executeSync('INVALID SQL SYNTAX HERE')
      })
    } catch (e) {
      caught = e
    }
    if (!caught) throw new Error('Expected transaction to throw')
    console.debug(`auto-rollback error: ${caught.constructor.name}, transaction: ${JSON.stringify(caught.transaction)}`)
    if (!(caught instanceof DuckDBError)) throw new Error(`Expected DuckDBError, got ${caught.constructor.name}`)
    if (!caught.transaction) throw new Error('Expected error.transaction to be set')
    if (caught.transaction.rolledBack !== true) throw new Error(`Expected rolledBack=true, got ${caught.transaction.rolledBack}`)
    if (caught.transaction.depth !== 0) throw new Error(`Expected depth=0, got ${caught.transaction.depth}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Transactions', 'Transaction error context tracks statementsExecuted', async () => {
  const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    let caught: any = null
    try {
      await db.transaction(async (tx) => {
        tx.executeSync("INSERT INTO t VALUES (1, 'a')")
        tx.executeSync("INSERT INTO t VALUES (2, 'b')")
        tx.executeSync("INSERT INTO t VALUES (3, 'c')")
        throw new Error('intentional after 3 inserts')
      })
    } catch (e) {
      caught = e
    }
    if (!caught) throw new Error('Expected transaction to throw')
    console.debug(`statementsExecuted: ${caught.transaction?.statementsExecuted}`)
    if (!caught.transaction || caught.transaction.statementsExecuted < 3) {
      throw new Error(`Expected statementsExecuted >= 3, got ${caught.transaction?.statementsExecuted}`)
    }
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Transactions', 'Nested transaction throws (DuckDB has no SAVEPOINT)', async () => {
  const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    let threw = false
    try {
      await db.transaction(async (tx) => {
        tx.executeSync("INSERT INTO t VALUES (1, 'alice')")
        await tx.transaction(async (nested) => {
          nested.executeSync("INSERT INTO t VALUES (2, 'bob')")
        })
      })
    } catch (e: any) {
      threw = true
      console.debug(`nested tx error: ${e.message}`)
      if (!e.message.includes('Nested transactions are not supported')) {
        throw new Error(`Expected nested transaction error, got: ${e.message}`)
      }
    }
    if (!threw) throw new Error('Expected nested transaction to throw')
    // outer transaction should have been rolled back
    const result = db.executeSync('SELECT * FROM t')
    if (result.rowCount !== 0) throw new Error(`Expected 0 rows after rollback, got ${result.rowCount}`)
  } finally {
    db.close()
  }
})

// ── Batch Execution ──

TestRegistry.registerTest('Batch Execution', 'Batch execute — multiple inserts', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    const result = db.executeBatchSync([
      { query: "INSERT INTO t VALUES (1, 'a')" },
      { query: "INSERT INTO t VALUES (2, 'b')" },
      { query: "INSERT INTO t VALUES (3, 'c')" },
    ])
    console.debug(`batch rowsAffected: ${result.rowsAffected}`)
    if (result.rowsAffected !== 3) throw new Error(`Expected rowsAffected=3, got ${result.rowsAffected}`)
    const sel = db.executeSync('SELECT * FROM t ORDER BY id')
    if (sel.rowCount !== 3) throw new Error(`Expected 3 rows, got ${sel.rowCount}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Batch Execution', 'Batch execute — parameterized commands', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    const result = db.executeBatchSync([
      { query: 'INSERT INTO t VALUES (?, ?)', params: [1, 'x'] },
      { query: 'INSERT INTO t VALUES (?, ?)', params: [2, 'y'] },
    ])
    console.debug(`param batch rowsAffected: ${result.rowsAffected}`)
    if (result.rowsAffected !== 2) throw new Error(`Expected rowsAffected=2, got ${result.rowsAffected}`)
    const sel = db.executeSync('SELECT * FROM t ORDER BY id')
    const rows = sel.toRows()
    if (rows[0].name !== 'x') throw new Error(`Expected 'x', got ${rows[0].name}`)
    if (rows[1].name !== 'y') throw new Error(`Expected 'y', got ${rows[1].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Batch Execution', 'Batch execute — rolls back on failure', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    let threw = false
    try {
      db.executeBatchSync([
        { query: "INSERT INTO t VALUES (1, 'a')" },
        { query: "INSERT INTO t VALUES (2, 'b')" },
        { query: 'INVALID SQL' },
      ])
    } catch (e) {
      threw = true
      console.debug(`batch rollback threw: ${e}`)
    }
    if (!threw) throw new Error('Expected batch with invalid SQL to throw')
    const sel = db.executeSync('SELECT * FROM t')
    console.debug(`after failed batch rowCount: ${sel.rowCount}`)
    if (sel.rowCount !== 0) throw new Error(`Expected 0 rows after rollback, got ${sel.rowCount}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Batch Execution', 'Batch execute async', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    const result = await db.executeBatch([
      { query: "INSERT INTO t VALUES (1, 'a')" },
    ])
    console.debug(`async batch rowsAffected: ${result.rowsAffected}`)
    if (result.rowsAffected !== 1) throw new Error(`Expected rowsAffected=1, got ${result.rowsAffected}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Batch Execution', 'Batch execute — SELECT silently ignored', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    db.executeSync("INSERT INTO t VALUES (1, 'a')")
    const result = db.executeBatchSync([
      { query: 'SELECT * FROM t' },
      { query: "INSERT INTO t VALUES (2, 'b')" },
    ])
    console.debug(`batch with SELECT rowsAffected: ${result.rowsAffected}`)
    if (result.rowsAffected !== 1) throw new Error(`Expected rowsAffected=1, got ${result.rowsAffected}`)
  } finally {
    db.close()
  }
})

// ── Multi-Database ──

TestRegistry.registerTest('Multi-Database', 'Attach and query across databases', async () => {
  const mainDb = HybridDuckDB.open('test_main.db', {})
  try {
    mainDb.executeSync('CREATE TABLE items (id INTEGER, val VARCHAR)')
    mainDb.executeSync("INSERT INTO items VALUES (1, 'main_item')")

    const auxDb = HybridDuckDB.open('test_attach.db', {})
    auxDb.executeSync('CREATE TABLE aux_items (id INTEGER, val VARCHAR)')
    auxDb.executeSync("INSERT INTO aux_items VALUES (10, 'aux_item')")
    auxDb.close()

    mainDb.attach('test_attach.db', 'aux')
    const result = mainDb.executeSync('SELECT * FROM aux.aux_items')
    const rows = result.toRows()
    console.debug(`cross-db query rows: ${JSON.stringify(rows)}`)
    if (rows.length !== 1) throw new Error(`Expected 1 row from aux, got ${rows.length}`)
    if (rows[0].val !== 'aux_item') throw new Error(`Expected 'aux_item', got ${rows[0].val}`)
    mainDb.detach('aux')
  } finally {
    mainDb.close()
    HybridDuckDB.deleteDatabase('test_main.db')
    HybridDuckDB.deleteDatabase('test_attach.db')
  }
})

TestRegistry.registerTest('Multi-Database', 'Detach removes access', async () => {
  const mainDb = HybridDuckDB.open('test_main2.db', {})
  try {
    const auxDb = HybridDuckDB.open('test_attach2.db', {})
    auxDb.executeSync('CREATE TABLE tbl (id INTEGER)')
    auxDb.executeSync('INSERT INTO tbl VALUES (1)')
    auxDb.close()

    mainDb.attach('test_attach2.db', 'aux')
    mainDb.detach('aux')

    let threw = false
    try {
      mainDb.executeSync('SELECT * FROM aux.tbl')
    } catch (e) {
      threw = true
      console.debug(`detach access error: ${e}`)
    }
    if (!threw) throw new Error('Expected query on detached DB to throw')
  } finally {
    mainDb.close()
    HybridDuckDB.deleteDatabase('test_main2.db')
    HybridDuckDB.deleteDatabase('test_attach2.db')
  }
})

TestRegistry.registerTest('Multi-Database', 'Attach with readOnly option', async () => {
  const mainDb = HybridDuckDB.open('test_main3.db', {})
  try {
    const auxDb = HybridDuckDB.open('test_ro_attach.db', {})
    auxDb.executeSync('CREATE TABLE tbl (id INTEGER)')
    auxDb.executeSync('INSERT INTO tbl VALUES (42)')
    auxDb.close()

    mainDb.attach('test_ro_attach.db', 'ro_aux', { readOnly: true })

    const result = mainDb.executeSync('SELECT * FROM ro_aux.tbl')
    const rows = result.toRows()
    if (rows[0].id !== 42) throw new Error(`Expected id=42, got ${rows[0].id}`)

    let threw = false
    try {
      mainDb.executeSync('INSERT INTO ro_aux.tbl VALUES (99)')
    } catch (e) {
      threw = true
      console.debug(`readOnly write error: ${e}`)
    }
    if (!threw) throw new Error('Expected write to readOnly attached DB to throw')

    mainDb.detach('ro_aux')
  } finally {
    mainDb.close()
    HybridDuckDB.deleteDatabase('test_main3.db')
    HybridDuckDB.deleteDatabase('test_ro_attach.db')
  }
})

// ── Connection Management ──

TestRegistry.registerTest('Connection Management', 'connect() creates independent connection', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const conn = db.connect()
    const result = conn.executeSync('SELECT 42 as val')
    const rows = result.toRows()
    if (rows[0].val !== 42) throw new Error(`Expected val=42, got ${rows[0].val}`)
    const info = db.connections()
    console.debug(`connections after connect: ${JSON.stringify(info)}`)
    if (info.count !== 1) throw new Error(`Expected count=1, got ${info.count}`)
    conn.close()
    const info2 = db.connections()
    console.debug(`connections after conn.close: ${JSON.stringify(info2)}`)
    if (info2.count !== 0) throw new Error(`Expected count=0 after close, got ${info2.count}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Connection Management', 'close() throws with open connections', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  const conn = db.connect()
  let threw = false
  try {
    db.close()
  } catch (e) {
    threw = true
    console.debug(`close with open conn threw: ${e}`)
  }
  if (!threw) throw new Error('Expected close() to throw with open connections')
  conn.close()
  db.close()
})

TestRegistry.registerTest('Connection Management', 'close({ force: true }) succeeds despite open connections', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  db.connect()
  db.connect()
  db.close({ force: true })
  console.debug(`after force close isOpen: ${db.isOpen}`)
  if (db.isOpen) throw new Error('Expected isOpen=false after force close')
})

TestRegistry.registerTest('Connection Management', 'closeConnections() kills all connections', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.connect()
    db.connect()
    db.connect()
    const before = db.connections()
    console.debug(`connections before closeAll: ${before.count}`)
    if (before.count !== 3) throw new Error(`Expected 3 connections, got ${before.count}`)
    db.closeConnections()
    const after = db.connections()
    console.debug(`connections after closeAll: ${after.count}`)
    if (after.count !== 0) throw new Error(`Expected 0 connections after closeAll, got ${after.count}`)
  } finally {
    db.close()
  }
})
