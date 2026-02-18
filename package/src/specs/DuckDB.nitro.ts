import type { HybridObject } from 'react-native-nitro-modules'

export interface DuckDB extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly version: string
}
