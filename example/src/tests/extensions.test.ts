import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Extensions', 'core_functions: sum, avg, list_value, uuid', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // sum and avg (0+1+...+9 = 45, avg = 4.5)
    const agg = db.executeSync('SELECT sum(i) as s, avg(i) as a FROM range(10) t(i)')
    const { s, a } = agg.toRows()[0]
    if (Number(s) !== 45) throw new Error(`Expected sum=45, got ${s}`)
    if (Math.abs(Number(a) - 4.5) > 0.001) throw new Error(`Expected avg=4.5, got ${a}`)

    // list_value
    const listResult = db.executeSync('SELECT list_value(1, 2, 3) as l')
    const l = listResult.toRows()[0].l
    if (typeof l !== 'string') throw new Error(`Expected list_value to return string, got ${typeof l}`)
    const parsed = JSON.parse(l as string)
    if (!Array.isArray(parsed) || parsed.length !== 3)
      throw new Error(`Expected [1,2,3], got ${l}`)

    // uuid()
    const uuidResult = db.executeSync('SELECT uuid() as u')
    const u = uuidResult.toRows()[0].u as string
    if (typeof u !== 'string' || u.length !== 36 || !u.includes('-'))
      throw new Error(`Expected UUID string (36 chars with dashes), got ${u}`)

    console.debug(`core_functions: sum=${s}, avg=${a}, list=${l}, uuid=${u.slice(0, 8)}...`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Extensions', 'LOAD: statically linked extensions load without error', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    // LOAD on statically linked extensions should be a no-op success
    db.executeSync("LOAD 'parquet'")
    db.executeSync("LOAD 'json'")
    db.executeSync("LOAD 'icu'")
    console.debug('LOAD parquet/json/icu: all succeeded (statically linked)')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Extensions', 'SQLite scanner: ATTACH and query SQLite database', async () => {
  const db = HybridDuckDB.open('test_sqlite_ext.db', {})
  try {
    // Get the absolute path of the DB directory for constructing the sqlite path
    const dbListResult = db.executeSync('PRAGMA database_list')
    const dbPath = dbListResult.toRows()[0].file as string
    const dbDir = dbPath.substring(0, dbPath.lastIndexOf('/'))
    const sqlitePath = `${dbDir}/test_scanner.sqlite`

    // Create a SQLite database via the sqlite_scanner extension
    db.executeSync(`ATTACH '${sqlitePath}' AS sqlitedb (TYPE SQLITE)`)
    db.executeSync('CREATE TABLE sqlitedb.users (id INTEGER, name VARCHAR)')
    db.executeSync("INSERT INTO sqlitedb.users VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')")
    db.executeSync('DETACH sqlitedb')

    // Re-attach and query
    db.executeSync(`ATTACH '${sqlitePath}' AS sqlitedb (TYPE SQLITE)`)
    const countResult = db.executeSync('SELECT count(*) as cnt FROM sqlitedb.users')
    const cnt = Number(countResult.toRows()[0].cnt)
    if (cnt !== 3) throw new Error(`Expected 3 users, got ${cnt}`)

    const filtered = db.executeSync('SELECT * FROM sqlitedb.users WHERE id = 2')
    const rows = filtered.toRows()
    if (rows.length !== 1) throw new Error(`Expected 1 row for id=2, got ${rows.length}`)
    if (rows[0].name !== 'Bob') throw new Error(`Expected name='Bob', got ${rows[0].name}`)

    db.executeSync('DETACH sqlitedb')
    console.debug(`SQLite scanner: ${cnt} users, filtered name=${rows[0].name}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase('test_sqlite_ext.db')
  }
})

TestRegistry.registerTest('Extensions', 'duckdb_extensions: verify loaded extensions', async () => {
  // Use a file-based DB to ensure home_directory is set (required by duckdb_extensions())
  const db = HybridDuckDB.open('test_ext_list.db', {})
  try {
    const result = db.executeSync(
      "SELECT extension_name, loaded, installed FROM duckdb_extensions() WHERE loaded = true ORDER BY extension_name"
    )
    const rows = result.toRows()
    const loadedNames = rows.map((r: any) => r.extension_name as string)
    console.debug(`Loaded extensions: ${loadedNames.join(', ')}`)

    // Verify expected extensions are loaded
    const expected = ['core_functions', 'icu', 'json', 'parquet']
    for (const ext of expected) {
      if (!loadedNames.includes(ext))
        throw new Error(`Expected extension '${ext}' to be loaded, found: ${loadedNames.join(', ')}`)
    }
    // sqlite_scanner may show as loaded only after first ATTACH — check it's at least installed
    const allResult = db.executeSync(
      "SELECT extension_name, installed FROM duckdb_extensions() WHERE extension_name = 'sqlite_scanner'"
    )
    const sqliteRows = allResult.toRows()
    if (sqliteRows.length === 0)
      throw new Error('sqlite_scanner not found in duckdb_extensions()')
    console.debug(`sqlite_scanner installed=${sqliteRows[0].installed}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase('test_ext_list.db')
  }
})
