export type DuckDBConfig = Record<string, string>
// Nitro variant — maps to std::variant<std::monostate, bool, double, int64_t, std::string, std::shared_ptr<ArrayBuffer>>
export type DuckDBValue = null | boolean | number | bigint | string | ArrayBuffer

export type BatchCommand = { query: string; params?: DuckDBValue[] }
export type BatchResult = { rowsAffected: number }
export type AttachOptions = { readOnly?: boolean; type?: string }
export type CloseOptions = { force?: boolean }
export type ConnectionInfo = { count: number; ids: string[] }
