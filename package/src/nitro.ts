import { NitroModules } from 'react-native-nitro-modules'
import type { DuckDB as DuckDBSpec } from './specs/DuckDB.nitro'

export const HybridDuckDB =
  NitroModules.createHybridObject<DuckDBSpec>('DuckDB')
