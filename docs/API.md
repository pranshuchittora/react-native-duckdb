# API Reference

Complete API reference for react-native-duckdb. Every public method, property, and type definition.

For installation and setup, see the [README](../README.md). For guides on specific features, see the [documentation index](README.md).

---

## DuckDB Factory

The `HybridDuckDB` singleton is the entry point. It provides path constants and the `open()` method for creating database instances.

```ts
import { HybridDuckDB } from 'react-native-duckdb'
```

---

### `version`

The DuckDB engine version string.

**Type:** `string` (readonly)

```ts
console.log(HybridDuckDB.version) // "1.4.4"
```

---

### `documentsPath`

The app's documents directory path. Files here persist across app restarts and are included in backups.

**Type:** `string` (readonly)

```ts
const docsDir = HybridDuckDB.documentsPath
// iOS: /var/mobile/Containers/Data/Application/.../Documents
// Android: /data/data/com.example/files
```

---

### `libraryPath`

The app's library/cache directory path.

**Type:** `string` (readonly)

```ts
const libDir = HybridDuckDB.libraryPath
// iOS: /var/mobile/Containers/Data/Application/.../Library
// Android: /data/data/com.example/cache
```

---

### `databasePath`

The platform-specific database directory path.

**Type:** `string` (readonly)

```ts
const dbDir = HybridDuckDB.databasePath
// iOS: /var/mobile/Containers/Data/Application/.../Documents
// Android: /data/data/com.example/databases
```

---

### `externalStoragePath`

External storage directory path. Android only — returns `""` on iOS.

**Type:** `string` (readonly)

```ts
const extDir = HybridDuckDB.externalStoragePath
// Android: /storage/emulated/0/Android/data/com.example/files
// iOS: ""
```

---

### `defaultPath`

The recommended default path for database files. Alias for `databasePath`.

**Type:** `string` (readonly)

```ts
const path = HybridDuckDB.defaultPath
```

---

### Named Path Constants

The same path values are available as module-level constants:

```ts
import {
  DOCUMENTS_PATH,
  LIBRARY_PATH,
  DATABASE_PATH,
  EXTERNAL_STORAGE_PATH,
  DEFAULT_PATH,
} from 'react-native-duckdb'
```

---

### `open(path, config)`

Opens or creates a DuckDB database. Returns a `Database` handle.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | `string` | Yes | File path for persistent database, or `":memory:"` for in-memory |
| config | `Record<string, string>` | Yes | DuckDB configuration options. Pass `{}` for defaults. |

**Returns:** `Database`

```ts
// In-memory database
const db = HybridDuckDB.open(':memory:', {})

// Persistent database with custom config
const db = HybridDuckDB.open(`${HybridDuckDB.defaultPath}/my.db`, {
  threads: '2',
  memory_limit: '256MB',
})
```

> **Note:** Both arguments are required. Always pass at least `{}` for config.

---

### `deleteDatabase(path)`

Deletes a persistent database file and its WAL/journal files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | `string` | Yes | Path to the database file to delete |

**Returns:** `void`

```ts
HybridDuckDB.deleteDatabase(`${HybridDuckDB.defaultPath}/my.db`)
```

---

## Database

The `Database` handle returned by `HybridDuckDB.open()`. Provides query execution, streaming, prepared statements, appender, and connection management.

### Core

---

### `isOpen`

Whether the database connection is currently open.

**Type:** `boolean` (readonly)

```ts
if (db.isOpen) {
  db.executeSync('SELECT 1')
}
```

---

### `close(options?)`

Closes the database connection and releases resources. Safe to call multiple times.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| options | `CloseOptions` | No | `{ force?: boolean }` — force close even with active connections |

**Returns:** `void`

```ts
db.close()

// Force close (closes child connections too)
db.close({ force: true })
```

---

### Execute

---

### `executeSync(sql, params?)`

Executes a SQL statement synchronously on the JS thread. Blocks until complete.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement |
| params | `DuckDBValue[]` | No | Positional parameters for `$1`, `$2`, `?` placeholders |

**Returns:** `QueryResult`

```ts
const result = db.executeSync('SELECT * FROM users WHERE age > ?', [21])
const rows = result.toRows()
```

---

### `execute(sql, params?, options?)`

Executes a SQL statement asynchronously. Does not block the JS thread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement |
| params | `DuckDBValue[]` | No | Positional parameters |
| options | `ExecuteOptions` | No | `{ onProgress?: (percentage: number) => void }` |

**Returns:** `Promise<QueryResult>`

```ts
const result = await db.execute('SELECT * FROM large_table')

// With progress tracking
const result = await db.execute(
  'SELECT count(*) FROM t1 JOIN t2 ON t1.id = t2.id',
  undefined,
  { onProgress: (pct) => console.log(`${Math.round(pct)}%`) }
)
```

---

### Named Parameter Execution

---

### `executeSyncNamed(sql, params)`

Executes a SQL statement synchronously with named parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement with `$name` placeholders |
| params | `Record<string, DuckDBValue>` | Yes | Named parameter values |

**Returns:** `QueryResult`

```ts
const result = db.executeSyncNamed(
  'SELECT * FROM users WHERE name = $name AND age > $age',
  { name: 'Alice', age: 21 }
)
```

---

### `executeNamed(sql, params, options?)`

Executes a SQL statement asynchronously with named parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement with `$name` placeholders |
| params | `Record<string, DuckDBValue>` | Yes | Named parameter values |
| options | `ExecuteOptions` | No | `{ onProgress?: (percentage: number) => void }` |

**Returns:** `Promise<QueryResult>`

```ts
const result = await db.executeNamed(
  'INSERT INTO events (type, payload) VALUES ($type, $payload)',
  { type: 'click', payload: '{"x": 100}' }
)
```

---

### Prepared Statements

---

### `prepare(sql)`

Creates a prepared statement for repeated execution with different parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement with parameter placeholders |

**Returns:** `PreparedStatement`

```ts
const stmt = db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)')
stmt.executeSync(['info', 'App started'])
stmt.executeSync(['warn', 'Low memory'])
stmt.finalize()
```

> **Important:** Always call `finalize()` when done. The prepared statement holds a reference to the connection.

---

### Streaming

---

### `stream(sql, params?, options?)`

Executes a query and returns a streaming result for chunk-by-chunk processing. Uses a dedicated connection internally.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement |
| params | `DuckDBValue[]` | No | Positional parameters |
| options | `ExecuteOptions` | No | `{ onProgress?: (percentage: number) => void }` |

**Returns:** `Promise<StreamingResult>`

```ts
const stream = await db.stream('SELECT * FROM large_table')
while (true) {
  const chunk = await stream.fetchChunk()
  if (!chunk) break
  processRows(chunk.toRows())
}
```

---

### `streamNamed(sql, params, options?)`

Executes a streaming query with named parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sql | `string` | Yes | SQL statement with `$name` placeholders |
| params | `Record<string, DuckDBValue>` | Yes | Named parameter values |
| options | `ExecuteOptions` | No | `{ onProgress?: (percentage: number) => void }` |

**Returns:** `Promise<StreamingResult>`

```ts
const stream = await db.streamNamed(
  'SELECT * FROM events WHERE type = $type',
  { type: 'click' }
)
```

---

### Appender

---

### `createAppender(table, options?)`

Creates a bulk data appender for fast inserts. Bypasses the SQL parser and writes directly to column storage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| table | `string` | Yes | Target table name (must already exist) |
| options | `AppenderOptions` | No | `{ flushEvery?: number }` — auto-flush after N rows |

**Returns:** `Appender`

```ts
const appender = db.createAppender('measurements')
appender.appendRows(data)
appender.close()

// With auto-flush
const appender = db.createAppender('measurements', { flushEvery: 10000 })
```

---

### Control

---

### `cancel()`

Cancels any currently executing query on this connection.

**Returns:** `void`

```ts
// Start a long query
const promise = db.execute('SELECT * FROM huge_cross_join')

// Cancel it
setTimeout(() => db.cancel(), 100)
```

---

### `getProfilingInfo()`

Returns profiling information for the most recently executed query. Enable profiling first with `PRAGMA enable_profiling`.

**Returns:** `string`

```ts
db.executeSync('PRAGMA enable_profiling')
db.executeSync('SELECT count(*) FROM large_table')
const info = db.getProfilingInfo()
console.log(info)
```

---

### `setProgressCallback(callback)`

Sets a per-connection progress callback that fires for all async queries. Progress is reported as a percentage (0–100).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| callback | `(percentage: number) => void` | Yes | Called with progress percentage |

**Returns:** `void`

```ts
db.setProgressCallback((pct) => {
  updateProgressBar(pct)
})
```

> Per-query `onProgress` in `ExecuteOptions` overrides the per-connection callback for that query.

---

### `removeProgressCallback()`

Removes the per-connection progress callback.

**Returns:** `void`

```ts
db.removeProgressCallback()
```

---

### Multi-Database

---

### `connect()`

Creates a new child connection sharing the same underlying database. Useful for concurrent operations.

**Returns:** `Database`

```ts
const child = db.connect()
const result = child.executeSync('SELECT 1')
child.close()
```

> Only the primary connection (returned by `open()`) can call `connect()`, `connections()`, and `closeConnections()`.

---

### `connections()`

Returns information about active connections on this database.

**Returns:** `ConnectionInfo` — `{ count: number; ids: string[] }`

```ts
const info = db.connections()
console.log(`${info.count} active connections`)
```

---

### `closeConnections()`

Closes all child connections created via `connect()`.

**Returns:** `void`

```ts
db.closeConnections()
```

---

### `attach(path, alias, options?)`

Attaches another database file to the current session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | `string` | Yes | Path to the database to attach |
| alias | `string` | Yes | Alias name for the attached database |
| options | `AttachOptions` | No | `{ readOnly?: boolean; type?: string }` |

**Returns:** `void`

```ts
db.attach('/path/to/other.db', 'other')
const result = db.executeSync('SELECT * FROM other.users')

// Attach as read-only SQLite
db.attach('/path/to/legacy.sqlite', 'legacy', {
  readOnly: true,
  type: 'sqlite',
})
```

---

### `detach(alias)`

Detaches a previously attached database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| alias | `string` | Yes | Alias of the attached database |

**Returns:** `void`

```ts
db.detach('other')
```

---

### Batch Execution

---

### `executeBatchSync(commands)`

Executes multiple SQL commands in a single synchronous call. Useful for bulk operations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| commands | `BatchCommand[]` | Yes | Array of `{ query: string; params?: DuckDBValue[] }` |

**Returns:** `BatchResult` — `{ rowsAffected: number }`

```ts
const result = db.executeBatchSync([
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
  { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
  { query: 'UPDATE counters SET n = n + 1' },
])
console.log(result.rowsAffected)
```

---

### `executeBatch(commands)`

Executes multiple SQL commands asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| commands | `BatchCommand[]` | Yes | Array of `{ query: string; params?: DuckDBValue[] }` |

**Returns:** `Promise<BatchResult>` — `{ rowsAffected: number }`

```ts
const result = await db.executeBatch([
  { query: 'INSERT INTO logs (msg) VALUES (?)', params: ['event1'] },
  { query: 'INSERT INTO logs (msg) VALUES (?)', params: ['event2'] },
])
```

---

## QueryResult

Returned by `executeSync()`, `execute()`, and similar methods. Contains the full materialized result set.

---

### `rowCount`

Number of rows in the result.

**Type:** `number` (readonly)

```ts
const result = db.executeSync('SELECT * FROM users')
console.log(result.rowCount) // 42
```

---

### `rowsChanged`

Number of rows affected by INSERT, UPDATE, or DELETE statements.

**Type:** `number` (readonly)

```ts
const result = db.executeSync('DELETE FROM users WHERE active = false')
console.log(result.rowsChanged) // 5
```

---

### `columnCount`

Number of columns in the result.

**Type:** `number` (readonly)

```ts
console.log(result.columnCount) // 3
```

---

### `columnNames`

Array of column name strings.

**Type:** `string[]` (readonly)

```ts
console.log(result.columnNames) // ['id', 'name', 'age']
```

---

### `columnTypes`

Array of DuckDB type name strings.

**Type:** `string[]` (readonly)

```ts
console.log(result.columnTypes) // ['INTEGER', 'VARCHAR', 'INTEGER']
```

---

### `toRows()`

Converts the result to an array of row objects. Each row is a `Record<string, DuckDBValue>` keyed by column name.

**Returns:** `Record<string, DuckDBValue>[]`

```ts
const rows = result.toRows()
// [{ id: 1, name: 'Alice', age: 30 }, { id: 2, name: 'Bob', age: 25 }]
```

---

### `getColumn(index)`

Returns a single column's data in columnar format. Numeric columns return a `NumericColumn` with typed arrays; string columns return `(string | null)[]`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| index | `number` | Yes | Zero-based column index |

**Returns:** `ColumnData` — `NumericColumn | (string | null)[]`

```ts
// Numeric column — returns typed ArrayBuffer
const col = result.getColumn(0) as NumericColumn
const view = new Int32Array(col.data)

// String column — returns plain array
const names = result.getColumn(1) as (string | null)[]
```

See [NumericColumn](#numericcolumn) for the typed array structure.

---

## PreparedStatement

A precompiled SQL statement for repeated execution with different parameters. Created by `db.prepare()`.

---

### `executeSync(params?)`

Executes the prepared statement synchronously with positional parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| params | `DuckDBValue[]` | No | Positional parameter values |

**Returns:** `QueryResult`

```ts
const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
const alice = stmt.executeSync([1])
const bob = stmt.executeSync([2])
```

---

### `execute(params?)`

Executes the prepared statement asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| params | `DuckDBValue[]` | No | Positional parameter values |

**Returns:** `Promise<QueryResult>`

```ts
const result = await stmt.execute([42])
```

---

### `executeSyncNamed(params)`

Executes the prepared statement synchronously with named parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| params | `Record<string, DuckDBValue>` | Yes | Named parameter values |

**Returns:** `QueryResult`

```ts
const stmt = db.prepare('SELECT * FROM users WHERE name = $name')
const result = stmt.executeSyncNamed({ name: 'Alice' })
```

---

### `executeNamed(params)`

Executes the prepared statement asynchronously with named parameters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| params | `Record<string, DuckDBValue>` | Yes | Named parameter values |

**Returns:** `Promise<QueryResult>`

```ts
const result = await stmt.executeNamed({ name: 'Bob' })
```

---

### `finalize()`

Releases the prepared statement's resources. Must be called when done to free the underlying connection reference.

**Returns:** `void`

```ts
stmt.finalize()
```

> **Important:** Always finalize prepared statements before closing the database.

---

## StreamingResult

A streaming query result for chunk-by-chunk processing. Each chunk is a `QueryResult` with a subset of rows. Created by `db.stream()` or `db.streamNamed()`.

---

### `isDone`

Whether all chunks have been consumed.

**Type:** `boolean` (readonly)

```ts
while (!stream.isDone) {
  const chunk = await stream.fetchChunk()
  if (chunk) processRows(chunk.toRows())
}
```

---

### `columnCount`

Number of columns in the stream.

**Type:** `number` (readonly)

---

### `columnNames`

Array of column name strings.

**Type:** `string[]` (readonly)

---

### `columnTypes`

Array of DuckDB type name strings.

**Type:** `string[]` (readonly)

---

### `fetchChunk()`

Fetches the next chunk of rows. Returns `undefined` when all rows have been consumed.

**Returns:** `Promise<QueryResult | undefined>`

```ts
const stream = await db.stream('SELECT * FROM large_table')
while (true) {
  const chunk = await stream.fetchChunk()
  if (!chunk) break
  console.log(`Got ${chunk.rowCount} rows`)
}
```

---

### `onChunk(callback)`

Registers a callback that fires for each chunk during push-based streaming. Must be called before `start()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| callback | `(chunk: QueryResult) => void` | Yes | Called with each chunk |

**Returns:** `void`

```ts
stream.onChunk((chunk) => {
  allRows.push(...chunk.toRows())
})
```

---

### `start()`

Begins push-based streaming. Delivers chunks to the `onChunk()` callback. Resolves when all chunks have been delivered.

**Returns:** `Promise<void>`

```ts
const stream = await db.stream('SELECT * FROM large_table')
stream.onChunk((chunk) => processChunk(chunk))
await stream.start()
```

---

### `close()`

Closes the stream and releases resources. After closing, `fetchChunk()` returns `undefined`.

**Returns:** `void`

```ts
stream.close()
```

---

## Appender

DuckDB's native bulk insert interface. Significantly faster than individual INSERT statements. Created by `db.createAppender()`.

---

### `appendRow(values)`

Appends a single row. Values must match the target table's column order and types.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| values | `DuckDBValue[]` | Yes | Column values for one row |

**Returns:** `void`

```ts
appender.appendRow([1, 'sensor_a', 23.5, true])
```

---

### `appendRows(rows)`

Appends multiple rows at once.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| rows | `DuckDBValue[][]` | Yes | Array of row arrays |

**Returns:** `void`

```ts
appender.appendRows([
  [1, 'alice', 95.5],
  [2, 'bob', 87.3],
  [3, 'carol', 91.0],
])
```

---

### `appendColumns(columns)`

Appends data in columnar format. Each inner array is one column. All arrays must have the same length.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| columns | `DuckDBValue[][]` | Yes | Array of column arrays |

**Returns:** `void`

```ts
appender.appendColumns([
  [1, 2, 3],           // id column
  ['a', 'b', 'c'],     // name column
  [true, false, true],  // flag column
])
```

---

### `flush()`

Flushes buffered rows to the database, making them visible to queries.

**Returns:** `void`

```ts
appender.flush()
```

> **Pitfall:** If `flush()` fails (e.g., type mismatch), the appender becomes permanently invalidated. All subsequent calls will throw. Create a new appender to continue.

---

### `close()`

Flushes remaining buffered rows and releases the appender's resources.

**Returns:** `void`

```ts
appender.close()
```

---

## Utility Functions

JavaScript helper functions exported from the package root.

---

### `createWrappedDatabase(db)`

Wraps a `Database` handle with a `transaction()` method for managed transaction execution.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| db | `Database` | Yes | Database handle from `HybridDuckDB.open()` |

**Returns:** `WrappedDatabase`

```ts
import { createWrappedDatabase } from 'react-native-duckdb'

const wrapped = createWrappedDatabase(db)

const result = await wrapped.transaction(async (tx) => {
  tx.executeSync('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Alice', 1000])
  tx.executeSync('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Bob', 500])
  return tx.executeSync('SELECT sum(balance) AS total FROM accounts')
})
```

The `WrappedDatabase` interface mirrors `Database` with the addition of `transaction()`. See [WrappedDatabase](#wrappeddatabase) and [TransactionContext](#transactioncontext).

---

### `executeTransaction(db, callback)`

Executes a callback within a transaction. Automatically calls BEGIN, COMMIT on success, or ROLLBACK on error. Uses a dedicated child connection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| db | `Database` | Yes | Database handle |
| callback | `(tx: TransactionContext) => Promise<T>` | Yes | Transaction body |

**Returns:** `Promise<T>` — the callback's return value

```ts
import { executeTransaction } from 'react-native-duckdb'

const total = await executeTransaction(db, async (tx) => {
  tx.executeSync('UPDATE accounts SET balance = balance - 100 WHERE name = ?', ['Alice'])
  tx.executeSync('UPDATE accounts SET balance = balance + 100 WHERE name = ?', ['Bob'])
  const result = tx.executeSync('SELECT sum(balance) AS total FROM accounts')
  return result.toRows()[0].total
})
```

On error, throws a `DuckDBError` with a `transaction` property containing `TransactionInfo`.

---

### `streamChunks(stream)`

Async iterator wrapper over `StreamingResult`. Automatically closes the stream when iteration completes or breaks early.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| stream | `StreamingResult` | Yes | Streaming result from `db.stream()` |

**Returns:** `AsyncIterableIterator<QueryResult>`

```ts
import { streamChunks } from 'react-native-duckdb'

const stream = await db.stream('SELECT * FROM large_table')
for await (const chunk of streamChunks(stream)) {
  console.log(chunk.toRows())
}
// stream is auto-closed
```

Early exit is safe — the stream closes automatically on `break`:

```ts
for await (const chunk of streamChunks(stream)) {
  if (foundEnough(chunk)) break
}
```

---

### `withAppender(db, table, callback, options?)`

Creates an appender, runs a callback, and auto-closes. If the callback throws, the appender is still closed and the error is wrapped in `DuckDBError`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| db | `Database` | Yes | Database handle |
| table | `string` | Yes | Target table name |
| callback | `(appender: Appender) => T \| Promise<T>` | Yes | Function that uses the appender |
| options | `AppenderOptions` | No | `{ flushEvery?: number }` |

**Returns:** `Promise<T>` — the callback's return value

```ts
import { withAppender } from 'react-native-duckdb'

await withAppender(db, 'users', (appender) => {
  appender.appendRows(userData)
})

// With options
await withAppender(db, 'measurements', (appender) => {
  appender.appendRows(sensorData)
}, { flushEvery: 10000 })
```

---

## Types

All types are exported from the package root:

```ts
import type {
  DuckDBValue,
  DuckDBNamedParams,
  DuckDBConfig,
  NumericColumn,
  ColumnData,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
  StreamingOptions,
  AppenderOptions,
  ExecuteOptions,
} from 'react-native-duckdb'
```

---

### `DuckDBValue`

The universal value type for DuckDB data. A union of all types that can appear in query results or be passed as parameters.

```ts
type DuckDBValue = null | boolean | number | Int64 | string | ArrayBuffer
```

| Variant | JS Type | DuckDB Types |
|---------|---------|-------------|
| `null` | `null` | NULL |
| `boolean` | `boolean` | BOOLEAN |
| `number` | `number` | INTEGER, FLOAT, DOUBLE, SMALLINT, TINYINT |
| `Int64` | `bigint` | BIGINT, UBIGINT |
| `string` | `string` | VARCHAR, HUGEINT, DECIMAL, TIMESTAMP, DATE, TIME, UUID, ENUM, complex types |
| `ArrayBuffer` | `ArrayBuffer` | BLOB |

> `Int64` is from `react-native-nitro-modules` and maps to JavaScript `bigint`.

---

### `DuckDBNamedParams`

Named parameter map for `executeSyncNamed()` and `executeNamed()`.

```ts
type DuckDBNamedParams = Record<string, DuckDBValue>
```

---

### `DuckDBConfig`

Configuration map passed to `HybridDuckDB.open()`.

```ts
type DuckDBConfig = Record<string, string>
```

Common configuration keys:

| Key | Default | Description |
|-----|---------|-------------|
| `threads` | platform default | Number of threads |
| `memory_limit` | platform default | Maximum memory usage (e.g., `"256MB"`) |
| `default_order` | `"asc"` | Default sort order |

---

### `NumericColumn`

Columnar data for numeric and boolean columns. Returned by `QueryResult.getColumn()`.

```ts
interface NumericColumn {
  data: ArrayBuffer    // Typed array data
  validity: ArrayBuffer // Bit mask — 1 = valid, 0 = null
  dtype: string         // DuckDB type name
}
```

| Field | Type | Description |
|-------|------|-------------|
| data | `ArrayBuffer` | Raw column data. Interpret based on `dtype`: `Int32Array` for INTEGER, `Float64Array` for DOUBLE, `BigInt64Array` for BIGINT, `Uint8Array` for BOOLEAN, etc. |
| validity | `ArrayBuffer` | Null bitmap. Each bit corresponds to a row: `1` = valid value, `0` = null. Use bitwise operations to check. |
| dtype | `string` | DuckDB type string (e.g., `"INTEGER"`, `"DOUBLE"`, `"BIGINT"`, `"BOOLEAN"`) |

```ts
const col = result.getColumn(0) as NumericColumn
const values = new Int32Array(col.data)
const validBits = new Uint8Array(col.validity)

for (let i = 0; i < result.rowCount; i++) {
  const isValid = (validBits[Math.floor(i / 8)] >> (i % 8)) & 1
  if (isValid) console.log(values[i])
}
```

---

### `ColumnData`

Union type returned by `QueryResult.getColumn()`.

```ts
type ColumnData = NumericColumn | (string | null)[]
```

Numeric and boolean columns return `NumericColumn`. All other types (VARCHAR, TIMESTAMP, complex types) return `(string | null)[]`.

---

### `BatchCommand`

A single command in a batch execution.

```ts
type BatchCommand = { query: string; params?: DuckDBValue[] }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | `string` | Yes | SQL statement |
| params | `DuckDBValue[]` | No | Positional parameters |

---

### `BatchResult`

Result of a batch execution.

```ts
type BatchResult = { rowsAffected: number }
```

---

### `AttachOptions`

Options for `Database.attach()`.

```ts
type AttachOptions = { readOnly?: boolean; type?: string }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| readOnly | `boolean` | `false` | Attach in read-only mode |
| type | `string` | `undefined` | Database type (e.g., `"sqlite"`) |

---

### `CloseOptions`

Options for `Database.close()`.

```ts
type CloseOptions = { force?: boolean }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| force | `boolean` | `false` | Force close, closing child connections first |

---

### `ConnectionInfo`

Information about active database connections. Returned by `Database.connections()`.

```ts
type ConnectionInfo = { count: number; ids: string[] }
```

| Field | Type | Description |
|-------|------|-------------|
| count | `number` | Number of active connections |
| ids | `string[]` | Connection identifier strings |

---

### `StreamingOptions`

Options for streaming configuration.

```ts
type StreamingOptions = { bufferSize?: number }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| bufferSize | `number` | `undefined` | Buffer size for streaming |

---

### `AppenderOptions`

Options for `Database.createAppender()`.

```ts
type AppenderOptions = { flushEvery?: number }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| flushEvery | `number` | `undefined` | Auto-flush after this many rows |

---

### `ExecuteOptions`

Options for async execution methods (`execute()`, `executeNamed()`, `stream()`, `streamNamed()`).

```ts
interface ExecuteOptions {
  onProgress?: (percentage: number) => void
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| onProgress | `(percentage: number) => void` | `undefined` | Per-query progress callback (0–100). Overrides per-connection callback. |

---

### `TransactionContext`

The context object passed to transaction callbacks. Provides a subset of `Database` methods scoped to the transaction.

```ts
type TransactionContext = {
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>
}
```

> **Note:** Nested `transaction()` calls throw a `DuckDBError` — DuckDB does not support savepoints.

---

### `TransactionInfo`

Transaction metadata attached to `DuckDBError` when a transaction fails.

```ts
type TransactionInfo = {
  statementsExecuted: number
  rolledBack: boolean
  depth: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| statementsExecuted | `number` | Number of statements executed before failure |
| rolledBack | `boolean` | Whether the transaction was rolled back |
| depth | `number` | Transaction nesting depth (always 0) |

---

### `WrappedDatabase`

A `Database` handle extended with transaction support. Created by `createWrappedDatabase()`.

```ts
interface WrappedDatabase {
  readonly isOpen: boolean
  close(options?: CloseOptions): void
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
  connect(): WrappedDatabase
  connections(): ConnectionInfo
  closeConnections(): void
  attach(path: string, alias: string, options?: AttachOptions): void
  detach(alias: string): void
  executeBatchSync(commands: BatchCommand[]): BatchResult
  executeBatch(commands: BatchCommand[]): Promise<BatchResult>
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>
}
```

---

### `DuckDBError`

Error class thrown by all DuckDB operations. Extends `Error` with optional transaction metadata.

```ts
class DuckDBError extends Error {
  transaction?: TransactionInfo

  constructor(message: string, options?: ErrorOptions)
  static fromError(error: unknown): DuckDBError
}
```

| Member | Type | Description |
|--------|------|-------------|
| `transaction` | `TransactionInfo \| undefined` | Present when error occurred inside a transaction |
| `fromError(error)` | `static` | Converts any error to a `DuckDBError`, preserving stack and cause |

```ts
import { DuckDBError } from 'react-native-duckdb'

try {
  db.executeSync('INVALID SQL')
} catch (error) {
  if (error instanceof DuckDBError) {
    console.log(error.message)
    if (error.transaction) {
      console.log(`Rolled back after ${error.transaction.statementsExecuted} statements`)
    }
  }
}
```
