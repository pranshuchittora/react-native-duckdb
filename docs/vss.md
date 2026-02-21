# Vector Similarity Search

The `vss` extension adds HNSW (Hierarchical Navigable Small Worlds) indexing for approximate nearest-neighbor search on fixed-size float arrays. This makes react-native-duckdb the first mobile database with native on-device vector search.

## Enable the extension

Add `vss` to your extension list:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "vss"]
    }
  }
}
```

For Expo, use the plugin config in `app.json`:

```json
["react-native-duckdb", { "extensions": ["core_functions", "vss"] }]
```

Load the extension before creating indexes:

```sql
LOAD 'vss';
```

## Create tables with vector columns

Store embedding vectors using DuckDB's fixed-size `FLOAT[N]` array type:

```sql
CREATE TABLE embeddings (
    id INTEGER,
    label VARCHAR,
    vec FLOAT[384]
);

INSERT INTO embeddings VALUES
    (1, 'hello world', [0.1, 0.2, ...]::FLOAT[384]);
```

The dimension `N` must be fixed at table creation time. Use `FLOAT[N]`, not `FLOAT[]`.

## Create HNSW indexes

```sql
-- L2 / euclidean distance (default)
CREATE INDEX idx ON embeddings USING HNSW (vec);

-- Cosine distance (recommended for normalized embeddings)
CREATE INDEX idx_cosine ON embeddings USING HNSW (vec)
    WITH (metric = 'cosine');

-- Inner product
CREATE INDEX idx_ip ON embeddings USING HNSW (vec)
    WITH (metric = 'ip');
```

## Query nearest neighbors

Use the distance function that matches your index metric, with `ORDER BY ... LIMIT N`:

```sql
-- Cosine distance
SELECT id, label,
    array_cosine_distance(vec, $query_vec) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;

-- L2 / euclidean distance
SELECT id, label,
    array_distance(vec, $query_vec) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;

-- Negative inner product
SELECT id, label,
    array_negative_inner_product(vec, $query_vec) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;
```

## Distance metrics

| Metric | SQL function | Index parameter | Best for |
|--------|-------------|-----------------|----------|
| Cosine | `array_cosine_distance(a, b)` | `metric = 'cosine'` | Normalized embeddings (sentence-transformers, OpenAI) |
| L2 (Euclidean) | `array_distance(a, b)` | `metric = 'l2sq'` | Raw feature vectors, image embeddings |
| Inner Product | `array_negative_inner_product(a, b)` | `metric = 'ip'` | Maximum inner product search, dot-product similarity |

## Verify index usage

Use `EXPLAIN` to confirm the query plan includes `HNSW_INDEX_SCAN`:

```sql
EXPLAIN SELECT id FROM embeddings
ORDER BY array_cosine_distance(vec, [0.1, 0.2, ...]::FLOAT[384])
LIMIT 10;
-- Look for HNSW_INDEX_SCAN in the output
```

If you see a sequential scan instead, check that:
1. The distance function matches the index metric
2. The query includes a `LIMIT` clause
3. The `ORDER BY` expression uses the indexed column

## Use cases

### Semantic search

Store document embeddings from sentence-transformers or OpenAI, then find the most semantically similar documents to a query:

```sql
SELECT id, title,
    array_cosine_distance(embedding, $query_vec) AS distance
FROM documents
ORDER BY distance
LIMIT 10;
```

### On-device RAG

Retrieve relevant context chunks for local LLM inference without network calls. Store your knowledge base embeddings on-device and query them with zero latency:

```sql
SELECT chunk_text FROM knowledge_base
ORDER BY array_cosine_distance(embedding, $question_vec)
LIMIT 5;
```

### Recommendations

Find similar items based on feature vectors -- product recommendations, content suggestions, or user-to-user similarity, all computed locally:

```sql
SELECT product_id, name,
    array_distance(features, $user_vec) AS distance
FROM products
ORDER BY distance
LIMIT 20;
```

## Full example

```sql
LOAD 'vss';

CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    title VARCHAR,
    embedding FLOAT[4]
);

INSERT INTO items VALUES
    (1, 'Red shoes',    [0.9, 0.1, 0.0, 0.2]::FLOAT[4]),
    (2, 'Blue jacket',  [0.1, 0.8, 0.3, 0.1]::FLOAT[4]),
    (3, 'Red hat',      [0.85, 0.15, 0.05, 0.25]::FLOAT[4]),
    (4, 'Green pants',  [0.2, 0.3, 0.9, 0.1]::FLOAT[4]);

CREATE INDEX items_vec_idx ON items USING HNSW (embedding)
    WITH (metric = 'cosine');

-- Find items most similar to "Red shoes"
SELECT id, title,
    array_cosine_distance(embedding, [0.9, 0.1, 0.0, 0.2]::FLOAT[4]) AS distance
FROM items
ORDER BY distance
LIMIT 3;
```

## Pitfalls

**HNSW indexes are in-memory only.** Indexes are not persisted across database close/reopen. They must be recreated each session. For in-memory databases this is a non-issue since the data itself is also ephemeral.

**LIMIT clause required for acceleration.** HNSW index acceleration only activates when the query includes `ORDER BY <distance_function>(...) LIMIT N`. Without `LIMIT`, DuckDB falls back to brute-force sequential scanning.

**Distance function must match index metric.** A cosine index only accelerates `array_cosine_distance()` queries. Using `array_distance()` on a cosine index falls back to brute-force. Always pair the correct function with the correct metric.

**Fixed-size arrays only.** Vector columns must use `FLOAT[N]` (fixed-size), not `FLOAT[]` (variable-size). DuckDB will reject HNSW index creation on variable-size arrays.

**Binary size impact.** Minimal -- VSS is header-only C++ (usearch + simsimd libraries vendored in the extension). No external system dependencies.

---

*Part of [react-native-duckdb](../README.md) -- see [API Reference](API.md) for the full API.*
