export { HybridDuckDB } from './nitro'
export type { DuckDB } from './specs/DuckDB.nitro'
export type { Database } from './specs/Database.nitro'
export type { QueryResult } from './specs/QueryResult.nitro'
export type { PreparedStatement } from './specs/PreparedStatement.nitro'
export type {
  DuckDBConfig,
  DuckDBValue,
  NumericColumn,
  ColumnData,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
} from './types'
export { DuckDBError } from './DuckDBError'
export { createWrappedDatabase, executeTransaction } from './transaction'
export type {
  WrappedDatabase,
  TransactionContext,
  TransactionInfo,
} from './transaction'
