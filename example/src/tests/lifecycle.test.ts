import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Lifecycle', 'Open in-memory database', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  console.debug(`Opened in-memory DB, isOpen: ${db.isOpen}`)
  if (!db.isOpen) {
    throw new Error('Expected db.isOpen to be true after open')
  }
  db.close()
})

TestRegistry.registerTest('Lifecycle', 'Open file-based database', async () => {
  const db = HybridDuckDB.open('test_lifecycle.db', {})
  try {
    console.debug(`Opened file DB, isOpen: ${db.isOpen}`)
    if (!db.isOpen) {
      throw new Error('Expected db.isOpen to be true after open')
    }
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase('test_lifecycle.db')
  }
})

TestRegistry.registerTest('Lifecycle', 'Close database', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  console.debug(`Before close, isOpen: ${db.isOpen}`)
  if (!db.isOpen) {
    throw new Error('Expected db.isOpen to be true before close')
  }
  db.close()
  console.debug(`After close, isOpen: ${db.isOpen}`)
  if (db.isOpen) {
    throw new Error('Expected db.isOpen to be false after close')
  }
})

TestRegistry.registerTest('Lifecycle', 'Delete database file', async () => {
  const db = HybridDuckDB.open('test_delete.db', {})
  db.close()
  HybridDuckDB.deleteDatabase('test_delete.db')
  console.debug('Deleted test_delete.db, reopening to verify fresh DB')
  const db2 = HybridDuckDB.open('test_delete.db', {})
  try {
    if (!db2.isOpen) {
      throw new Error('Expected reopened db.isOpen to be true')
    }
    console.debug('Reopened fresh DB successfully after delete')
  } finally {
    db2.close()
    HybridDuckDB.deleteDatabase('test_delete.db')
  }
})

TestRegistry.registerTest('Lifecycle', 'Reopen deleted database', async () => {
  const db = HybridDuckDB.open('test_reopen.db', {})
  db.close()
  HybridDuckDB.deleteDatabase('test_reopen.db')
  console.debug('Deleted test_reopen.db, reopening...')
  const db2 = HybridDuckDB.open('test_reopen.db', {})
  try {
    console.debug(`Reopened DB isOpen: ${db2.isOpen}`)
    if (!db2.isOpen) {
      throw new Error('Expected reopened db.isOpen to be true')
    }
  } finally {
    db2.close()
    HybridDuckDB.deleteDatabase('test_reopen.db')
  }
})

TestRegistry.registerTest('Lifecycle', 'Open with custom config', async () => {
  const db = HybridDuckDB.open(':memory:', {
    threads: '1',
    memory_limit: '128MB',
  })
  console.debug(`Opened with custom config, isOpen: ${db.isOpen}`)
  if (!db.isOpen) {
    throw new Error('Expected db.isOpen to be true with custom config')
  }
  db.close()
})

TestRegistry.registerTest('Lifecycle', 'Close is idempotent', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  db.close()
  console.debug(`First close done, isOpen: ${db.isOpen}`)
  db.close()
  console.debug(`Second close done, isOpen: ${db.isOpen}`)
  if (db.isOpen) {
    throw new Error('Expected db.isOpen to be false after double close')
  }
})
