export type DuckDBConfig = Record<string, string>
// Nitro variant — maps to std::variant<std::monostate, bool, double, int64_t, std::string, std::shared_ptr<ArrayBuffer>>
export type DuckDBValue = null | boolean | number | bigint | string | ArrayBuffer
