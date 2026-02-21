# Streaming & Appender

## Why Streaming Matters on Mobile

Standard `executeSync()` / `execute()` materialize all rows into memory before returning. For large result sets, this can exhaust mobile device memory. Streaming processes rows in chunks — each chunk is a `QueryResult` with a subset of rows, allowing you to process data incrementally.

## StreamingResult

Create a stream with `db.stream()`:

```ts
const stream = await db.stream('SELECT * FROM large_table')
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isDone` | `boolean` | Whether all chunks have been consumed |
| `columnCount` | `number` | Number of columns |
| `columnNames` | `string[]` | Column name array |
| `columnTypes` | `string[]` | Column type strings |

### Pull-Based: fetchChunk()

Call `fetchChunk()` in a loop. Returns `undefined` when all rows are consumed.

```ts
const stream = await db.stream('SELECT * FROM large_table')
while (true) {
  const chunk = await stream.fetchChunk()
  if (!chunk) break
  // chunk is a QueryResult — same API as execute() results
  const rows = chunk.toRows()
  processRows(rows)
}
```

### Push-Based: onChunk() + start()

Register a callback with `onChunk()`, then call `start()`. The promise resolves when all chunks have been delivered.

```ts
const stream = await db.stream('SELECT * FROM large_table')
const allRows: Record<string, any>[] = []
stream.onChunk((chunk) => {
  allRows.push(...chunk.toRows())
})
await stream.start()
// allRows now contains everything
```

`onChunk()` must be called before `start()`.

### Closing Early

```ts
stream.close()
// After close, fetchChunk() returns undefined
```

### Named Parameters

```ts
const stream = await db.streamNamed(
  'SELECT * FROM events WHERE type = $type',
  { type: 'click' }
)
```

---

## streamChunks()

Async iterator wrapper over `StreamingResult`. Automatically closes the stream when iteration completes or breaks early.

```ts
import { streamChunks } from 'react-native-duckdb'

const stream = await db.stream('SELECT * FROM large_table')
for await (const chunk of streamChunks(stream)) {
  console.log(chunk.toRows())
}
// stream is auto-closed here
```

Early exit is safe:

```ts
const stream = await db.stream('SELECT * FROM large_table')
for await (const chunk of streamChunks(stream)) {
  if (foundEnough(chunk)) break // stream auto-closes
}
```

### Signature

```ts
function streamChunks(stream: StreamingResult): AsyncIterableIterator<QueryResult>
```

---

## Appender

DuckDB's native bulk insert interface. Significantly faster than individual `INSERT` statements for large datasets. The Appender bypasses the SQL parser and directly writes to DuckDB's column storage.

### Creating an Appender

```ts
const appender = db.createAppender('measurements')
```

The target table must already exist. Optionally pass `flushEvery` to auto-flush after every N rows:

```ts
const appender = db.createAppender('measurements', { flushEvery: 10000 })
```

### appendRow()

Appends a single row. Values must match the table's column order and types.

```ts
appender.appendRow([1, 'sensor_a', 23.5, true])
```

### appendRows()

Appends multiple rows at once.

```ts
appender.appendRows([
  [1, 'alice', 95.5],
  [2, 'bob', 87.3],
  [3, 'carol', 91.0],
])
```

### appendColumns()

Appends data in columnar format. Each inner array is one column. All arrays must have the same length.

```ts
appender.appendColumns([
  [1, 2, 3],           // id column
  ['a', 'b', 'c'],     // name column
  [true, false, true],  // flag column
])
```

Throws if column arrays have different lengths.

### flush() and close()

```ts
// Manual flush — makes buffered rows visible to queries
appender.flush()

// Close — flushes remaining rows and releases resources
appender.close()
```

> **Pitfall:** If `flush()` fails (e.g., type mismatch), the appender becomes **permanently invalidated**. Subsequent calls to any method will throw. You must create a new appender to continue.

### Full Example

```ts
db.executeSync('CREATE TABLE readings (sensor_id INTEGER, value DOUBLE, ts VARCHAR)')

const appender = db.createAppender('readings', { flushEvery: 5000 })

// Bulk insert from a data source
for (const batch of dataSource) {
  appender.appendRows(batch)
}

appender.close()

// Verify
const count = db.executeSync('SELECT count(*) AS n FROM readings')
console.log(count.toRows()[0].n)
```

---

## withAppender()

Convenience wrapper that creates an appender, runs a callback, and auto-closes. If the callback throws, the appender is still closed and the error is wrapped in `DuckDBError`.

```ts
import { withAppender } from 'react-native-duckdb'

await withAppender(db, 'users', (appender) => {
  appender.appendRows(userData)
})
```

With options:

```ts
await withAppender(db, 'users', (appender) => {
  appender.appendRows(userData)
}, { flushEvery: 10000 })
```

### Signature

```ts
function withAppender<T>(
  db: Database,
  table: string,
  callback: (appender: Appender) => T | Promise<T>,
  options?: AppenderOptions
): Promise<T>
```

---

## Progress Callbacks

Track progress of long-running async queries. Progress is reported as a percentage (0-100).

### Per-Connection Callback

Set once, fires for all async queries on the connection:

```ts
db.setProgressCallback((pct) => {
  updateProgressBar(pct)
})

await db.execute('SELECT * FROM huge_table')    // fires progress
await db.executeNamed('SELECT ...', { ... })     // also fires progress

db.removeProgressCallback()
```

### Per-Query Callback

Pass `onProgress` in the options parameter. Overrides any per-connection callback for that query.

```ts
const result = await db.execute(
  'SELECT count(*) FROM large_table t1 JOIN large_table t2 ON t1.id = t2.id',
  undefined,
  { onProgress: (pct) => console.log(`${Math.round(pct)}% complete`) }
)
```

### Supported Methods

Progress callbacks fire only on async methods:

| Method | Progress Support |
|--------|-----------------|
| `execute()` | Yes |
| `executeNamed()` | Yes |
| `stream()` | Yes |
| `streamNamed()` | Yes |
| `executeSync()` | No — blocks JS thread |
| `executeSyncNamed()` | No — blocks JS thread |

### Priority

When both per-query and per-connection callbacks are set, the **per-query callback takes priority**.
