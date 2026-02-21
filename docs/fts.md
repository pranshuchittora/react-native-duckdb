# Full-Text Search

The `fts` extension adds BM25-ranked full-text search to react-native-duckdb with support for 27 language stemmers. Build indexes over text columns and retrieve ranked results using schema-scoped `match_bm25` functions.

## Enable the extension

Add `fts` to your extension list:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "fts"]
    }
  }
}
```

For Expo, use the plugin config in `app.json`:

```json
["react-native-duckdb", { "extensions": ["core_functions", "fts"] }]
```

Load the extension before creating indexes:

```sql
LOAD 'fts';
```

## Create an FTS index

```sql
PRAGMA create_fts_index('books', 'id', 'title', 'body',
    stemmer='english',
    stopwords='english',
    strip_accents=1,
    lower=1,
    overwrite=0
);
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| 1st arg | *(required)* | Table name |
| 2nd arg | *(required)* | Unique ID column |
| 3rd+ args | *(required)* | One or more text columns to index |
| `stemmer` | `'porter'` | Language stemmer (see [available stemmers](#available-stemmers)) |
| `stopwords` | `'english'` | `'english'`, `'none'`, or a custom stopword table name |
| `strip_accents` | `1` | Accent-insensitive matching |
| `lower` | `1` | Case-insensitive matching |
| `overwrite` | `0` | Overwrite an existing index on the same table |

## Search with BM25

The search function follows the pattern `fts_main_<table>.match_bm25(id_column, query)`. The function name is **schema-scoped** -- it includes the table name as a prefix.

```sql
SELECT id, title, score
FROM (
    SELECT *, fts_main_books.match_bm25(id, 'search query') AS score
    FROM books
) sq
WHERE score IS NOT NULL
ORDER BY score DESC;
```

> The function is `fts_main_<table>.match_bm25(...)`, not a standalone `match_bm25('table', ...)`. The schema name follows the pattern `fts_main_<table_name>`.

## Field-specific search

Restrict the search to specific indexed columns with the `fields` parameter:

```sql
SELECT *, fts_main_books.match_bm25(id, 'database', fields := 'title') AS score
FROM books
WHERE score IS NOT NULL
ORDER BY score DESC;
```

## match_bm25 parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `k` | `1.2` | Term frequency saturation. Higher values increase the impact of term frequency. |
| `b` | `0.75` | Document length normalization. `0` = no normalization, `1` = full normalization. |
| `conjunctive` | `0` | Set to `1` to require ALL search terms to match (AND semantics). Default is OR. |
| `fields` | *(all)* | Restrict search to a specific indexed column name. |

```sql
-- Require all terms, reduce length normalization
SELECT *, fts_main_articles.match_bm25(
    id, 'duckdb mobile react native',
    conjunctive := 1,
    b := 0.5
) AS score
FROM articles
WHERE score IS NOT NULL
ORDER BY score DESC;
```

## Stemmer verification

Test how a word is stemmed for a given language before building an index:

```sql
SELECT stem('running', 'english');   -- 'run'
SELECT stem('databases', 'english'); -- 'databas'
SELECT stem('mangeons', 'french');   -- 'mang'
```

## Available stemmers

27 languages are supported:

arabic, basque, catalan, danish, dutch, english, finnish, french, german, greek, hindi, hungarian, indonesian, irish, italian, lithuanian, nepali, norwegian, porter, portuguese, romanian, russian, serbian, spanish, swedish, tamil, turkish

## Drop and recreate indexes

The FTS index is a **static snapshot** of your data at creation time. After inserting, updating, or deleting rows, drop and recreate the index to reflect changes.

```sql
-- Drop the existing index
PRAGMA drop_fts_index('books');

-- Recreate with updated data or different parameters
PRAGMA create_fts_index('books', 'id', 'title', 'body', stemmer='english');
```

## Full example

```sql
LOAD 'fts';

CREATE TABLE docs (id INTEGER PRIMARY KEY, title VARCHAR, body VARCHAR);
INSERT INTO docs VALUES
    (1, 'Getting Started with DuckDB', 'DuckDB is an in-process analytical database...'),
    (2, 'React Native Performance', 'Optimizing mobile app performance requires...'),
    (3, 'SQL Analytics on Mobile', 'Run analytical SQL queries directly on device...');

PRAGMA create_fts_index('docs', 'id', 'title', 'body', stemmer='english');

-- Search across all indexed fields
SELECT id, title, score
FROM (
    SELECT *, fts_main_docs.match_bm25(id, 'analytics mobile') AS score
    FROM docs
) sq
WHERE score IS NOT NULL
ORDER BY score DESC;

-- After adding new rows, recreate the index
INSERT INTO docs VALUES (4, 'New Article', 'Content about databases...');
PRAGMA drop_fts_index('docs');
PRAGMA create_fts_index('docs', 'id', 'title', 'body', stemmer='english');
```

## Pitfalls

**Static snapshot index.** The FTS index does not auto-update. After any INSERT, UPDATE, or DELETE, you must `PRAGMA drop_fts_index` and recreate it. There is no incremental update mechanism.

**No CJK tokenization.** The Snowball stemmer splits on whitespace only. Chinese, Japanese, and Korean text is not properly tokenized -- individual characters are not searchable as words.

**In-memory databases lose the index on close.** The FTS index is stored in DuckDB's schema. Closing an in-memory database discards it entirely.

**Android rowid overflow bug.** DuckDB's FTS extension may fail on Android with `Information loss on integer cast` during index creation. The FTS indexing script uses `SELECT rowid AS docid` internally, and on Android the `rowid` for in-memory tables can produce unsigned 64-bit values that overflow signed `int64`. FTS indexing works reliably on iOS. The `stem()` function works on both platforms. See [duckdb/duckdb-fts#24](https://github.com/duckdb/duckdb-fts/issues/24).

**Binary size impact.** Minimal -- FTS adds the Snowball stemmer library (~35 source files) with no external dependencies.

---

*Part of [react-native-duckdb](../README.md) -- see [API Reference](API.md) for the full API.*
