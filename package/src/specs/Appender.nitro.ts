import type { HybridObject } from 'react-native-nitro-modules'
import type { DuckDBValue } from '../types'

export interface Appender extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  appendRow(values: DuckDBValue[]): void
  appendRows(rows: DuckDBValue[][]): void
  appendColumns(columns: DuckDBValue[][]): void
  flush(): void
  close(): void
}
