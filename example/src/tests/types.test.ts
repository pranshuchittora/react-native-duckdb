import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Type System', 'Temporal — DATE, TIME, TIMESTAMP', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync(
      "SELECT DATE '2024-03-15' as d, TIME '10:30:00' as t, TIMESTAMP '2024-03-15 10:30:00' as ts"
    )
    const rows = result.toRows()
    const { d, t, ts } = rows[0]
    console.debug(`temporal: d=${d}(${typeof d}), t=${t}(${typeof t}), ts=${ts}(${typeof ts})`)

    if (typeof d !== 'string') throw new Error(`Expected d to be string, got ${typeof d}`)
    if (d !== '2024-03-15') throw new Error(`Expected d='2024-03-15', got ${d}`)

    if (typeof t !== 'string') throw new Error(`Expected t to be string, got ${typeof t}`)
    if (t !== '10:30:00') throw new Error(`Expected t='10:30:00', got ${t}`)

    if (typeof ts !== 'string') throw new Error(`Expected ts to be string, got ${typeof ts}`)
    if (!(ts as string).includes('2024-03-15T10:30:00'))
      throw new Error(`Expected ts to contain '2024-03-15T10:30:00', got ${ts}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Temporal — TIMESTAMP_TZ, INTERVAL', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync(
      "SELECT TIMESTAMPTZ '2024-03-15 10:30:00+00' as tstz, INTERVAL '1 year 2 months 3 days' as iv"
    )
    const rows = result.toRows()
    const { tstz, iv } = rows[0]
    console.debug(`temporal2: tstz=${tstz}(${typeof tstz}), iv=${iv}(${typeof iv})`)

    if (typeof tstz !== 'string') throw new Error(`Expected tstz to be string, got ${typeof tstz}`)
    if (!(tstz as string).includes('2024-03-15T10:30:00'))
      throw new Error(`Expected tstz to contain '2024-03-15T10:30:00', got ${tstz}`)

    if (typeof iv !== 'string') throw new Error(`Expected iv to be string, got ${typeof iv}`)
    if (!(iv as string).includes('year') && !(iv as string).includes('month'))
      throw new Error(`Expected iv to contain 'year' or 'month', got ${iv}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Temporal round-trip — insert and select', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE temporal_rt (d DATE, t TIME, ts TIMESTAMP)')
    db.executeSync("INSERT INTO temporal_rt VALUES (DATE '2024-06-01', TIME '14:30:00', TIMESTAMP '2024-06-01 14:30:00')")
    const result = db.executeSync('SELECT * FROM temporal_rt')
    const rows = result.toRows()
    const { d, t, ts } = rows[0]
    console.debug(`temporal_rt: d=${d}, t=${t}, ts=${ts}`)

    if (d !== '2024-06-01') throw new Error(`Expected d='2024-06-01', got ${d}`)
    if (t !== '14:30:00') throw new Error(`Expected t='14:30:00', got ${t}`)
    if (!(ts as string).includes('2024-06-01T14:30:00'))
      throw new Error(`Expected ts to contain '2024-06-01T14:30:00', got ${ts}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Complex — LIST and ARRAY', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE list_test (list_val INTEGER[], arr_val INTEGER[3])')
    db.executeSync("INSERT INTO list_test SELECT CAST('[1,2,3]' AS INTEGER[]), CAST('[4,5,6]' AS INTEGER[3])")
    const result = db.executeSync('SELECT * FROM list_test')
    const rows = result.toRows()
    const { list_val, arr_val } = rows[0]
    console.debug(`complex list/array: list_val=${list_val}(${typeof list_val}), arr_val=${arr_val}(${typeof arr_val})`)

    if (typeof list_val !== 'string') throw new Error(`Expected list_val to be string, got ${typeof list_val}`)
    const parsedList = JSON.parse(list_val as string)
    if (!Array.isArray(parsedList)) throw new Error(`Expected parsed list to be array, got ${typeof parsedList}`)
    if (parsedList[0] !== 1 || parsedList[1] !== 2 || parsedList[2] !== 3)
      throw new Error(`Expected [1,2,3], got ${JSON.stringify(parsedList)}`)

    if (typeof arr_val !== 'string') throw new Error(`Expected arr_val to be string, got ${typeof arr_val}`)
    const parsedArr = JSON.parse(arr_val as string)
    if (!Array.isArray(parsedArr)) throw new Error(`Expected parsed array to be array`)
    if (parsedArr[0] !== 4 || parsedArr[1] !== 5 || parsedArr[2] !== 6)
      throw new Error(`Expected [4,5,6], got ${JSON.stringify(parsedArr)}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Complex — STRUCT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync("SELECT {'name': 'alice', 'age': 30} as struct_val")
    const rows = result.toRows()
    const { struct_val } = rows[0]
    console.debug(`struct: struct_val=${struct_val}(${typeof struct_val})`)

    if (typeof struct_val !== 'string') throw new Error(`Expected struct_val to be string, got ${typeof struct_val}`)
    const parsed = JSON.parse(struct_val as string)
    if (parsed.name !== 'alice') throw new Error(`Expected name='alice', got ${parsed.name}`)
    if (parsed.age !== 30) throw new Error(`Expected age=30, got ${parsed.age}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Complex — MAP', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE map_test (map_val MAP(VARCHAR, VARCHAR))')
    db.executeSync("INSERT INTO map_test VALUES ('{key1=value1, key2=value2}')")
    const result = db.executeSync('SELECT * FROM map_test')
    const rows = result.toRows()
    const { map_val } = rows[0]
    console.debug(`map: map_val=${map_val}(${typeof map_val})`)

    if (typeof map_val !== 'string') throw new Error(`Expected map_val to be string, got ${typeof map_val}`)
    const parsed = JSON.parse(map_val as string)
    if (!Array.isArray(parsed)) throw new Error(`Expected parsed MAP to be array, got ${typeof parsed}`)
    if (parsed.length !== 2) throw new Error(`Expected 2 entries, got ${parsed.length}`)
    const entry1 = parsed.find((e: any) => e.key === 'key1')
    const entry2 = parsed.find((e: any) => e.key === 'key2')
    if (!entry1) throw new Error(`Missing key1 entry, got ${JSON.stringify(parsed)}`)
    if (entry1.value !== 'value1') throw new Error(`Expected value1, got ${entry1.value}`)
    if (!entry2) throw new Error(`Missing key2 entry, got ${JSON.stringify(parsed)}`)
    if (entry2.value !== 'value2') throw new Error(`Expected value2, got ${entry2.value}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Complex — nested LIST of STRUCT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE nested_test (nested STRUCT(name VARCHAR, score INTEGER)[])')
    db.executeSync(`INSERT INTO nested_test VALUES ('[{"name": "alice", "score": 95}, {"name": "bob", "score": 87}]')`)
    const result = db.executeSync('SELECT * FROM nested_test')
    const rows = result.toRows()
    const { nested } = rows[0]
    console.debug(`nested: ${nested}(${typeof nested})`)

    if (typeof nested !== 'string') throw new Error(`Expected nested to be string, got ${typeof nested}`)
    const parsed = JSON.parse(nested as string)
    if (!Array.isArray(parsed)) throw new Error(`Expected parsed to be array`)
    if (parsed.length !== 2) throw new Error(`Expected 2 elements, got ${parsed.length}`)
    if (parsed[0].name !== 'alice') throw new Error(`Expected [0].name='alice', got ${parsed[0].name}`)
    if (parsed[0].score !== 95) throw new Error(`Expected [0].score=95, got ${parsed[0].score}`)
    if (parsed[1].name !== 'bob') throw new Error(`Expected [1].name='bob', got ${parsed[1].name}`)
    if (parsed[1].score !== 87) throw new Error(`Expected [1].score=87, got ${parsed[1].score}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Complex — UNION', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync("CREATE TABLE union_test (u UNION(name VARCHAR, age INTEGER))")
    db.executeSync("INSERT INTO union_test VALUES ('Frank')")
    const result = db.executeSync('SELECT * FROM union_test')
    const rows = result.toRows()
    const { u } = rows[0]
    console.debug(`union: u=${u}(${typeof u})`)

    if (typeof u !== 'string') throw new Error(`Expected u to be string, got ${typeof u}`)
    const parsed = JSON.parse(u as string)
    if (parsed.tag !== 'name') throw new Error(`Expected tag='name', got ${parsed.tag}`)
    if (parsed.value !== 'Frank') throw new Error(`Expected value='Frank', got ${parsed.value}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Special — UUID', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync("SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID as id")
    const rows = result.toRows()
    const { id } = rows[0]
    console.debug(`uuid: id=${id}(${typeof id})`)

    if (typeof id !== 'string') throw new Error(`Expected id to be string, got ${typeof id}`)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id as string))
      throw new Error(`Expected UUID format, got ${id}`)
    if (id !== 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      throw new Error(`Expected exact UUID, got ${id}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Special — ENUM', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync("CREATE TYPE mood AS ENUM ('happy', 'sad', 'neutral')")
    const result = db.executeSync("SELECT 'happy'::mood as m")
    const rows = result.toRows()
    const { m } = rows[0]
    console.debug(`enum: m=${m}(${typeof m})`)

    if (typeof m !== 'string') throw new Error(`Expected m to be string, got ${typeof m}`)
    if (m !== 'happy') throw new Error(`Expected m='happy', got ${m}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Special — BIT', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync("SELECT '10110'::BIT as b")
    const rows = result.toRows()
    const { b } = rows[0]
    console.debug(`bit: b=${b}(${typeof b})`)

    if (typeof b !== 'string') throw new Error(`Expected b to be string, got ${typeof b}`)
    if (b !== '10110') throw new Error(`Expected b='10110', got ${b}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'HUGEINT — lossless string', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync(
      'SELECT 170141183460469231731687303715884105727::HUGEINT as h'
    )
    const rows = result.toRows()
    const { h } = rows[0]
    console.debug(`hugeint: h=${h}(${typeof h})`)

    if (typeof h !== 'string') throw new Error(`Expected h to be string, got ${typeof h}`)
    if (h !== '170141183460469231731687303715884105727')
      throw new Error(`Expected full HUGEINT string, got ${h}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'DECIMAL — lossless string', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const r1 = db.executeSync('SELECT 12345.6789::DECIMAL(10,4) as d')
    const rows1 = r1.toRows()
    console.debug(`decimal: d=${rows1[0].d}(${typeof rows1[0].d})`)

    if (typeof rows1[0].d !== 'string') throw new Error(`Expected d to be string, got ${typeof rows1[0].d}`)
    if (rows1[0].d !== '12345.6789') throw new Error(`Expected '12345.6789', got ${rows1[0].d}`)

    const r2 = db.executeSync('SELECT 12345678901234567890.1234567890::DECIMAL(30,10) as d')
    const rows2 = r2.toRows()
    console.debug(`decimal high prec: d=${rows2[0].d}(${typeof rows2[0].d})`)

    if (typeof rows2[0].d !== 'string') throw new Error(`Expected high-prec d to be string, got ${typeof rows2[0].d}`)
    if (!(rows2[0].d as string).includes('12345678901234567890'))
      throw new Error(`Expected lossless high-prec decimal, got ${rows2[0].d}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Type System', 'Null handling across types', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const result = db.executeSync(
      'SELECT NULL::DATE as d, NULL::INTEGER[] as l, NULL::UUID as u'
    )
    const rows = result.toRows()
    console.debug(`nulls: d=${rows[0].d}, l=${rows[0].l}, u=${rows[0].u}`)

    if (rows[0].d !== null) throw new Error(`Expected d=null, got ${rows[0].d}`)
    if (rows[0].l !== null) throw new Error(`Expected l=null, got ${rows[0].l}`)
    if (rows[0].u !== null) throw new Error(`Expected u=null, got ${rows[0].u}`)
  } finally {
    db.close()
  }
})
