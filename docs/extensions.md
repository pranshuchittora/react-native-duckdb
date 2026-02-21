# Extensions

DuckDB's power comes from its extension system. On mobile, extensions are **statically linked** at build time — you choose which ones to include, and they become part of your native binary. There is no runtime `INSTALL` command.

## Configuration

### Bare React Native

Add extensions to your app's `package.json`:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet", "json"]
    }
  }
}
```

### Expo

Add the plugin to `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "plugins": [
      ["react-native-duckdb", { "extensions": ["core_functions", "parquet", "json"] }]
    ]
  }
}
```

Then run `npx expo prebuild --clean`.

When both `package.json` and `app.json` are configured, `app.json` takes priority.

### Defaults

No extensions are included by default. You must explicitly list every extension you need. Invalid extension names cause a build error with a clear message.

> **`core_functions` is essential.** Without it, common SQL functions like `sum()`, `avg()`, `list_value()`, `string_split()`, and `uuid()` are unavailable. Add it to every project.

## Available Extensions

| Extension | Description | Required For |
|-----------|-------------|-------------|
| `core_functions` | Essential SQL functions (sum, avg, list_value, uuid, etc.) | Basic SQL operations — **strongly recommended** |
| `parquet` | Apache Parquet file format support | `SELECT * FROM 'file.parquet'` |
| `json` | JSON file format support | `read_json('file.json')` |
| `icu` | Unicode collation and text functions | Locale-aware sorting and string operations |
| `sqlite_scanner` | Read and write SQLite databases | `ATTACH 'file.sqlite' (TYPE sqlite)` |
| `httpfs` | Remote file access over HTTPS | `SELECT * FROM 'https://url/data.parquet'` |
| `fts` | BM25 full-text search with 27 language stemmers | `PRAGMA create_fts_index(...)` |
| `vss` | HNSW vector similarity search | `CREATE INDEX ... USING HNSW (vec)` |
| `autocomplete` | SQL autocomplete suggestions | Editor integrations |
| `tpch` | TPC-H benchmark data generator | Benchmarking |
| `tpcds` | TPC-DS benchmark data generator | Benchmarking |
| `delta` | Delta Lake table format | Reading Delta Lake tables |

---

## File Queries

DuckDB queries files directly. Each format requires its extension (except CSV, which is built-in).

### Parquet

Requires `parquet` extension.

```ts
// Simple read
const result = db.executeSync("SELECT * FROM 'data.parquet'")

// Analytical query
const stats = db.executeSync(`
  SELECT count(*), avg(value)
  FROM 'measurements.parquet'
  WHERE sensor = 'temp'
`)
```

### CSV

Built-in — no extension needed.

```ts
const result = db.executeSync("SELECT * FROM read_csv('data.csv')")

// Custom delimiter and header
const tsv = db.executeSync("SELECT * FROM read_csv('data.tsv', delim='\\t', header=true)")
```

### JSON

Requires `json` extension.

```ts
const result = db.executeSync("SELECT * FROM read_json('data.json')")

// Newline-delimited JSON
const events = db.executeSync("SELECT * FROM read_json('events.jsonl', format='newline_delimited')")
```

### File Paths on Mobile

Files must be in the app's documents directory or bundled with the app. When using a file-based database (`HybridDuckDB.open('name.db', {})`), relative paths in file queries and `COPY TO` resolve from the database file's directory.

---

## SQLite Scanner

Read and write SQLite databases from DuckDB. Requires the `sqlite_scanner` extension.

```ts
// Attach a SQLite database
db.executeSync("ATTACH 'path/to/database.sqlite' AS mydb (TYPE sqlite)")

// Query tables from the attached SQLite database
const users = db.executeSync("SELECT * FROM mydb.users WHERE active = 1")

// Detach when done
db.executeSync("DETACH mydb")
```

This enables migration paths from SQLite to DuckDB, or querying existing SQLite databases without converting them.

---

## Remote Queries (httpfs)

The `httpfs` extension queries files over HTTPS — Parquet, CSV, and JSON hosted anywhere on the web.

### Configuration

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet", "json", "httpfs"]
    }
  }
}
```

### Usage

```ts
// Remote Parquet
const result = await db.execute("SELECT * FROM 'https://example.com/data.parquet'")

// Remote CSV
const csv = await db.execute("SELECT * FROM read_csv('https://example.com/data.csv')")

// Remote JSON
const json = await db.execute("SELECT * FROM read_json('https://example.com/data.json')")
```

### httpfs Settings

Configure via SQL `SET` statements:

| Setting | Default | Description |
|---------|---------|-------------|
| `http_timeout` | `30` | Connection timeout in seconds |
| `http_retries` | `3` | Number of retry attempts |
| `http_retry_wait_ms` | `100` | Wait between retries in milliseconds |
| `http_retry_backoff` | `4.0` | Exponential backoff multiplier |
| `http_keep_alive` | `true` | Reuse connections |
| `enable_server_cert_verification` | `true` | TLS certificate verification |
| `ca_cert_file` | (none) | Custom CA certificate file path |

```ts
db.executeSync("SET http_timeout = 30")
db.executeSync("SET http_retries = 3")
```

### Platform Notes

- **iOS ATS:** HTTPS URLs satisfy App Transport Security by default. HTTP URLs require an ATS exception in `Info.plist`.
- **Certificate validation:** Uses the OS certificate store. Custom pinning via `SET ca_cert_file` if needed.
- **Binary size:** httpfs adds OpenSSL + libcurl (~2-4 MB per platform).
- **Android:** Requires 64-bit ABIs (`arm64-v8a`, `x86_64`). 32-bit ABIs are automatically skipped. This is a non-issue — all modern Android devices are 64-bit and Google Play has required it since 2019.

---

## Full-Text Search (fts)

BM25-ranked full-text search with 27 language stemmers. Build indexes over text columns and retrieve ranked results.

### Setup

Add `fts` to your extensions, then load it at runtime:

```ts
db.executeSync("LOAD 'fts'")
```

### Creating an Index

```ts
db.executeSync(`
  PRAGMA create_fts_index('articles', 'id', 'title', 'body',
    stemmer='english',
    stopwords='english',
    strip_accents=1,
    lower=1,
    overwrite=0
  )
`)
```

The first argument is the table name, second is the unique ID column, followed by text columns to index. The index is a **static snapshot** — it must be dropped and recreated after data changes.

### Searching

```ts
const results = db.executeSync(`
  SELECT id, title, score
  FROM (
    SELECT *, fts_main_articles.match_bm25(id, 'search query') AS score
    FROM articles
  ) sq
  WHERE score IS NOT NULL
  ORDER BY score DESC
`)
```

> The function is schema-scoped: `fts_main_<table>.match_bm25(...)`. The schema name follows the pattern `fts_main_<table_name>`.

### Field-Specific Search

```ts
const results = db.executeSync(`
  SELECT *, fts_main_books.match_bm25(id, 'database', fields := 'title') AS score
  FROM books WHERE score IS NOT NULL ORDER BY score DESC
`)
```

### match_bm25 Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `k` | `1.2` | Term frequency saturation |
| `b` | `0.75` | Document length normalization (0 = none, 1 = full) |
| `conjunctive` | `0` | Set to `1` to require ALL terms match |

### Managing Indexes

```ts
// Drop an index
db.executeSync("PRAGMA drop_fts_index('articles')")

// Test stemming
const stem = db.executeSync("SELECT stem('running', 'english')")
// → 'run'
```

### Available Stemmers (27 languages)

arabic, basque, catalan, danish, dutch, english, finnish, french, german, greek, hindi, hungarian, indonesian, irish, italian, lithuanian, nepali, norwegian, porter, portuguese, romanian, russian, serbian, spanish, swedish, tamil, turkish

### Limitations

- **Static snapshot** — The index does not auto-update. After INSERT/UPDATE/DELETE, drop and recreate it.
- **No CJK tokenization** — The Snowball stemmer splits on whitespace only. Chinese, Japanese, and Korean text won't be properly tokenized.
- **In-memory DB** — Closing an in-memory database discards the index.
- **Android rowid bug** — FTS index creation may fail on Android with "Information loss on integer cast" due to internal `rowid` overflow. FTS works reliably on iOS. The `stem()` function works on both platforms. See [duckdb/duckdb-fts#24](https://github.com/duckdb/duckdb-fts/issues/24).

### Binary Size

Minimal — adds the Snowball stemmer library (~35 source files), no external dependencies.

---

## Vector Similarity Search (vss)

HNSW (Hierarchical Navigable Small Worlds) indexing for approximate nearest-neighbor search on fixed-size float arrays. This makes react-native-duckdb the first mobile database with native on-device vector search.

### Setup

Add `vss` to your extensions, then load it at runtime:

```ts
db.executeSync("LOAD 'vss'")
```

### Creating Tables with Vectors

```ts
db.executeSync("CREATE TABLE embeddings (id INTEGER, label VARCHAR, vec FLOAT[384])")

db.executeSync(
  "INSERT INTO embeddings VALUES (?, ?, ?)",
  [1, 'hello world', '[0.1, 0.2, ...]']
)
```

### Creating HNSW Indexes

```ts
// Cosine distance (recommended for normalized embeddings)
db.executeSync("CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine')")

// L2 / euclidean distance
db.executeSync("CREATE INDEX idx_l2 ON embeddings USING HNSW (vec)")

// Inner product
db.executeSync("CREATE INDEX idx_ip ON embeddings USING HNSW (vec) WITH (metric = 'ip')")
```

### Querying Nearest Neighbors

```ts
// Cosine distance
const results = db.executeSync(`
  SELECT id, label, array_cosine_distance(vec, $query_vec) AS distance
  FROM embeddings
  ORDER BY distance LIMIT 10
`)

// L2 / euclidean distance
const results = db.executeSync(`
  SELECT id, label, array_distance(vec, $query_vec) AS distance
  FROM embeddings
  ORDER BY distance LIMIT 10
`)
```

### Distance Metrics

| Metric | SQL Function | Index Parameter | Best For |
|--------|-------------|-----------------|----------|
| Cosine | `array_cosine_distance(a, b)` | `metric = 'cosine'` | Normalized embeddings (sentence-transformers, OpenAI) |
| L2 (Euclidean) | `array_distance(a, b)` | `metric = 'l2sq'` | Raw feature vectors, image embeddings |
| Inner Product | `array_negative_inner_product(a, b)` | `metric = 'ip'` | Maximum inner product search |

### Use Cases

**On-Device RAG** — Retrieve context chunks for local LLM inference without network calls:

```sql
SELECT chunk_text FROM knowledge_base
ORDER BY array_cosine_distance(embedding, $question_vec) LIMIT 5;
```

**Semantic Search** — Find semantically similar documents:

```sql
SELECT id, title, array_cosine_distance(embedding, $query_vec) AS distance
FROM documents ORDER BY distance LIMIT 10;
```

**Recommendations** — Find similar items by feature vectors:

```sql
SELECT product_id, name, array_distance(features, $user_vec) AS distance
FROM products ORDER BY distance LIMIT 20;
```

### Verifying Index Usage

```ts
const plan = db.executeSync(`
  EXPLAIN SELECT id FROM embeddings
  ORDER BY array_cosine_distance(vec, [0.1, 0.2]::FLOAT[384]) LIMIT 10
`)
// Look for HNSW_INDEX_SCAN in the output
```

### Limitations

- **In-memory only** — HNSW indexes are not persisted. Recreate each session.
- **LIMIT required** — Index acceleration only activates with `ORDER BY <distance_fn>(...) LIMIT N`.
- **Metric must match** — A cosine index only accelerates `array_cosine_distance()`. Using the wrong function falls back to brute-force.
- **Fixed-size arrays only** — Use `FLOAT[N]` (fixed), not `FLOAT[]` (variable).

### Binary Size

Minimal — header-only C++ (usearch + simsimd vendored). No external dependencies.

---

## Runtime Loading

On mobile, all extensions are statically linked. The `LOAD` statement is a no-op for extensions in your build config:

```ts
// Succeeds as no-op if parquet is in your build config
db.executeSync("LOAD 'parquet'")
```

- **iOS** prohibits dynamic loading (`dlopen`) — runtime installation from the network is not supported
- **Android** uses the same static-only model for consistency and security

Check which extensions are available:

```ts
const exts = db.executeSync("SELECT extension_name, loaded, installed FROM duckdb_extensions()")
```

---

## Platform Notes

### iOS

After changing extensions, run `pod install` to trigger a rebuild of the DuckDB xcframework with the updated extension set.

### Android

Extensions are compiled via CMake. After changing the extension list, the next build picks up the new configuration. Clean `.cxx` if builds seem stale:

```bash
rm -rf android/.cxx
```

### Pitfalls

- **Changing extensions requires a full native rebuild.** A JS-only reload (Fast Refresh) will not pick up extension changes.
- **No runtime INSTALL.** `INSTALL httpfs` and similar commands will fail. All extensions must be configured at build time.
- **Invalid names fail the build.** A typo in the extension list produces a build error, not a runtime error.
