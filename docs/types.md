# Type System

react-native-duckdb maps DuckDB's type system to JavaScript values via Nitro Modules. This guide covers every type conversion, columnar access, parameter binding, and edge cases.

## Basic Types

| DuckDB Type | JS Type | `toRows()` Value | Notes |
|-------------|---------|-------------------|-------|
| `BOOLEAN` | `boolean` | `true` / `false` | |
| `TINYINT` | `number` | `42` | |
| `SMALLINT` | `number` | `42` | |
| `INTEGER` | `number` | `42` | |
| `FLOAT` | `number` | `3.14` | |
| `DOUBLE` | `number` | `3.14` | |
| `UTINYINT` | `number` | `42` | |
| `USMALLINT` | `number` | `42` | |
| `UINTEGER` | `number` | `42` | |
| `BIGINT` | `BigInt` | `42n` | Maps to JS BigInt via int64 |
| `UBIGINT` | `BigInt` | `42n` | Cast to int64; may lose precision beyond 2^63 |
| `VARCHAR` | `string` | `"hello"` | |
| `NULL` | `null` | `null` | Any column can contain nulls |

```ts
const result = db.executeSync("SELECT 42 AS i, 3.14 AS f, 'hello' AS s, true AS b")
const row = result.toRows()[0]
// row.i → 42 (number)
// row.f → 3.14 (number)
// row.s → 'hello' (string)
// row.b → true (boolean)
```

## Large Integer Types

| DuckDB Type | JS Type | Representation | Reason |
|-------------|---------|----------------|--------|
| `HUGEINT` | `string` | `"170141183460469231731687303715884105727"` | Exceeds Number.MAX_SAFE_INTEGER and BigInt range |
| `UHUGEINT` | `string` | `"340282366920938463463374607431768211455"` | Same |
| `DECIMAL` | `string` | `"123.45"` | Lossless fixed-point representation |

> **Pitfall:** `HUGEINT`, `UHUGEINT`, and `DECIMAL` return strings to avoid precision loss. Parse them with `BigInt()` or a decimal library if you need arithmetic.

```ts
const result = db.executeSync("SELECT 123.45::DECIMAL(10,2) AS d, 170141183460469231731687303715884105727::HUGEINT AS h")
const row = result.toRows()[0]
// row.d → '123.45' (string)
// row.h → '170141183460469231731687303715884105727' (string)
```

## Temporal Types

All temporal types return as **strings** in ISO 8601 format. Timestamps use `T` as the date-time separator.

| DuckDB Type | JS Type | Example Value |
|-------------|---------|---------------|
| `DATE` | `string` | `"2024-01-15"` |
| `TIME` | `string` | `"13:45:30"` |
| `TIME WITH TIME ZONE` | `string` | `"13:45:30+00"` |
| `TIMESTAMP` | `string` | `"2024-01-15T13:45:30"` |
| `TIMESTAMP_S` | `string` | `"2024-01-15T13:45:30"` |
| `TIMESTAMP_MS` | `string` | `"2024-01-15T13:45:30.123"` |
| `TIMESTAMP_NS` | `string` | `"2024-01-15T13:45:30.123456789"` |
| `TIMESTAMP WITH TIME ZONE` | `string` | `"2024-01-15T13:45:30+00"` |
| `INTERVAL` | `string` | `"1 year 2 months 3 days"` |

```ts
const result = db.executeSync("SELECT TIMESTAMP '2024-01-15 13:45:30' AS ts, DATE '2024-01-15' AS d")
const row = result.toRows()[0]
// row.ts → '2024-01-15T13:45:30' (string, T separator)
// row.d → '2024-01-15' (string)
```

Timestamps are compatible with `new Date()` parsing:

```ts
const date = new Date(row.ts) // Works — ISO 8601 with T separator
```

## Complex Types

Complex types are serialized to **JSON strings** via `toRows()`. Parse with `JSON.parse()`.

| DuckDB Type | JS Type | JSON Representation |
|-------------|---------|---------------------|
| `LIST` | `string` | `"[1,2,3]"` |
| `ARRAY` (fixed-size) | `string` | `"[1,2,3]"` |
| `STRUCT` | `string` | `"{\"name\":\"alice\",\"age\":30}"` |
| `MAP` | `string` | `"[{\"key\":\"a\",\"value\":1},{\"key\":\"b\",\"value\":2}]"` |
| `UNION` | `string` | `"{\"tag\":\"str\",\"value\":\"hello\"}"` |

```ts
const result = db.executeSync("SELECT [1, 2, 3] AS list, {'name': 'alice', 'age': 30} AS obj")
const row = result.toRows()[0]
const list = JSON.parse(row.list)  // [1, 2, 3]
const obj = JSON.parse(row.obj)    // { name: 'alice', age: 30 }
```

### MAP Format

Maps serialize as an array of `{key, value}` objects:

```ts
const result = db.executeSync("SELECT MAP {'a': 1, 'b': 2} AS m")
const map = JSON.parse(result.toRows()[0].m)
// [{ key: 'a', value: 1 }, { key: 'b', value: 2 }]
```

### UNION Format

Unions serialize with a `tag` and `value`:

```ts
const result = db.executeSync("SELECT union_value(str := 'hello') AS u")
const u = JSON.parse(result.toRows()[0].u)
// { tag: 'str', value: 'hello' }
```

### Nested Complex Types

JSON serialization is recursive. Nested structs, lists, and maps produce nested JSON:

```ts
const result = db.executeSync("SELECT {'items': [1, 2], 'meta': {'k': 'v'}} AS nested")
const nested = JSON.parse(result.toRows()[0].nested)
// { items: [1, 2], meta: { k: 'v' } }
```

## Special Types

| DuckDB Type | JS Type | Example Value |
|-------------|---------|---------------|
| `UUID` | `string` | `"550e8400-e29b-41d4-a716-446655440000"` |
| `ENUM` | `string` | `"active"` |
| `BIT` | `string` | `"0110"` |
| `BLOB` | `ArrayBuffer` | Binary data |

```ts
// UUID (requires core_functions extension)
const result = db.executeSync("SELECT uuid() AS id")
// row.id → '550e8400-e29b-41d4-a716-446655440000'

// BLOB
const result = db.executeSync("SELECT '\\x48656C6C6F'::BLOB AS b")
const buf = result.toRows()[0].b  // ArrayBuffer
const text = new TextDecoder().decode(new Uint8Array(buf))  // 'Hello'
```

---

## Columnar Access

`getColumn(index)` returns data in a format optimized for the column's type, avoiding per-row object allocation.

### Numeric Columns

For `TINYINT`, `SMALLINT`, `INTEGER`, `UTINYINT`, `USMALLINT`, `UINTEGER`, `FLOAT`, `DOUBLE`, `getColumn()` returns a `NumericColumn`:

```ts
interface NumericColumn {
  data: ArrayBuffer    // Float64Array data
  validity: ArrayBuffer // Uint8Array null bitmap (1 = valid, 0 = null)
  dtype: 'float64'
}
```

```ts
const col = result.getColumn(0)
if ('data' in col) {
  const data = new Float64Array(col.data)
  const validity = new Uint8Array(col.validity)
  for (let i = 0; i < data.length; i++) {
    if (validity[i]) {
      // data[i] is a valid number
    }
  }
}
```

### BigInt Columns

For `BIGINT` and `UBIGINT`, `getColumn()` returns a `NumericColumn` with `dtype: 'bigint64'`:

```ts
const col = result.getColumn(0)  // BIGINT column
if ('data' in col) {
  const data = new BigInt64Array(col.data)
  const validity = new Uint8Array(col.validity)
  // data[i] is a BigInt value
}
```

### Boolean Columns

For `BOOLEAN`, `getColumn()` returns a `NumericColumn` with `dtype: 'uint8'`:

```ts
const col = result.getColumn(0)  // BOOLEAN column
if ('data' in col) {
  const data = new Uint8Array(col.data)
  const validity = new Uint8Array(col.validity)
  // data[i] is 1 (true) or 0 (false)
}
```

### String/Complex Columns

All other types (`VARCHAR`, temporal types, complex types, special types) return `(string | null)[]`:

```ts
const col = result.getColumn(0)  // VARCHAR column
if (Array.isArray(col)) {
  for (const val of col) {
    if (val !== null) {
      // val is a string
    }
  }
}
```

### dtype Summary

| Column Types | `dtype` | JS Typed Array |
|-------------|---------|----------------|
| `TINYINT`, `SMALLINT`, `INTEGER`, `UTINYINT`, `USMALLINT`, `UINTEGER`, `FLOAT`, `DOUBLE` | `'float64'` | `Float64Array` |
| `BIGINT`, `UBIGINT` | `'bigint64'` | `BigInt64Array` |
| `BOOLEAN` | `'uint8'` | `Uint8Array` |
| Everything else | N/A | `(string \| null)[]` |

---

## Parameter Binding

### DuckDBValue Union Type

Values passed as query parameters must be one of:

```ts
type DuckDBValue = null | boolean | number | Int64 | string | ArrayBuffer
```

This maps to the C++ variant: `std::variant<std::monostate, bool, double, int64_t, std::string, std::shared_ptr<ArrayBuffer>>`.

### Positional Parameters

Use `?` placeholders:

```ts
db.executeSync('INSERT INTO t VALUES (?, ?, ?)', [42, 'hello', true])
db.executeSync('SELECT * FROM t WHERE id = ?', [42])
```

### Named Parameters

Use `$name` placeholders. Keys in the params object omit the `$` prefix. Matching is case-insensitive.

```ts
db.executeSyncNamed(
  'SELECT * FROM users WHERE name = $name AND age > $minAge',
  { name: 'Alice', minAge: 25 }
)
```

### Binding JS Types to DuckDB

| JS Value | DuckDB Receives | Notes |
|----------|-----------------|-------|
| `null` | `NULL` | |
| `true` / `false` | `BOOLEAN` | |
| `42` | `DOUBLE` | All JS numbers are IEEE 754 doubles |
| `42n` (BigInt) | `BIGINT` (int64) | |
| `'hello'` | `VARCHAR` | Also used for dates, timestamps, etc. |
| `ArrayBuffer` | `BLOB` | |

```ts
// Binding various types
db.executeSync('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?)', [
  null,                          // NULL
  true,                          // BOOLEAN
  42,                            // passed as double, DuckDB casts to column type
  BigInt(9007199254740993),      // BIGINT — beyond Number.MAX_SAFE_INTEGER
  'hello',                       // VARCHAR
  new Uint8Array([1, 2, 3]).buffer  // BLOB
])
```

### DuckDBNamedParams

```ts
type DuckDBNamedParams = Record<string, DuckDBValue>
```

---

## Pitfalls

- **HUGEINT and DECIMAL return strings.** If you need to do arithmetic, parse them with `BigInt()` or a decimal library. Direct numeric operations will fail or lose precision.
- **Complex types are JSON strings.** `LIST`, `STRUCT`, `MAP`, `ARRAY`, and `UNION` return JSON strings from `toRows()`. Always call `JSON.parse()` before using the values.
- **JS numbers are doubles.** When binding a `number` parameter, DuckDB receives a `double`. For integer values beyond `Number.MAX_SAFE_INTEGER` (2^53 - 1), use `BigInt` instead.
- **Temporal types are strings, not Date objects.** You must construct `Date` objects yourself. The ISO 8601 format with `T` separator is compatible with `new Date()`.
- **BLOB is ArrayBuffer, not Uint8Array.** Wrap in a typed array view if you need indexed access: `new Uint8Array(blob)`.
