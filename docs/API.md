# react-native-duckdb API Reference

## Database Factory

### `HybridDuckDB`

The singleton factory for creating database instances.

#### `HybridDuckDB.version`

```ts
readonly version: string
```

Returns the DuckDB engine version string.

#### `HybridDuckDB.open(path, config)`

```ts
open(path: string, config: DuckDBConfig): Database
```

Opens or creates a DuckDB database.

- **path** — File path for persistent database, or `':memory:'` for in-memory database.
- **config** — DuckDB configuration options as key-value pairs. Pass `{}` for defaults.
- **Returns** — A `Database` instance.

```ts
const db = HybridDuckDB.open(':memory:', {})
const db = HybridDuckDB.open('app.db', { threads: '2', memory_limit: '256MB' })
```

#### `HybridDuckDB.deleteDatabase(path)`

```ts
deleteDatabase(path: string): void
```

Deletes a database file and its associated WAL file from disk.

- **path** — File path of the database to delete.

---

## Extensions

DuckDB's power comes from its extensions. On mobile, extensions are **statically linked** at build time — you choose which ones to include, and they become part of your native binary.

### Extension Configuration

Configure extensions in your app's `package.json`:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet", "json"]
    }
  }
}
```

- **Default is NO extensions** — you must explicitly list every extension you need
- Invalid extension names will cause a **build error** with a clear message
- After changing extensions, run `pod install` (iOS) and rebuild both platforms

### Recommended Extensions

> **`core_functions` is essential for a full DuckDB experience.** Without it, common SQL functions like `sum()`, `avg()`, `list_value()`, `string_split()`, and `uuid()` will be unavailable. We strongly recommend adding it to every project to unleash the full power of DuckDB's analytical engine.

### Available Extensions

| Extension | Description | Required For |
|-----------|-------------|-------------|
| `core_functions` | Essential SQL functions (sum, avg, list_value, uuid, etc.) | Basic SQL operations — **strongly recommended** |
| `parquet` | Apache Parquet file format support | `SELECT * FROM 'file.parquet'` |
| `json` | JSON file format support | `read_json('file.json')` |
| `icu` | Unicode collation and text functions | Locale-aware sorting and string operations |
| `sqlite_scanner` | Read and write SQLite databases | `ATTACH 'file.sqlite' (TYPE sqlite)` |
| `autocomplete` | SQL autocomplete suggestions | Editor integrations |
| `tpch` | TPC-H benchmark data generator | Benchmarking |
| `tpcds` | TPC-DS benchmark data generator | Benchmarking |
| `delta` | Delta Lake table format | Reading Delta Lake tables |

### File Queries

DuckDB can query files directly. Each format requires its own extension (except CSV, which is built-in).

**Parquet** — requires `parquet` extension:

```sql
SELECT * FROM 'data.parquet';
SELECT count(*), avg(value) FROM 'measurements.parquet' WHERE sensor = 'temp';
```

**CSV** — built-in, no extension needed:

```sql
SELECT * FROM read_csv('data.csv');
SELECT * FROM read_csv('data.tsv', delim='\t', header=true);
```

**JSON** — requires `json` extension:

```sql
SELECT * FROM read_json('data.json');
SELECT * FROM read_json('events.jsonl', format='newline_delimited');
```

> **File paths on mobile:** Files must be in the app's documents directory or bundled with the app. When using a file-based database (`HybridDuckDB.open('name.db', {})`), relative paths in `COPY TO` and file queries resolve from the database file's directory.

### SQLite Scanner

The `sqlite_scanner` extension lets you read and write SQLite databases from DuckDB.

Requires the `sqlite_scanner` extension in your build config.

```sql
-- Attach a SQLite database
ATTACH 'path/to/database.sqlite' AS mydb (TYPE sqlite);

-- Query tables from the attached SQLite database
SELECT * FROM mydb.users WHERE active = 1;

-- Detach when done
DETACH mydb;
```

### Runtime Extension Loading

On mobile, all extensions are **statically linked** at build time. The `LOAD` statement works as a no-op for extensions already in your build config:

```sql
-- Succeeds as a no-op if parquet is in your build config
LOAD 'parquet';
```

- **iOS** prohibits dynamic loading (`dlopen`) — runtime extension installation from the network is not supported
- **Android** uses the same static-only model for consistency and security
- To check which extensions are available, query `duckdb_extensions()`:

```sql
SELECT extension_name, loaded, installed FROM duckdb_extensions();
```

---

## Database

Represents an open DuckDB database connection. Supports synchronous and asynchronous query execution, streaming, appender, prepared statements, multi-connection, attach/detach, and batch execution.

### Properties

#### `isOpen`

```ts
readonly isOpen: boolean
```

Whether the database connection is currently open.

### Methods

#### `close(options?)`

```ts
close(options?: CloseOptions): void
```

Closes the database. Throws if child connections are open unless `force: true`.

- **options.force** — If `true`, forcefully closes all child connections first.

#### `executeSync(sql, params?)`

```ts
executeSync(sql: string, params?: DuckDBValue[]): QueryResult
```

Executes a SQL statement synchronously on the main thread.

- **sql** — SQL query string. Supports `?` positional placeholders.
- **params** — Optional parameter values for placeholders.
- **Returns** — A `QueryResult` with row/column data.

```ts
const result = db.executeSync("SELECT * FROM users WHERE id = ?", [42])
const rows = result.toRows()
```

#### `execute(sql, params?)`

```ts
execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
```

Executes a SQL statement asynchronously on a background thread.

- **sql** — SQL query string.
- **params** — Optional parameter values.
- **Returns** — Promise resolving to a `QueryResult`.

#### `prepare(sql)`

```ts
prepare(sql: string): PreparedStatement
```

Creates a prepared statement for repeated execution with different parameters.

- **sql** — SQL query string with `?` placeholders.
- **Returns** — A `PreparedStatement` instance.

```ts
const stmt = db.prepare('INSERT INTO t VALUES (?, ?)')
stmt.executeSync([1, 'alice'])
stmt.executeSync([2, 'bob'])
stmt.finalize()
```

#### `cancel()`

```ts
cancel(): void
```

Interrupts any running query on this connection. Thread-safe: can be called from the JS thread while an async query runs on the background thread. If no query is running, this is a no-op. After cancellation, the connection is immediately reusable for new queries.

```ts
const promise = db.execute('SELECT * FROM huge_table')
db.cancel() // interrupts the query
// promise rejects with cancellation error
```

#### `executeSyncNamed(sql, params)`

```ts
executeSyncNamed(sql: string, params: Record<string, DuckDBValue>): QueryResult
```

Executes a SQL statement synchronously with named `$param` parameters.

- **sql** — SQL query string with `$name` placeholders.
- **params** — Named parameter values as key-value pairs.
- **Returns** — A `QueryResult` with row/column data.

```ts
const result = db.executeSyncNamed(
  'SELECT * FROM users WHERE name = $name AND age > $minAge',
  { name: 'Alice', minAge: 25 }
)
```

#### `executeNamed(sql, params)`

```ts
executeNamed(sql: string, params: Record<string, DuckDBValue>): Promise<QueryResult>
```

Executes a SQL statement asynchronously with named `$param` parameters.

- **sql** — SQL query string with `$name` placeholders.
- **params** — Named parameter values as key-value pairs.
- **Returns** — Promise resolving to a `QueryResult`.

#### `stream(sql, params?)`

```ts
stream(sql: string, params?: DuckDBValue[]): Promise<StreamingResult>
```

Creates a streaming query result for processing large datasets chunk-by-chunk without materializing all rows in memory. Uses a dedicated connection internally.

- **sql** — SQL query string.
- **params** — Optional parameter values.
- **Returns** — Promise resolving to a `StreamingResult`.

```ts
const stream = await db.stream('SELECT * FROM large_table')
while (true) {
  const chunk = await stream.fetchChunk()
  if (!chunk) break
  console.log(chunk.toRows())
}
```

#### `streamNamed(sql, params)`

```ts
streamNamed(sql: string, params: Record<string, DuckDBValue>): Promise<StreamingResult>
```

Creates a streaming query result with named `$param` parameters. Uses a dedicated connection internally.

- **sql** — SQL query string with `$name` placeholders.
- **params** — Named parameter values as key-value pairs.
- **Returns** — Promise resolving to a `StreamingResult`.

```ts
const stream = await db.streamNamed(
  'SELECT * FROM events WHERE type = $type',
  { type: 'click' }
)
```

#### `createAppender(table, options?)`

```ts
createAppender(table: string, options?: AppenderOptions): Appender
```

Creates a DuckDB Appender for fast bulk inserts into a table. Significantly faster than individual INSERT statements for large datasets.

- **table** — Target table name (must exist).
- **options.flushEvery** — Auto-flush after every N rows appended.
- **Returns** — An `Appender` instance.
- **Throws** — If the table does not exist.

```ts
const appender = db.createAppender('measurements', { flushEvery: 10000 })
appender.appendRow([1, 'sensor_a', 23.5])
appender.close()
```

#### `connect()`

```ts
connect(): Database
```

Creates a new independent connection to the same database. Only callable on the primary database instance.

- **Returns** — A child `Database` connection.

#### `connections()`

```ts
connections(): ConnectionInfo
```

Returns information about open child connections.

- **Returns** — `{ count: number, ids: string[] }`

#### `closeConnections()`

```ts
closeConnections(): void
```

Closes all open child connections.

#### `attach(path, alias, options?)`

```ts
attach(path: string, alias: string, options?: AttachOptions): void
```

Attaches another database file to this connection.

- **path** — File path of the database to attach.
- **alias** — Alias name for cross-database queries.
- **options.readOnly** — If `true`, attaches in read-only mode.

```ts
db.attach('analytics.db', 'analytics', { readOnly: true })
const result = db.executeSync('SELECT * FROM analytics.events')
```

#### `detach(alias)`

```ts
detach(alias: string): void
```

Detaches a previously attached database.

#### `executeBatchSync(commands)`

```ts
executeBatchSync(commands: BatchCommand[]): BatchResult
```

Executes multiple commands atomically in a transaction. Rolls back on any failure.

- **commands** — Array of `{ query: string, params?: DuckDBValue[] }`.
- **Returns** — `{ rowsAffected: number }`.

#### `executeBatch(commands)`

```ts
executeBatch(commands: BatchCommand[]): Promise<BatchResult>
```

Async version of `executeBatchSync`.

---

## QueryResult

Represents the result of a query execution. Provides both row-oriented and columnar access.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `rowCount` | `number` | Total number of rows |
| `rowsChanged` | `number` | Rows affected by INSERT/UPDATE/DELETE |
| `columnCount` | `number` | Number of columns |
| `columnNames` | `string[]` | Column name array |
| `columnTypes` | `string[]` | Column type strings (e.g., `"INTEGER"`, `"VARCHAR"`) |

### Methods

#### `toRows()`

```ts
toRows(): Record<string, DuckDBValue>[]
```

Returns all rows as an array of objects keyed by column name.

```ts
const rows = result.toRows()
// [{ id: 1, name: 'alice' }, { id: 2, name: 'bob' }]
```

#### `getColumn(index)`

```ts
getColumn(index: number): ColumnData
```

Returns a single column as either a `NumericColumn` (typed array with validity bitmap) or a `(string | null)[]` array.

- **Numeric types** (INTEGER, DOUBLE, BIGINT, BOOLEAN, etc.) return `NumericColumn`:
  - `data: ArrayBuffer` — Typed array data (Float64, BigInt64, Uint8 depending on `dtype`)
  - `validity: ArrayBuffer` — Uint8 bitmap (1 = valid, 0 = null)
  - `dtype: string` — `'float64'` | `'bigint64'` | `'uint8'`

- **String/complex types** (VARCHAR, etc.) return `(string | null)[]`.

```ts
const col = result.getColumn(0)
if ('data' in col) {
  const data = new Float64Array(col.data)
  const validity = new Uint8Array(col.validity)
}
```

---

## PreparedStatement

A compiled SQL statement for efficient repeated execution.

### Methods

#### `executeSync(params?)`

```ts
executeSync(params?: DuckDBValue[]): QueryResult
```

Executes the prepared statement synchronously with the given parameters.

#### `execute(params?)`

```ts
execute(params?: DuckDBValue[]): Promise<QueryResult>
```

Executes the prepared statement asynchronously.

#### `executeSyncNamed(params)`

```ts
executeSyncNamed(params: Record<string, DuckDBValue>): QueryResult
```

Executes the prepared statement synchronously with named parameters.

```ts
const stmt = db.prepare('SELECT $x + $y AS sum')
const result = stmt.executeSyncNamed({ x: 10, y: 20 })
```

#### `executeNamed(params)`

```ts
executeNamed(params: Record<string, DuckDBValue>): Promise<QueryResult>
```

Executes the prepared statement asynchronously with named parameters.

#### `finalize()`

```ts
finalize(): void
```

Releases the prepared statement resources. Subsequent calls to `executeSync`/`execute` will throw.

---

## StreamingResult

Represents a streaming query result for processing large datasets chunk-by-chunk. Chunks are `QueryResult` instances with the same column access methods.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isDone` | `boolean` | Whether all chunks have been consumed |
| `columnCount` | `number` | Number of columns |
| `columnNames` | `string[]` | Column name array |
| `columnTypes` | `string[]` | Column type strings |

### Methods

#### `fetchChunk()`

```ts
fetchChunk(): Promise<QueryResult | undefined>
```

Fetches the next chunk of rows. Returns `undefined` when all rows are consumed (pull-based streaming).

```ts
const stream = await db.stream('SELECT * FROM large_table')
while (true) {
  const chunk = await stream.fetchChunk()
  if (!chunk) break
  processChunk(chunk.toRows())
}
```

#### `onChunk(callback)`

```ts
onChunk(callback: (chunk: QueryResult) => void): void
```

Registers a callback to receive each chunk as it becomes available (push-based streaming). Must be called before `start()`.

#### `start()`

```ts
start(): Promise<void>
```

Starts push-based streaming. Resolves when all chunks have been delivered to the `onChunk` callback.

```ts
const stream = await db.stream('SELECT * FROM large_table')
const allRows: any[] = []
stream.onChunk((chunk) => {
  allRows.push(...chunk.toRows())
})
await stream.start()
```

#### `close()`

```ts
close(): void
```

Closes the stream and releases resources early. After closing, `fetchChunk()` returns `undefined`.

---

## Appender

DuckDB's native bulk insert interface. Significantly faster than individual INSERT statements for large datasets.

### Methods

#### `appendRow(values)`

```ts
appendRow(values: DuckDBValue[]): void
```

Appends a single row. Values must match the target table's column order and types.

```ts
appender.appendRow([1, 'alice', 95.5, true])
```

#### `appendRows(rows)`

```ts
appendRows(rows: DuckDBValue[][]): void
```

Appends multiple rows at once.

```ts
appender.appendRows([
  [1, 'alice', 95.5],
  [2, 'bob', 87.3],
])
```

#### `appendColumns(columns)`

```ts
appendColumns(columns: DuckDBValue[][]): void
```

Appends data in columnar format. Each inner array represents one column. All arrays must have the same length.

```ts
appender.appendColumns([
  [1, 2, 3],           // id column
  ['a', 'b', 'c'],     // name column
  [true, false, true],  // flag column
])
```

- **Throws** — If column arrays have different lengths.

#### `flush()`

```ts
flush(): void
```

Manually flushes buffered rows to the database, making them visible to queries. The appender remains usable after flushing.

- **Note:** If flush fails, the appender becomes permanently invalidated. Create a new appender to continue.

#### `close()`

```ts
close(): void
```

Closes the appender and flushes any remaining buffered rows.

---

## Utility Functions

### `createWrappedDatabase(db)`

```ts
createWrappedDatabase(db: Database): WrappedDatabase
```

Wraps a `Database` instance to add transaction support via `db.transaction()`.

```ts
const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))
await db.transaction(async (tx) => {
  tx.executeSync("INSERT INTO t VALUES (1, 'alice')")
  tx.executeSync("INSERT INTO t VALUES (2, 'bob')")
})
```

### `executeTransaction(db, callback)`

```ts
executeTransaction(db: Database, callback: (tx: TransactionContext) => Promise<T>): Promise<T>
```

Executes a callback within a database transaction. Automatically commits on success, rolls back on error. Uses a dedicated child connection.

- **Nested transactions** are not supported (DuckDB has no SAVEPOINT). Calling `tx.transaction()` throws.

### `withAppender(db, table, callback, options?)`

```ts
withAppender<T>(
  db: Database,
  table: string,
  callback: (appender: Appender) => T | Promise<T>,
  options?: AppenderOptions
): Promise<T>
```

Creates an appender, runs the callback, and auto-closes the appender. If the callback throws, the appender is still closed and the error is wrapped in `DuckDBError`.

```ts
await withAppender(db, 'users', (appender) => {
  appender.appendRows(userData)
})
```

### `streamChunks(stream)`

```ts
streamChunks(stream: StreamingResult): AsyncIterableIterator<QueryResult>
```

Wraps a `StreamingResult` in an async generator for `for await...of` iteration. Automatically closes the stream when iteration completes or breaks early.

```ts
const stream = await db.stream('SELECT * FROM t')
for await (const chunk of streamChunks(stream)) {
  console.log(chunk.toRows())
}
```

---

## Types

### `DuckDBValue`

```ts
type DuckDBValue = null | boolean | number | Int64 | string | ArrayBuffer
```

Union type for all values that can be passed to/from DuckDB. Maps to the C++ variant: `std::variant<std::monostate, bool, double, int64_t, std::string, std::shared_ptr<ArrayBuffer>>`.

### `DuckDBNamedParams`

```ts
type DuckDBNamedParams = Record<string, DuckDBValue>
```

Named parameter map for `$name`-style query parameters. Keys are parameter names (without the `$` prefix), values are `DuckDBValue`. Parameter name matching is case-insensitive.

```ts
const params: DuckDBNamedParams = { name: 'Alice', age: 30 }
db.executeSyncNamed('SELECT $name, $age', params)
```

### `DuckDBConfig`

```ts
type DuckDBConfig = Record<string, string>
```

Configuration options for `open()`. Pass `{}` for defaults.

### `NumericColumn`

```ts
interface NumericColumn {
  data: ArrayBuffer    // Typed array data
  validity: ArrayBuffer // Uint8 null bitmap (1=valid, 0=null)
  dtype: string        // 'float64' | 'bigint64' | 'uint8'
}
```

### `ColumnData`

```ts
type ColumnData = NumericColumn | (string | null)[]
```

Return type of `getColumn()`. Numeric/boolean columns return `NumericColumn`, string/complex types return `(string | null)[]`.

### `BatchCommand`

```ts
type BatchCommand = { query: string; params?: DuckDBValue[] }
```

### `BatchResult`

```ts
type BatchResult = { rowsAffected: number }
```

### `AttachOptions`

```ts
type AttachOptions = { readOnly?: boolean; type?: string }
```

### `CloseOptions`

```ts
type CloseOptions = { force?: boolean }
```

### `ConnectionInfo`

```ts
type ConnectionInfo = { count: number; ids: string[] }
```

### `StreamingOptions`

```ts
type StreamingOptions = { bufferSize?: number }
```

### `AppenderOptions`

```ts
type AppenderOptions = { flushEvery?: number }
```

### `TransactionContext`

```ts
type TransactionContext = {
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>
}
```

### `TransactionInfo`

```ts
type TransactionInfo = {
  statementsExecuted: number
  rolledBack: boolean
  depth: number
}
```

---

## Error Handling

### `DuckDBError`

```ts
class DuckDBError extends Error {
  transaction?: TransactionInfo
  static fromError(error: unknown): DuckDBError
}
```

Custom error class for DuckDB operations. When thrown from a transaction context, includes `transaction` metadata with statement count, rollback status, and nesting depth.

```ts
try {
  await db.transaction(async (tx) => { ... })
} catch (e) {
  if (e instanceof DuckDBError) {
    console.log(e.transaction?.rolledBack) // true
  }
}
```
