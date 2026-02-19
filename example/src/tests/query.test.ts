import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Query Execution', 'Sync execute — basic SELECT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync("SELECT 42 as num, 'hello' as str")
    console.debug(`rowCount: ${result.rowCount}, columnCount: ${result.columnCount}`)
    if (result.rowCount !== 1) throw new Error(`Expected rowCount 1, got ${result.rowCount}`)
    if (result.columnCount !== 2) throw new Error(`Expected columnCount 2, got ${result.columnCount}`)
    if (!result.columnNames.includes('num')) throw new Error('Missing column name "num"')
    if (!result.columnNames.includes('str')) throw new Error('Missing column name "str"')
    const rows = result.toRows()
    console.debug(`rows[0]: ${JSON.stringify(rows[0])}`)
    if (rows[0].num !== 42) throw new Error(`Expected num=42, got ${rows[0].num}`)
    if (rows[0].str !== 'hello') throw new Error(`Expected str='hello', got ${rows[0].str}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Async execute — basic SELECT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = await db.execute("SELECT 42 as num, 'hello' as str")
    console.debug(`async rowCount: ${result.rowCount}, columnCount: ${result.columnCount}`)
    if (result.rowCount !== 1) throw new Error(`Expected rowCount 1, got ${result.rowCount}`)
    if (result.columnCount !== 2) throw new Error(`Expected columnCount 2, got ${result.columnCount}`)
    const rows = result.toRows()
    if (rows[0].num !== 42) throw new Error(`Expected num=42, got ${rows[0].num}`)
    if (rows[0].str !== 'hello') throw new Error(`Expected str='hello', got ${rows[0].str}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Sync execute — INSERT and rowsChanged', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')
    const ins = db.executeSync("INSERT INTO t VALUES (1, 'alice'), (2, 'bob')")
    console.debug(`rowsChanged: ${ins.rowsChanged}`)
    if (ins.rowsChanged !== 2) throw new Error(`Expected rowsChanged 2, got ${ins.rowsChanged}`)
    const sel = db.executeSync('SELECT * FROM t ORDER BY id')
    if (sel.rowCount !== 2) throw new Error(`Expected rowCount 2, got ${sel.rowCount}`)
    const rows = sel.toRows()
    console.debug(`rows: ${JSON.stringify(rows)}`)
    if (rows[0].id !== 1) throw new Error(`Expected id=1, got ${rows[0].id}`)
    if (rows[0].name !== 'alice') throw new Error(`Expected name='alice', got ${rows[0].name}`)
    if (rows[1].id !== 2) throw new Error(`Expected id=2, got ${rows[1].id}`)
    if (rows[1].name !== 'bob') throw new Error(`Expected name='bob', got ${rows[1].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Parameterized query — positional placeholders', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE params_test (a INTEGER, b VARCHAR, c BOOLEAN)')
    db.executeSync('INSERT INTO params_test VALUES (?, ?, ?)', [42, 'hello', true])
    const result = db.executeSync('SELECT * FROM params_test')
    const rows = result.toRows()
    console.debug(`parameterized row: ${JSON.stringify(rows[0])}`)
    if (rows[0].a !== 42) throw new Error(`Expected a=42, got ${rows[0].a}`)
    if (rows[0].b !== 'hello') throw new Error(`Expected b='hello', got ${rows[0].b}`)
    if (rows[0].c !== true) throw new Error(`Expected c=true, got ${rows[0].c}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Parameter types — null, boolean, number, bigint, string, blob', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE types_test (n_val INTEGER, b_val BOOLEAN, num_val DOUBLE, big_val BIGINT, str_val VARCHAR, blob_val BLOB)')
    const blob = new ArrayBuffer(4)
    new Uint8Array(blob).set([0xde, 0xad, 0xbe, 0xef])
    const bigInput = BigInt('9007199254740993')
    console.debug(`bigint param type: ${typeof bigInput}, value: ${bigInput}`)
    db.executeSync('INSERT INTO types_test VALUES (?, ?, ?, ?, ?, ?)', [
      null, true, 3.14, bigInput, 'test', blob,
    ])
    const result = db.executeSync('SELECT * FROM types_test')
    const rows = result.toRows()
    const bigOut = rows[0].big_val
    console.debug(`types row: n_val=${rows[0].n_val}, b_val=${rows[0].b_val}, num_val=${rows[0].num_val}, big_val=${bigOut}(type=${typeof bigOut}), str_val=${rows[0].str_val}, blob_val type=${typeof rows[0].blob_val}`)

    if (rows[0].n_val !== null) throw new Error(`Expected n_val=null, got ${rows[0].n_val}`)
    if (rows[0].b_val !== true) throw new Error(`Expected b_val=true, got ${rows[0].b_val}`)
    if (Math.abs((rows[0].num_val as number) - 3.14) > 0.001) throw new Error(`Expected num_val≈3.14, got ${rows[0].num_val}`)
    // BIGINT should round-trip as bigint — Nitro variant bridge handles int64_t <> BigInt
    if (typeof bigOut !== 'bigint') throw new Error(`Expected big_val to be bigint, got ${typeof bigOut} (value: ${bigOut})`)
    if (bigOut !== bigInput) throw new Error(`Expected big_val=${bigInput}n, got ${bigOut}n (typeof=${typeof bigOut})`)
    if (rows[0].str_val !== 'test') throw new Error(`Expected str_val='test', got ${rows[0].str_val}`)
    if (!(rows[0].blob_val instanceof ArrayBuffer)) throw new Error(`Expected blob_val to be ArrayBuffer, got ${typeof rows[0].blob_val}`)
    const blobOut = new Uint8Array(rows[0].blob_val as ArrayBuffer)
    if (blobOut[0] !== 0xde) throw new Error(`Expected blob byte 0 = 0xDE, got ${blobOut[0]}`)
    if (blobOut[3] !== 0xef) throw new Error(`Expected blob byte 3 = 0xEF, got ${blobOut[3]}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Column metadata', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE meta_test (id INTEGER NOT NULL, name VARCHAR, score DOUBLE)')
    db.executeSync("INSERT INTO meta_test VALUES (1, 'alice', 9.5)")
    const result = db.executeSync('SELECT * FROM meta_test')
    console.debug(`columnCount: ${result.columnCount}, names: ${result.columnNames}, types: ${result.columnTypes}`)
    if (result.columnCount !== 3) throw new Error(`Expected columnCount 3, got ${result.columnCount}`)
    if (result.columnNames[0] !== 'id') throw new Error(`Expected col 0 name='id', got ${result.columnNames[0]}`)
    if (result.columnNames[1] !== 'name') throw new Error(`Expected col 1 name='name', got ${result.columnNames[1]}`)
    if (result.columnNames[2] !== 'score') throw new Error(`Expected col 2 name='score', got ${result.columnNames[2]}`)
    // DuckDB type strings should include INTEGER, VARCHAR, DOUBLE
    if (!result.columnTypes[0].includes('INTEGER')) throw new Error(`Expected col 0 type to include INTEGER, got ${result.columnTypes[0]}`)
    if (!result.columnTypes[1].includes('VARCHAR')) throw new Error(`Expected col 1 type to include VARCHAR, got ${result.columnTypes[1]}`)
    if (!result.columnTypes[2].includes('DOUBLE')) throw new Error(`Expected col 2 type to include DOUBLE, got ${result.columnTypes[2]}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Columnar access via getColumn()', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE col_test (x INTEGER, y VARCHAR)')
    db.executeSync("INSERT INTO col_test VALUES (1, 'a'), (2, 'b'), (3, 'c')")
    const result = db.executeSync('SELECT * FROM col_test ORDER BY x')
    const col0 = result.getColumn(0)
    const col1 = result.getColumn(1)

    // INTEGER column returns NumericColumn with typed ArrayBuffer
    if (!('data' in col0) || !('validity' in col0) || !('dtype' in col0))
      throw new Error(`Expected NumericColumn for INTEGER, got ${JSON.stringify(col0)}`)
    if (col0.dtype !== 'float64')
      throw new Error(`Expected dtype='float64', got ${col0.dtype}`)
    const data = new Float64Array(col0.data)
    const validity = new Uint8Array(col0.validity)
    if (data[0] !== 1 || data[1] !== 2 || data[2] !== 3)
      throw new Error(`Expected data=[1,2,3], got [${data[0]},${data[1]},${data[2]}]`)
    if (validity[0] !== 1 || validity[1] !== 1 || validity[2] !== 1)
      throw new Error(`Expected all valid, got [${validity[0]},${validity[1]},${validity[2]}]`)

    // VARCHAR column returns (string | null)[]
    if (!Array.isArray(col1))
      throw new Error(`Expected array for VARCHAR, got ${typeof col1}`)
    if (col1[0] !== 'a' || col1[1] !== 'b' || col1[2] !== 'c')
      throw new Error(`Expected col1=['a','b','c'], got ${JSON.stringify(col1)}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Prepared statement — create, execute, reuse', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prep_test (val INTEGER)')
    const stmt = db.prepare('INSERT INTO prep_test VALUES (?)')
    stmt.executeSync([1])
    stmt.executeSync([2])
    stmt.executeSync([3])
    stmt.finalize()
    const result = db.executeSync('SELECT val FROM prep_test ORDER BY val')
    console.debug(`prep_test rowCount: ${result.rowCount}`)
    if (result.rowCount !== 3) throw new Error(`Expected rowCount 3, got ${result.rowCount}`)
    const rows = result.toRows()
    if (rows[0].val !== 1) throw new Error(`Expected val=1, got ${rows[0].val}`)
    if (rows[1].val !== 2) throw new Error(`Expected val=2, got ${rows[1].val}`)
    if (rows[2].val !== 3) throw new Error(`Expected val=3, got ${rows[2].val}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Prepared statement — async execute', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prep_async (val VARCHAR)')
    const stmt = db.prepare('INSERT INTO prep_async VALUES (?)')
    await stmt.execute(['hello'])
    await stmt.execute(['world'])
    stmt.finalize()
    const result = await db.execute('SELECT val FROM prep_async ORDER BY val')
    const rows = result.toRows()
    console.debug(`prep_async rows: ${JSON.stringify(rows)}`)
    if (rows[0].val !== 'hello') throw new Error(`Expected val='hello', got ${rows[0].val}`)
    if (rows[1].val !== 'world') throw new Error(`Expected val='world', got ${rows[1].val}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Prepared statement — finalize prevents reuse', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const stmt = db.prepare('SELECT 1')
    stmt.finalize()
    let threw = false
    try {
      stmt.executeSync()
    } catch (e) {
      threw = true
      console.debug(`Finalized stmt threw as expected: ${e}`)
    }
    if (!threw) throw new Error('Expected finalized PreparedStatement to throw on executeSync')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Error propagation — invalid SQL', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    let threw = false
    try {
      db.executeSync('INVALID SQL QUERY')
    } catch (e) {
      threw = true
      console.debug(`Invalid SQL threw as expected: ${e}`)
    }
    if (!threw) throw new Error('Expected invalid SQL to throw')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Async error propagation', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    let threw = false
    try {
      await db.execute('INVALID SQL')
    } catch (e) {
      threw = true
      console.debug(`Async invalid SQL threw as expected: ${e}`)
    }
    if (!threw) throw new Error('Expected async invalid SQL to reject promise')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Execution', 'Numeric type mapping — TINYINT through DOUBLE', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync(`
      SELECT
        42::TINYINT as tiny,
        1000::SMALLINT as small,
        100000::INTEGER as med,
        9007199254740993::BIGINT as big,
        3.14::FLOAT as flt,
        2.718281828::DOUBLE as dbl
    `)
    const rows = result.toRows()
    console.debug(`numeric types: tiny=${rows[0].tiny}(${typeof rows[0].tiny}), small=${rows[0].small}(${typeof rows[0].small}), med=${rows[0].med}(${typeof rows[0].med}), big=${rows[0].big}(${typeof rows[0].big}), flt=${rows[0].flt}(${typeof rows[0].flt}), dbl=${rows[0].dbl}(${typeof rows[0].dbl})`)
    // TINYINT, SMALLINT, INTEGER map to number (via double)
    if (typeof rows[0].tiny !== 'number') throw new Error(`Expected tiny to be number, got ${typeof rows[0].tiny}`)
    if (typeof rows[0].small !== 'number') throw new Error(`Expected small to be number, got ${typeof rows[0].small}`)
    if (typeof rows[0].med !== 'number') throw new Error(`Expected med to be number, got ${typeof rows[0].med}`)
    // BIGINT maps to bigint
    if (typeof rows[0].big !== 'bigint') throw new Error(`Expected big to be bigint, got ${typeof rows[0].big}`)
    // FLOAT, DOUBLE map to number
    if (typeof rows[0].flt !== 'number') throw new Error(`Expected flt to be number, got ${typeof rows[0].flt}`)
    if (typeof rows[0].dbl !== 'number') throw new Error(`Expected dbl to be number, got ${typeof rows[0].dbl}`)
    // Value checks
    if (rows[0].tiny !== 42) throw new Error(`Expected tiny=42, got ${rows[0].tiny}`)
    if (rows[0].small !== 1000) throw new Error(`Expected small=1000, got ${rows[0].small}`)
    if (rows[0].med !== 100000) throw new Error(`Expected med=100000, got ${rows[0].med}`)
    if (rows[0].big !== BigInt('9007199254740993')) throw new Error(`Expected big=9007199254740993n, got ${rows[0].big}`)
    if (Math.abs((rows[0].flt as number) - 3.14) > 0.01) throw new Error(`Expected flt≈3.14, got ${rows[0].flt}`)
    if (Math.abs((rows[0].dbl as number) - 2.718281828) > 0.0001) throw new Error(`Expected dbl≈2.718, got ${rows[0].dbl}`)
  } finally {
    db.close()
  }
})
