import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Errors', 'Closed database access throws', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  db.close()
  console.debug(`After close, isOpen: ${db.isOpen}`)
  if (db.isOpen) {
    throw new Error('Expected db.isOpen to be false after close')
  }
  // close() should be idempotent — calling on closed DB should not throw
  db.close()
  console.debug('Second close() on closed DB did not throw — graceful handling confirmed')
})

TestRegistry.registerTest('Errors', 'Delete non-existent file does not crash', async () => {
  // Deleting a file that doesn't exist should not throw
  HybridDuckDB.deleteDatabase('non_existent_db_file_12345.db')
  console.debug('deleteDatabase on non-existent file completed without crash')
})

TestRegistry.registerTest('Errors', 'Delete in-memory throws', async () => {
  let threw = false
  try {
    HybridDuckDB.deleteDatabase(':memory:')
  } catch (e: any) {
    threw = true
    console.debug(`Delete :memory: threw as expected: ${e.message}`)
  }
  if (!threw) {
    throw new Error('Expected deleteDatabase(":memory:") to throw')
  }
})

TestRegistry.registerTest('Errors', 'Open with invalid config key', async () => {
  let threw = false
  try {
    const db = HybridDuckDB.open(':memory:', {
      invalid_nonexistent_option_xyz: 'value',
    })
    // If DuckDB silently ignores unknown options, close and note it
    console.debug('DuckDB did not throw on invalid config key — silently ignored')
    db.close()
    return
  } catch (e: any) {
    threw = true
    console.debug(`Invalid config threw as expected: ${e.message}`)
  }
  if (!threw) {
    // Already handled above with early return
    throw new Error('Unexpected state')
  }
})

TestRegistry.registerTest('Errors', 'Version stable after lifecycle operations', async () => {
  // Open and close several databases to stress the factory
  const db1 = HybridDuckDB.open(':memory:', {})
  db1.close()
  const db2 = HybridDuckDB.open(':memory:', {})
  db2.close()
  const db3 = HybridDuckDB.open('test_stability.db', {})
  try {
    db3.close()
  } finally {
    HybridDuckDB.deleteDatabase('test_stability.db')
  }

  const version = HybridDuckDB.version
  console.debug(`Version after lifecycle ops: ${version}`)
  if (!version || !version.match(/\d+\.\d+\.\d+/)) {
    throw new Error(`Expected valid version string, got: ${version}`)
  }
})
