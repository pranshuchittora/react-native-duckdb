import type { HybridObject } from 'react-native-nitro-modules'
import type {
  DuckDBValue,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
  AppenderOptions,
  ExecuteOptions,
} from '../types'
import type { QueryResult } from './QueryResult.nitro'
import type { PreparedStatement } from './PreparedStatement.nitro'
import type { StreamingResult } from './StreamingResult.nitro'
import type { Appender } from './Appender.nitro'

export interface Database extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly isOpen: boolean
  close(options?: CloseOptions): void
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[], options?: ExecuteOptions): Promise<QueryResult>
  prepare(sql: string): PreparedStatement

  // Query cancellation
  cancel(): void

  // Named parameter execution
  executeSyncNamed(sql: string, params: Record<string, DuckDBValue>): QueryResult
  executeNamed(sql: string, params: Record<string, DuckDBValue>, options?: ExecuteOptions): Promise<QueryResult>

  // Streaming
  stream(sql: string, params?: DuckDBValue[], options?: ExecuteOptions): Promise<StreamingResult>
  streamNamed(sql: string, params: Record<string, DuckDBValue>, options?: ExecuteOptions): Promise<StreamingResult>

  // Appender
  createAppender(table: string, options?: AppenderOptions): Appender

  // Profiling
  getProfilingInfo(): string

  // Progress callbacks
  setProgressCallback(callback: (percentage: number) => void): void
  removeProgressCallback(): void

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
