import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Storage Paths', 'documentsPath is valid', async () => {
  const p = HybridDuckDB.documentsPath
  console.debug(`documentsPath: ${p}`)
  if (!p || p.length === 0) throw new Error('documentsPath is empty')
  if (!p.startsWith('/')) throw new Error(`documentsPath not absolute: ${p}`)
})

TestRegistry.registerTest('Storage Paths', 'libraryPath is valid', async () => {
  const p = HybridDuckDB.libraryPath
  console.debug(`libraryPath: ${p}`)
  if (!p || p.length === 0) throw new Error('libraryPath is empty')
  if (!p.startsWith('/')) throw new Error(`libraryPath not absolute: ${p}`)
})

TestRegistry.registerTest('Storage Paths', 'databasePath is valid', async () => {
  const p = HybridDuckDB.databasePath
  console.debug(`databasePath: ${p}`)
  if (!p || p.length === 0) throw new Error('databasePath is empty')
  if (!p.startsWith('/')) throw new Error(`databasePath not absolute: ${p}`)
})

TestRegistry.registerTest('Storage Paths', 'defaultPath is valid', async () => {
  const p = HybridDuckDB.defaultPath
  console.debug(`defaultPath: ${p}`)
  if (!p || p.length === 0) throw new Error('defaultPath is empty')
  if (!p.startsWith('/')) throw new Error(`defaultPath not absolute: ${p}`)
})

TestRegistry.registerTest('Storage Paths', 'externalStoragePath type check', async () => {
  const p = HybridDuckDB.externalStoragePath
  console.debug(`externalStoragePath: "${p}"`)
  if (typeof p !== 'string') throw new Error(`externalStoragePath is not a string: ${typeof p}`)
})

TestRegistry.registerTest('Storage Paths', 'defaultPath matches relative resolution', async () => {
  const dbName = 'path_test_rel.duckdb'
  const db = HybridDuckDB.open(dbName, {})
  try {
    await db.execute('SELECT 1 AS ok')
    console.debug('Relative path DB opened and queried successfully')
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(dbName)
  }
})

TestRegistry.registerTest('Storage Paths', 'open with absolute documentsPath', async () => {
  const absPath = `${HybridDuckDB.documentsPath}/path_test_abs.duckdb`
  const db = HybridDuckDB.open(absPath, {})
  try {
    const result = await db.execute('SELECT 42 AS val')
    const rows = result.toRows()
    if (Number(rows[0].val) !== 42) throw new Error(`Unexpected result: ${rows[0].val}`)
    console.debug(`Opened DB at absolute documentsPath: ${absPath}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(absPath)
  }
})

TestRegistry.registerTest('Storage Paths', 'open with absolute libraryPath', async () => {
  const absPath = `${HybridDuckDB.libraryPath}/path_test_lib.duckdb`
  const db = HybridDuckDB.open(absPath, {})
  try {
    const result = await db.execute('SELECT 99 AS val')
    const rows = result.toRows()
    if (Number(rows[0].val) !== 99) throw new Error(`Unexpected result: ${rows[0].val}`)
    console.debug(`Opened DB at absolute libraryPath: ${absPath}`)
  } finally {
    db.close()
    HybridDuckDB.deleteDatabase(absPath)
  }
})
