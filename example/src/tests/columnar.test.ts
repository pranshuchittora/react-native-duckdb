import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'
import type { NumericColumn } from 'react-native-duckdb'

TestRegistry.registerTest('Columnar Access', 'Numeric column typed array', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE num_col (x INTEGER)')
    db.executeSync('INSERT INTO num_col VALUES (1), (2), (3)')
    const result = db.executeSync('SELECT x FROM num_col ORDER BY x')
    const col = result.getColumn(0)

    if (!('data' in col) || !('validity' in col) || !('dtype' in col))
      throw new Error(`Expected NumericColumn, got ${JSON.stringify(col)}`)
    const nc = col as NumericColumn
    if (nc.dtype !== 'float64') throw new Error(`Expected dtype='float64', got ${nc.dtype}`)

    const data = new Float64Array(nc.data)
    const validity = new Uint8Array(nc.validity)
    console.debug(`numeric col: data=[${data[0]},${data[1]},${data[2]}], validity=[${validity[0]},${validity[1]},${validity[2]}]`)

    if (data[0] !== 1 || data[1] !== 2 || data[2] !== 3)
      throw new Error(`Expected data=[1,2,3], got [${data[0]},${data[1]},${data[2]}]`)
    if (validity[0] !== 1 || validity[1] !== 1 || validity[2] !== 1)
      throw new Error(`Expected all valid, got [${validity[0]},${validity[1]},${validity[2]}]`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Columnar Access', 'BigInt column typed array', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE big_col (x BIGINT)')
    db.executeSync("INSERT INTO big_col VALUES (9007199254740993), (9007199254740994), (9007199254740995)")
    const result = db.executeSync('SELECT x FROM big_col ORDER BY x')
    const col = result.getColumn(0)

    if (!('data' in col) || !('dtype' in col))
      throw new Error(`Expected NumericColumn for BIGINT, got ${JSON.stringify(col)}`)
    const nc = col as NumericColumn
    if (nc.dtype !== 'bigint64') throw new Error(`Expected dtype='bigint64', got ${nc.dtype}`)

    const data = new BigInt64Array(nc.data)
    console.debug(`bigint col: data=[${data[0]},${data[1]},${data[2]}]`)

    if (data[0] !== BigInt('9007199254740993'))
      throw new Error(`Expected data[0]=9007199254740993n, got ${data[0]}`)
    if (data[1] !== BigInt('9007199254740994'))
      throw new Error(`Expected data[1]=9007199254740994n, got ${data[1]}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Columnar Access', 'Boolean column typed array', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE bool_col (x BOOLEAN)')
    db.executeSync('INSERT INTO bool_col VALUES (true), (false), (true)')
    const result = db.executeSync('SELECT x FROM bool_col')
    const col = result.getColumn(0)

    if (!('data' in col) || !('dtype' in col))
      throw new Error(`Expected NumericColumn for BOOLEAN, got ${JSON.stringify(col)}`)
    const nc = col as NumericColumn
    if (nc.dtype !== 'uint8') throw new Error(`Expected dtype='uint8', got ${nc.dtype}`)

    const data = new Uint8Array(nc.data)
    console.debug(`bool col: data=[${data[0]},${data[1]},${data[2]}]`)

    if (data[0] !== 1 || data[1] !== 0 || data[2] !== 1)
      throw new Error(`Expected [1,0,1], got [${data[0]},${data[1]},${data[2]}]`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Columnar Access', 'String column returns string array', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE str_col (x VARCHAR)')
    db.executeSync("INSERT INTO str_col VALUES ('hello'), ('world'), ('test')")
    const result = db.executeSync('SELECT x FROM str_col')
    const col = result.getColumn(0)

    if (!Array.isArray(col))
      throw new Error(`Expected string array for VARCHAR, got ${typeof col}`)
    console.debug(`string col: ${JSON.stringify(col)}`)

    if (col[0] !== 'hello' || col[1] !== 'world' || col[2] !== 'test')
      throw new Error(`Expected ['hello','world','test'], got ${JSON.stringify(col)}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Columnar Access', 'Null handling in typed arrays', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE null_col (x INTEGER)')
    db.executeSync('INSERT INTO null_col VALUES (1), (NULL), (3)')
    const result = db.executeSync('SELECT x FROM null_col')
    const col = result.getColumn(0)

    if (!('data' in col) || !('validity' in col))
      throw new Error(`Expected NumericColumn, got ${JSON.stringify(col)}`)
    const nc = col as NumericColumn
    const data = new Float64Array(nc.data)
    const validity = new Uint8Array(nc.validity)
    console.debug(`null col: data=[${data[0]},${data[1]},${data[2]}], validity=[${validity[0]},${validity[1]},${validity[2]}]`)

    if (validity[0] !== 1) throw new Error(`Expected validity[0]=1, got ${validity[0]}`)
    if (validity[1] !== 0) throw new Error(`Expected validity[1]=0 (NULL), got ${validity[1]}`)
    if (validity[2] !== 1) throw new Error(`Expected validity[2]=1, got ${validity[2]}`)
    if (data[0] !== 1) throw new Error(`Expected data[0]=1, got ${data[0]}`)
    if (data[2] !== 3) throw new Error(`Expected data[2]=3, got ${data[2]}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Columnar Access', 'Typed array matches row access', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE match_col (x DOUBLE)')
    db.executeSync('INSERT INTO match_col VALUES (3.14), (2.718), (1.414)')
    const result = db.executeSync('SELECT x FROM match_col ORDER BY x')
    const rows = result.toRows()
    const col = result.getColumn(0)

    if (!('data' in col))
      throw new Error(`Expected NumericColumn for DOUBLE, got ${typeof col}`)
    const nc = col as NumericColumn
    const data = new Float64Array(nc.data)

    for (let i = 0; i < 3; i++) {
      const rowVal = rows[i].x as number
      if (Math.abs(data[i] - rowVal) > 0.0001)
        throw new Error(`Mismatch at index ${i}: column=${data[i]}, row=${rowVal}`)
    }
    console.debug(`match: all ${rows.length} values match between columnar and row access`)
  } finally {
    db.close()
  }
})
