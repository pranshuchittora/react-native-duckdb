import type { HybridObject } from 'react-native-nitro-modules'
import type { DuckDBValue } from '../types'
import type { QueryResult } from './QueryResult.nitro'
import type { PreparedStatement } from './PreparedStatement.nitro'

export interface Database extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly isOpen: boolean
  close(): void
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
}
