import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Build', 'DuckDB version available', async () => {
  const version = HybridDuckDB.version
  console.debug(`DuckDB version: ${version}`)
  if (!version || version.length === 0) {
    throw new Error('DuckDB version is empty')
  }
  if (!version.match(/\d+\.\d+\.\d+/)) {
    throw new Error(`Unexpected version format: ${version}`)
  }
})

TestRegistry.registerTest('Build', 'Native module loaded', async () => {
  console.debug('Checking if HybridDuckDB is available...')
  if (!HybridDuckDB) {
    throw new Error('HybridDuckDB is null/undefined')
  }
  console.debug('HybridDuckDB loaded successfully')
})
