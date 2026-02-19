import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Query Cancellation', 'Cancel running async query', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const promise = db.execute('SELECT count(*) FROM generate_series(1, 5000000) t1, generate_series(1, 50) t2')
    db.cancel()
    let threw = false
    try {
      await promise
    } catch (e: any) {
      threw = true
      const msg = String(e.message || e).toLowerCase()
      console.debug(`cancel error: ${msg}`)
      if (!msg.includes('interrupt') && !msg.includes('cancel')) {
        throw new Error(`Expected error containing "interrupt" or "cancel", got: ${msg}`)
      }
    }
    if (!threw) throw new Error('Expected cancelled query to reject')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Cancellation', 'Cancel when idle — no-op', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.cancel()
    const result = db.executeSync('SELECT 42 AS val')
    const rows = result.toRows()
    if (rows[0].val !== 42) throw new Error(`Expected val=42, got ${rows[0].val}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Cancellation', 'Connection reusable after cancel', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const promise = db.execute('SELECT count(*) FROM generate_series(1, 5000000) t1, generate_series(1, 50) t2')
    db.cancel()
    try {
      await promise
    } catch (_) {
      // expected
    }
    const result = db.executeSync("SELECT 'alive' AS status")
    const rows = result.toRows()
    if (rows[0].status !== 'alive') throw new Error(`Expected status='alive', got ${rows[0].status}`)
  } finally {
    db.close()
  }
})
