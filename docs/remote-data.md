# Remote Data (httpfs)

The `httpfs` extension enables querying remote Parquet, CSV, and JSON files over HTTPS directly from SQL. No download step required -- DuckDB streams the data on demand.

## Enable the extension

Add `httpfs` to your extension list, along with the format extensions you need:

```json
{
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet", "json", "httpfs"]
    }
  }
}
```

For Expo, use the plugin config in `app.json`:

```json
["react-native-duckdb", { "extensions": ["core_functions", "parquet", "json", "httpfs"] }]
```

No `LOAD` statement is needed -- httpfs activates automatically when a query references an `https://` URL.

## Query remote files

```sql
-- Remote Parquet
SELECT * FROM 'https://example.com/data.parquet';

-- Remote CSV
SELECT * FROM read_csv('https://example.com/data.csv');

-- Remote JSON
SELECT * FROM read_json('https://example.com/data.json');

-- Filter and aggregate remotely-hosted data
SELECT country, count(*) AS cnt
FROM 'https://example.com/users.parquet'
WHERE active = true
GROUP BY country
ORDER BY cnt DESC
LIMIT 10;
```

Each format requires its corresponding extension (`parquet`, `json`). CSV is built-in.

## Configuration

Configure httpfs behavior via SQL `SET` statements:

| Setting | Default | Description |
|---------|---------|-------------|
| `http_timeout` | `30` | Connection timeout in seconds |
| `http_retries` | `3` | Number of retry attempts on failure |
| `http_retry_wait_ms` | `100` | Wait between retries in milliseconds |
| `http_retry_backoff` | `4.0` | Exponential backoff multiplier |
| `http_keep_alive` | `true` | Reuse TCP connections across requests |
| `enable_server_cert_verification` | `true` | TLS certificate verification |
| `ca_cert_file` | *(none)* | Custom CA certificate file path |
| `http_proxy` | *(none)* | HTTP proxy URL |

```sql
SET http_timeout = 60;
SET http_retries = 5;
SET http_retry_wait_ms = 200;
SET http_retry_backoff = 2.0;
SET http_keep_alive = true;
```

## iOS App Transport Security

HTTPS URLs satisfy iOS ATS requirements by default. No additional configuration is needed.

For HTTP (non-secure) URLs, you would need to add an ATS exception to `Info.plist`. This is not recommended for production.

## Certificate validation

The standard OS certificate store is used for TLS validation. Custom certificate pinning is not built-in but can be configured via `SET ca_cert_file` if needed.

## Proxy support

DuckDB httpfs accepts `SET http_proxy` for proxy configuration:

```sql
SET http_proxy = 'http://proxy.example.com:8080';
```

Behavior may vary by platform. Test in your environment.

## Binary size impact

httpfs adds OpenSSL and libcurl to your app binary: approximately **2-4 MB per platform**. This is the largest binary size impact of any extension.

## Android architecture requirement

httpfs requires **64-bit ABIs** (`arm64-v8a`, `x86_64`). 32-bit ABIs (`armeabi-v7a`, `x86`) are not supported and are automatically skipped during the build.

This is a non-issue in practice -- all modern Android devices are 64-bit, and Google Play has required 64-bit support since 2019.

## Full example

```sql
-- Configure for slower networks
SET http_timeout = 60;
SET http_retries = 5;

-- Query a remote Parquet dataset
CREATE TABLE local_copy AS
    SELECT * FROM 'https://example.com/dataset.parquet'
    WHERE date >= '2024-01-01';

-- The data is now local -- no more network calls
SELECT count(*), avg(value)
FROM local_copy
GROUP BY category;
```

## Pitfalls

**Binary size.** httpfs is the heaviest extension (~2-4 MB per platform) due to OpenSSL and libcurl dependencies. Only include it if you need remote file access.

**64-bit Android only.** 32-bit ABIs are not supported. The build automatically skips httpfs for `armeabi-v7a` and `x86` targets.

**Network latency.** Remote queries are subject to network conditions. For repeated queries against the same data, materialize the result into a local table with `CREATE TABLE ... AS SELECT`.

**No S3/GCS authentication.** The mobile httpfs extension supports public HTTPS URLs. Cloud storage authentication (S3 signatures, GCS tokens) is not available on mobile.

---

*Part of [react-native-duckdb](../README.md) -- see [API Reference](API.md) for the full API.*
