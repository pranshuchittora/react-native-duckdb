import type { HybridObject } from 'react-native-nitro-modules'
import type { DuckDBValue } from '../types'

export interface QueryResult extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly rowCount: number
  readonly rowsChanged: number
  readonly columnCount: number
  readonly columnNames: string[]
  readonly columnTypes: string[]
  getColumn(index: number): DuckDBValue[]
  toRows(): Record<string, DuckDBValue>[]
}
