export { HybridDuckDB } from './nitro'
export type { DuckDB } from './specs/DuckDB.nitro'
export type { Database } from './specs/Database.nitro'
export type { QueryResult } from './specs/QueryResult.nitro'
export type { PreparedStatement } from './specs/PreparedStatement.nitro'
export type { StreamingResult } from './specs/StreamingResult.nitro'
export type { Appender } from './specs/Appender.nitro'
export type {
  DuckDBConfig,
  DuckDBValue,
  DuckDBNamedParams,
  NumericColumn,
  ColumnData,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
  StreamingOptions,
  AppenderOptions,
} from './types'
export { DuckDBError } from './DuckDBError'
export { createWrappedDatabase, executeTransaction } from './transaction'
export type {
  WrappedDatabase,
  TransactionContext,
  TransactionInfo,
} from './transaction'
export { streamChunks } from './streaming'
export { withAppender } from './appender'
