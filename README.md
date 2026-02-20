# react-native-duckdb

High-performance DuckDB bindings for React Native, powered by [Nitro Modules](https://github.com/mrousavy/nitro). Run analytical SQL queries directly on iOS and Android with native C++ performance.

## Features

- **Synchronous & async query execution** — `executeSync()` for immediate results, `execute()` for background threads
- **Streaming results** — Process millions of rows chunk-by-chunk without OOM via `stream()` + `fetchChunk()`
- **Bulk insert with Appender** — Native DuckDB Appender for 10-100x faster inserts than individual INSERT statements
- **Columnar access** — Zero-copy typed arrays (Float64Array, BigInt64Array) via `getColumn()`
- **Prepared statements** — Compile once, execute many times with different parameters
- **Transactions** — ACID transactions with auto-rollback on error
- **Multi-connection** — Independent connections to the same database
- **Batch execution** — Execute multiple commands atomically
- **Full type support** — All DuckDB types including HUGEINT, DECIMAL, TIMESTAMP, ARRAY, MAP, STRUCT, UUID

## Installation

```bash
npm install react-native-duckdb react-native-nitro-modules
```

```bash
yarn add react-native-duckdb react-native-nitro-modules
```

```bash
bun add react-native-duckdb react-native-nitro-modules
```

For iOS, run `pod install` after installation.

## Quick Start

```ts
import { HybridDuckDB } from 'react-native-duckdb'

// Open an in-memory database
const db = HybridDuckDB.open(':memory:', {})

// Create a table and insert data
db.executeSync('CREATE TABLE users (id INTEGER, name VARCHAR, score DOUBLE)')
db.executeSync("INSERT INTO users VALUES (1, 'Alice', 95.5), (2, 'Bob', 87.3)")

// Query results
const result = db.executeSync('SELECT * FROM users ORDER BY score DESC')
const rows = result.toRows()
// [{ id: 1, name: 'Alice', score: 95.5 }, { id: 2, name: 'Bob', score: 87.3 }]

db.close()
```

## Streaming Large Datasets

```ts
import { HybridDuckDB, streamChunks } from 'react-native-duckdb'

const db = HybridDuckDB.open(':memory:', {})
const stream = await db.stream('SELECT * FROM large_table')

for await (const chunk of streamChunks(stream)) {
  const rows = chunk.toRows()
  // Process chunk-by-chunk without loading all rows into memory
}

db.close()
```

## Bulk Insert with Appender

```ts
import { HybridDuckDB, withAppender } from 'react-native-duckdb'

const db = HybridDuckDB.open(':memory:', {})
db.executeSync('CREATE TABLE measurements (ts INTEGER, sensor VARCHAR, value DOUBLE)')

await withAppender(db, 'measurements', (appender) => {
  appender.appendRows([
    [1, 'temp_a', 23.5],
    [2, 'temp_b', 24.1],
    [3, 'temp_a', 23.8],
  ])
})

db.close()
```

## Extensions

DuckDB extensions are statically linked at build time. Configure which extensions to include using your build setup below.

> **We strongly recommend `core_functions`** — without it, common SQL functions like `sum()`, `avg()`, `list_value()`, and `uuid()` won't be available.

**Query files directly** (requires the corresponding extension):

```ts
// Parquet (requires 'parquet' extension)
const result = db.executeSync("SELECT * FROM 'data.parquet'")

// CSV (built-in — no extension needed)
const result = db.executeSync("SELECT * FROM read_csv('data.csv')")
```

See [docs/API.md](docs/API.md) for the full extension reference, available extensions, SQLite scanner usage, and file query examples.

## Expo Setup

For Expo managed workflow projects using `expo prebuild`:

Add the plugin to your `app.json`:

```json
["react-native-duckdb", { "extensions": ["core_functions", "parquet"] }]
```

The `extensions` array is optional — if omitted, no extensions are built (you'll get a warning about missing `core_functions`).

After changing extensions, run `npx expo prebuild --clean` to regenerate native projects.

See [docs/EXPO.md](docs/EXPO.md) for the full Expo guide, migration instructions, and troubleshooting.

## Bare Workflow Setup

For bare React Native projects (without Expo):

Configure extensions in your app's `package.json`:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet"]
    }
  }
}
```

After changing extensions, run `pod install` (iOS) and rebuild both platforms.

## API Reference

See [docs/API.md](docs/API.md) for the complete API reference with signatures, parameters, and examples.

## License

MIT
