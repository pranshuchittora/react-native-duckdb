import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Named Parameters', 'Basic named params — executeSyncNamed', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSyncNamed('SELECT $name AS name, $age AS age', { name: 'Alice', age: 30 })
    const rows = result.toRows()
    console.debug(`named sync: ${JSON.stringify(rows[0])}`)
    if (rows[0].name !== 'Alice') throw new Error(`Expected name='Alice', got ${rows[0].name}`)
    if (rows[0].age !== 30) throw new Error(`Expected age=30, got ${rows[0].age}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'Named params — executeNamed (async)', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = await db.executeNamed('SELECT $name AS name, $age AS age', { name: 'Bob', age: 25 })
    const rows = result.toRows()
    console.debug(`named async: ${JSON.stringify(rows[0])}`)
    if (rows[0].name !== 'Bob') throw new Error(`Expected name='Bob', got ${rows[0].name}`)
    if (rows[0].age !== 25) throw new Error(`Expected age=25, got ${rows[0].age}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'Named params with INSERT + SELECT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const ts = Date.now()
    db.executeSync(`CREATE TABLE np_ins_${ts} (id INTEGER, name VARCHAR)`)
    db.executeSyncNamed(`INSERT INTO np_ins_${ts} VALUES ($id, $name)`, { id: 1, name: 'Bob' })
    const result = db.executeSync(`SELECT * FROM np_ins_${ts}`)
    const rows = result.toRows()
    console.debug(`named insert roundtrip: ${JSON.stringify(rows[0])}`)
    if (rows[0].id !== 1) throw new Error(`Expected id=1, got ${rows[0].id}`)
    if (rows[0].name !== 'Bob') throw new Error(`Expected name='Bob', got ${rows[0].name}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'Named params with all types', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSyncNamed(
      'SELECT $bool AS b, $num AS n, $str AS s, $big AS bi, $nil AS nl',
      { bool: true, num: 3.14, str: 'hello', big: BigInt('9007199254740993'), nil: null }
    )
    const rows = result.toRows()
    console.debug(`named all types: b=${rows[0].b}(${typeof rows[0].b}), n=${rows[0].n}(${typeof rows[0].n}), s=${rows[0].s}(${typeof rows[0].s}), bi=${rows[0].bi}(${typeof rows[0].bi}), nl=${rows[0].nl}`)
    if (rows[0].b !== true) throw new Error(`Expected b=true, got ${rows[0].b}`)
    if (Math.abs((rows[0].n as number) - 3.14) > 0.001) throw new Error(`Expected n≈3.14, got ${rows[0].n}`)
    if (rows[0].s !== 'hello') throw new Error(`Expected s='hello', got ${rows[0].s}`)
    if (typeof rows[0].bi !== 'bigint') throw new Error(`Expected bi to be bigint, got ${typeof rows[0].bi}`)
    if (rows[0].bi !== BigInt('9007199254740993')) throw new Error(`Expected bi=9007199254740993n, got ${rows[0].bi}`)
    if (rows[0].nl !== null) throw new Error(`Expected nl=null, got ${rows[0].nl}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'PreparedStatement with named params', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const stmt = db.prepare('SELECT $x + $y AS sum')
    const syncResult = stmt.executeSyncNamed({ x: 10, y: 20 })
    const syncRows = syncResult.toRows()
    console.debug(`prepared named sync: sum=${syncRows[0].sum}`)
    if (syncRows[0].sum !== 30) throw new Error(`Expected sum=30, got ${syncRows[0].sum}`)

    const asyncResult = await stmt.executeNamed({ x: 100, y: 200 })
    const asyncRows = asyncResult.toRows()
    console.debug(`prepared named async: sum=${asyncRows[0].sum}`)
    if (asyncRows[0].sum !== 300) throw new Error(`Expected sum=300, got ${asyncRows[0].sum}`)

    stmt.finalize()
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'streamNamed', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const stream = await db.streamNamed('SELECT $val AS v', { val: 42 })
    const chunk = await stream.fetchChunk()
    if (!chunk) throw new Error('Expected at least one chunk')
    const rows = chunk.toRows()
    console.debug(`streamNamed: v=${rows[0].v}`)
    if (rows[0].v !== 42) throw new Error(`Expected v=42, got ${rows[0].v}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Named Parameters', 'Named params case-insensitive', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSyncNamed('SELECT $Name AS n', { name: 'test' })
    const rows = result.toRows()
    console.debug(`named case-insensitive: n=${rows[0].n}`)
    if (rows[0].n !== 'test') throw new Error(`Expected n='test', got ${rows[0].n}`)
  } finally {
    db.close()
  }
})
