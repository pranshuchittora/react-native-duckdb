# Transactions & Batch

## executeTransaction()

Executes a callback within a database transaction. Automatically commits on success, rolls back on error. Uses a dedicated child connection.

```ts
import { executeTransaction } from 'react-native-duckdb'

const result = await executeTransaction(db, async (tx) => {
  tx.executeSync("INSERT INTO accounts VALUES (1, 'alice', 1000)")
  tx.executeSync("INSERT INTO accounts VALUES (2, 'bob', 500)")
  return 'done'
})
// result → 'done'
```

If the callback throws, the transaction is rolled back and the error is re-thrown as a `DuckDBError` with transaction metadata:

```ts
try {
  await executeTransaction(db, async (tx) => {
    tx.executeSync("INSERT INTO accounts VALUES (1, 'alice', 1000)")
    throw new Error('something went wrong')
  })
} catch (e) {
  if (e instanceof DuckDBError) {
    console.log(e.transaction?.rolledBack)        // true
    console.log(e.transaction?.statementsExecuted) // 1
    console.log(e.transaction?.depth)              // 0
  }
}
```

### TransactionContext

The `tx` object exposes a subset of database methods:

| Method | Description |
|--------|-------------|
| `tx.executeSync(sql, params?)` | Synchronous query within the transaction |
| `tx.execute(sql, params?)` | Async query within the transaction |
| `tx.prepare(sql)` | Create a prepared statement (auto-finalized on commit/rollback) |

Prepared statements created within a transaction are automatically finalized when the transaction completes.

### Signature

```ts
function executeTransaction<T>(
  db: Database,
  callback: (tx: TransactionContext) => Promise<T>
): Promise<T>
```

---

## createWrappedDatabase()

Wraps a `Database` to add a `transaction()` method directly on the database object.

```ts
import { createWrappedDatabase, HybridDuckDB } from 'react-native-duckdb'

const db = createWrappedDatabase(HybridDuckDB.open(':memory:', {}))

db.executeSync('CREATE TABLE t (id INTEGER, name VARCHAR)')

await db.transaction(async (tx) => {
  tx.executeSync("INSERT INTO t VALUES (1, 'alice')")
  tx.executeSync("INSERT INTO t VALUES (2, 'bob')")
})

const rows = db.executeSync('SELECT * FROM t').toRows()
// [{ id: 1, name: 'alice' }, { id: 2, name: 'bob' }]
```

The wrapped database proxies all standard `Database` methods (`executeSync`, `execute`, `prepare`, `close`, `connect`, `attach`, `detach`, etc.) and adds `transaction()`.

### WrappedDatabase Interface

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

## Nested Transactions

DuckDB does not support `SAVEPOINT`. Calling `tx.transaction()` inside a transaction throws:

```ts
await db.transaction(async (tx) => {
  // This throws DuckDBError
  await tx.transaction(async (innerTx) => {
    // never reached
  })
})
// DuckDBError: Nested transactions are not supported.
// Restructure your code to use a single transaction level.
```

If you need nested atomic operations, restructure to a single transaction level or use batch execution.

---

## Batch Execution

Execute multiple commands atomically in a single transaction. Rolls back on any failure.

### executeBatchSync()

```ts
const result = db.executeBatchSync([
  { query: 'INSERT INTO t VALUES (?, ?)', params: [1, 'alice'] },
  { query: 'INSERT INTO t VALUES (?, ?)', params: [2, 'bob'] },
  { query: 'UPDATE t SET name = ? WHERE id = ?', params: ['carol', 1] },
])
// result → { rowsAffected: 3 }
```

### executeBatch()

Async version:

```ts
const result = await db.executeBatch([
  { query: 'CREATE TABLE IF NOT EXISTS t (id INTEGER, name VARCHAR)' },
  { query: 'INSERT INTO t VALUES (?, ?)', params: [1, 'alice'] },
  { query: 'INSERT INTO t VALUES (?, ?)', params: [2, 'bob'] },
])
```

### BatchCommand Type

```ts
type BatchCommand = { query: string; params?: DuckDBValue[] }
type BatchResult = { rowsAffected: number }
```

### When to Use Batch vs. Transaction

| Use Case | Recommended |
|----------|-------------|
| Multiple INSERTs/UPDATEs that must all succeed | `executeBatchSync()` / `executeBatch()` |
| Logic between statements (reads, conditionals) | `executeTransaction()` / `db.transaction()` |
| Bulk data loading | `Appender` (see [Streaming & Appender](streaming.md)) |

---

## Multi-Connection

### connect()

Creates a new independent connection to the same database. Only callable on the primary database instance.

```ts
const conn1 = db.connect()
const conn2 = db.connect()

// Each connection can execute queries independently
conn1.executeSync("INSERT INTO t VALUES (1, 'from conn1')")
conn2.executeSync("INSERT INTO t VALUES (2, 'from conn2')")

conn1.close()
conn2.close()
```

### connections()

Returns information about open child connections:

```ts
const info = db.connections()
// { count: 2, ids: ['conn_1', 'conn_2'] }
```

### closeConnections()

Closes all open child connections at once:

```ts
db.closeConnections()
```

### Closing the Primary Database

`db.close()` throws if child connections are still open:

```ts
const conn = db.connect()
db.close() // throws — conn is still open

// Force close all connections first
db.close({ force: true }) // closes conn, then closes db
```

---

## Attach/Detach Databases

Attach additional database files for cross-database queries.

### attach()

```ts
db.attach('analytics.db', 'analytics')

// Query across databases
const result = db.executeSync(`
  SELECT u.name, a.event_count
  FROM main.users u
  JOIN analytics.events a ON u.id = a.user_id
`)
```

### Read-Only Attach

```ts
db.attach('archive.db', 'archive', { readOnly: true })
```

### detach()

```ts
db.detach('analytics')
```

### AttachOptions

```ts
type AttachOptions = { readOnly?: boolean; type?: string }
```

The `type` field supports DuckDB's attach type syntax (e.g., `'sqlite'` when using the `sqlite_scanner` extension):

```ts
db.attach('legacy.sqlite', 'legacy', { type: 'sqlite' })
```

---

## DuckDBError

Custom error class for DuckDB operations. Wraps native errors and adds transaction metadata when thrown from transaction contexts.

```ts
class DuckDBError extends Error {
  transaction?: TransactionInfo
  static fromError(error: unknown): DuckDBError
}
```

### TransactionInfo

```ts
type TransactionInfo = {
  statementsExecuted: number  // how many statements ran before failure
  rolledBack: boolean         // whether the transaction was rolled back
  depth: number               // nesting depth (always 0, nested not supported)
}
```

### Error Handling Pattern

```ts
import { DuckDBError, executeTransaction } from 'react-native-duckdb'

try {
  await executeTransaction(db, async (tx) => {
    tx.executeSync('INSERT INTO t VALUES (1)')
    tx.executeSync('INSERT INTO t VALUES (1)') // unique constraint violation
  })
} catch (e) {
  if (e instanceof DuckDBError && e.transaction) {
    console.log(`Failed after ${e.transaction.statementsExecuted} statements`)
    console.log(`Rolled back: ${e.transaction.rolledBack}`)
  }
}
```

### fromError()

Converts any error to a `DuckDBError`. If the input is already a `DuckDBError`, returns it as-is:

```ts
try {
  db.executeSync('INVALID SQL')
} catch (e) {
  const err = DuckDBError.fromError(e)
  // err is always a DuckDBError instance
}
```

---

## Pitfalls

- **Finalize prepared statements before closing the database.** Prepared statements hold native resources. While `executeTransaction()` auto-finalizes statements created within it, manually created statements via `db.prepare()` must be finalized with `stmt.finalize()` before `db.close()`.
- **Nested transactions throw.** DuckDB does not support `SAVEPOINT`. Restructure nested transaction patterns into a single level.
- **Child connections block close().** Call `db.closeConnections()` or use `db.close({ force: true })` before closing the primary database.
- **Batch commands share a transaction.** If any command in `executeBatchSync()` / `executeBatch()` fails, all preceding commands in the batch are rolled back.
