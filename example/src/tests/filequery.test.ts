import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

// File query tests: Parquet, CSV, JSON
// On mobile, the cwd is '/' (read-only). We must use absolute paths for all
// COPY TO / FROM / SELECT FROM file operations. Pattern: open a file-based DB,
// get the DB directory via PRAGMA database_list, build absolute paths from that.
// Each test uses unique filenames (timestamp suffix) so tests always start fresh.

function getDbDir(db: ReturnType<typeof HybridDuckDB.open>): string {
  const result = db.executeSync('PRAGMA database_list')
  const dbPath = result.toRows()[0].file as string
  return dbPath.substring(0, dbPath.lastIndexOf('/'))
}

TestRegistry.registerTest('File Queries', 'Parquet: write and read via file path', async () => {
  const suffix = Date.now()
  const dbName = `test_filequery_${suffix}.db`
  const db = HybridDuckDB.open(dbName, {})
  try {
    const dir = getDbDir(db)
    const parquetPath = `${dir}/test_${suffix}.parquet`

    // Create test data
    db.executeSync(
      "CREATE TABLE test_parquet AS SELECT i AS id, 'name_' || i AS name, i * 1.5 AS value FROM range(100) t(i)"
    )

    // Export to Parquet
    db.executeSync(`COPY test_parquet TO '${parquetPath}' (FORMAT PARQUET)`)

    // Query the Parquet file directly
    const countResult = db.executeSync(`SELECT count(*) as cnt FROM '${parquetPath}'`)
    const cnt = Number(countResult.toRows()[0].cnt)
    if (cnt !== 100) throw new Error(`Expected 100 rows, got ${cnt}`)

    // Filtered query on Parquet file
    const filtered = db.executeSync(`SELECT * FROM '${parquetPath}' WHERE id = 50`)
    const rows = filtered.toRows()
    if (rows.length !== 1) throw new Error(`Expected 1 row for id=50, got ${rows.length}`)
    if (rows[0].name !== 'name_50') throw new Error(`Expected name='name_50', got ${rows[0].name}`)
    console.debug(`Parquet read: ${cnt} rows, filtered name=${rows[0].name}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})

TestRegistry.registerTest('File Queries', 'CSV: write and read via read_csv', async () => {
  // CSV reading is BUILT-IN — no extension needed
  const suffix = Date.now()
  const dbName = `test_csv_fq_${suffix}.db`
  const db = HybridDuckDB.open(dbName, {})
  try {
    const dir = getDbDir(db)
    const csvPath = `${dir}/test_${suffix}.csv`

    db.executeSync(
      "CREATE TABLE test_csv AS SELECT i AS id, 'item_' || i AS label FROM range(50) t(i)"
    )

    // Export to CSV with header
    db.executeSync(`COPY test_csv TO '${csvPath}' (FORMAT CSV, HEADER)`)

    // Read back via read_csv
    const countResult = db.executeSync(`SELECT count(*) as cnt FROM read_csv('${csvPath}')`)
    const cnt = Number(countResult.toRows()[0].cnt)
    if (cnt !== 50) throw new Error(`Expected 50 rows, got ${cnt}`)

    // Filtered query with auto-detection
    const filtered = db.executeSync(`SELECT * FROM read_csv('${csvPath}') WHERE id = 25`)
    const rows = filtered.toRows()
    if (rows.length !== 1) throw new Error(`Expected 1 row for id=25, got ${rows.length}`)
    if (rows[0].label !== 'item_25') throw new Error(`Expected label='item_25', got ${rows[0].label}`)
    console.debug(`CSV read: ${cnt} rows, filtered label=${rows[0].label}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})

TestRegistry.registerTest('File Queries', 'JSON: write and read via read_json', async () => {
  // JSON reading requires the `json` extension
  const suffix = Date.now()
  const dbName = `test_json_fq_${suffix}.db`
  const db = HybridDuckDB.open(dbName, {})
  try {
    const dir = getDbDir(db)
    const jsonPath = `${dir}/test_${suffix}.json`

    db.executeSync(
      "CREATE TABLE test_json AS SELECT i AS id, 'record_' || i AS tag FROM range(30) t(i)"
    )

    // Export to JSON
    db.executeSync(`COPY test_json TO '${jsonPath}' (FORMAT JSON)`)

    // Read back via read_json
    const countResult = db.executeSync(`SELECT count(*) as cnt FROM read_json('${jsonPath}')`)
    const cnt = Number(countResult.toRows()[0].cnt)
    if (cnt !== 30) throw new Error(`Expected 30 rows, got ${cnt}`)

    // Filtered query
    const filtered = db.executeSync(`SELECT * FROM read_json('${jsonPath}') WHERE id = 15`)
    const rows = filtered.toRows()
    if (rows.length !== 1) throw new Error(`Expected 1 row for id=15, got ${rows.length}`)
    if (rows[0].tag !== 'record_15') throw new Error(`Expected tag='record_15', got ${rows[0].tag}`)
    console.debug(`JSON read: ${cnt} rows, filtered tag=${rows[0].tag}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})

TestRegistry.registerTest('File Queries', 'Parquet: query with aggregation', async () => {
  const suffix = Date.now()
  const dbName = `test_parquet_agg_${suffix}.db`
  const db = HybridDuckDB.open(dbName, {})
  try {
    const dir = getDbDir(db)
    const parquetPath = `${dir}/agg_${suffix}.parquet`

    db.executeSync(
      'CREATE TABLE agg_data AS SELECT i AS id, (i * 2.5) AS amount FROM range(100) t(i)'
    )
    db.executeSync(`COPY agg_data TO '${parquetPath}' (FORMAT PARQUET)`)

    // Aggregate directly on Parquet file
    const result = db.executeSync(
      `SELECT sum(amount) as total, avg(amount) as average FROM '${parquetPath}'`
    )
    const row = result.toRows()[0]
    const total = Number(row.total)
    const average = Number(row.average)

    // sum of i*2.5 for i=0..99 = 2.5 * (99*100/2) = 12375
    if (Math.abs(total - 12375) > 0.01) throw new Error(`Expected total~12375, got ${total}`)
    // avg = 12375 / 100 = 123.75
    if (Math.abs(average - 123.75) > 0.01) throw new Error(`Expected avg~123.75, got ${average}`)
    console.debug(`Parquet aggregation: total=${total}, avg=${average}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})

TestRegistry.registerTest('File Queries', 'CSV: read with custom options', async () => {
  const suffix = Date.now()
  const dbName = `test_csv_custom_${suffix}.db`
  const db = HybridDuckDB.open(dbName, {})
  try {
    const dir = getDbDir(db)
    const csvPath = `${dir}/pipe_${suffix}.csv`

    db.executeSync(
      'CREATE TABLE custom_csv AS SELECT i AS col1, \'val_\' || i AS col2 FROM range(20) t(i)'
    )

    // Export with pipe delimiter and no header
    db.executeSync(`COPY custom_csv TO '${csvPath}' (FORMAT CSV, DELIMITER '|', HEADER false)`)

    // Read back with matching custom options
    const result = db.executeSync(
      `SELECT * FROM read_csv('${csvPath}', delim='|', header=false, columns={'col1': 'INTEGER', 'col2': 'VARCHAR'})`
    )
    const rows = result.toRows()
    if (rows.length !== 20) throw new Error(`Expected 20 rows, got ${rows.length}`)
    if (Number(rows[0].col1) !== 0) throw new Error(`Expected col1=0, got ${rows[0].col1}`)
    if (rows[0].col2 !== 'val_0') throw new Error(`Expected col2='val_0', got ${rows[0].col2}`)
    console.debug(`CSV custom options: ${rows.length} rows, first=${rows[0].col1}|${rows[0].col2}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})
