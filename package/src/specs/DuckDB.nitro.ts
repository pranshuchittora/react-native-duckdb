import type { HybridObject } from 'react-native-nitro-modules'
import type { Database } from './Database.nitro'

export interface DuckDB extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly version: string
  readonly documentsPath: string
  readonly libraryPath: string
  readonly databasePath: string
  readonly externalStoragePath: string
  readonly defaultPath: string
  open(path: string, config: Record<string, string>): Database
  deleteDatabase(path: string): void
}
