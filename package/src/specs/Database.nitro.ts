import type { HybridObject } from 'react-native-nitro-modules'
import type {
  DuckDBValue,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
  AppenderOptions,
} from '../types'
import type { QueryResult } from './QueryResult.nitro'
import type { PreparedStatement } from './PreparedStatement.nitro'
import type { StreamingResult } from './StreamingResult.nitro'
import type { Appender } from './Appender.nitro'

export interface Database extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly isOpen: boolean
  close(options?: CloseOptions): void
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement

  // Query cancellation
  cancel(): void

  // Named parameter execution
  executeSyncNamed(sql: string, params: Record<string, DuckDBValue>): QueryResult
  executeNamed(sql: string, params: Record<string, DuckDBValue>): Promise<QueryResult>

  // Streaming
  stream(sql: string, params?: DuckDBValue[]): Promise<StreamingResult>
  streamNamed(sql: string, params: Record<string, DuckDBValue>): Promise<StreamingResult>

  // Appender
  createAppender(table: string, options?: AppenderOptions): Appender

  // Connection management
  connect(): Database
  connections(): ConnectionInfo
  closeConnections(): void

  // ATTACH/DETACH
  attach(path: string, alias: string, options?: AttachOptions): void
  detach(alias: string): void

  // Batch execution
  executeBatchSync(commands: BatchCommand[]): BatchResult
  executeBatch(commands: BatchCommand[]): Promise<BatchResult>
}
