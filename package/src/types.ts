import type { Int64 } from 'react-native-nitro-modules'

export type DuckDBConfig = Record<string, string>
// Nitro variant — maps to std::variant<std::monostate, bool, double, int64_t, std::string, std::shared_ptr<ArrayBuffer>>
export type DuckDBValue = null | boolean | number | Int64 | string | ArrayBuffer

export interface NumericColumn {
  data: ArrayBuffer
  validity: ArrayBuffer
  dtype: string
}
export type ColumnData = NumericColumn | (string | null)[]

export type BatchCommand = { query: string; params?: DuckDBValue[] }
export type BatchResult = { rowsAffected: number }
export type AttachOptions = { readOnly?: boolean; type?: string }
export type CloseOptions = { force?: boolean }
export type ConnectionInfo = { count: number; ids: string[] }
export type StreamingOptions = { bufferSize?: number }
