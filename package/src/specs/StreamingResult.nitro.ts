import type { HybridObject } from 'react-native-nitro-modules'
import type { QueryResult } from './QueryResult.nitro'

export interface StreamingResult
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly isDone: boolean
  readonly columnCount: number
  readonly columnNames: string[]
  readonly columnTypes: string[]
  fetchChunk(): Promise<QueryResult | undefined>
  onChunk(callback: (chunk: QueryResult) => void): void
  start(): Promise<void>
  close(): void
}
