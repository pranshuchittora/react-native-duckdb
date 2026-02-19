import type { HybridObject } from 'react-native-nitro-modules'
import type { DuckDBValue } from '../types'
import type { QueryResult } from './QueryResult.nitro'

export interface PreparedStatement extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  executeSync(params?: DuckDBValue[]): QueryResult
  execute(params?: DuckDBValue[]): Promise<QueryResult>
  executeSyncNamed(params: Record<string, DuckDBValue>): QueryResult
  executeNamed(params: Record<string, DuckDBValue>): Promise<QueryResult>
  finalize(): void
}
