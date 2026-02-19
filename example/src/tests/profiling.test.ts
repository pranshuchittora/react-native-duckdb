import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Query Profiling', 'getProfilingInfo returns valid JSON after profiling enabled', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync("PRAGMA enable_profiling = 'json'")
    db.executeSync("PRAGMA profiling_output = ''")
    db.executeSync('SELECT * FROM (SELECT 42) t1, (SELECT 33) t2')
    const info = db.getProfilingInfo()
    console.debug(`profiling info length: ${info.length}`)
    if (!info || info.length === 0) throw new Error('Expected non-empty profiling info')
    const parsed = JSON.parse(info)
    console.debug(`profiling parsed keys: ${Object.keys(parsed).join(', ')}`)
    if (!parsed.children) throw new Error('Expected parsed profiling JSON to have "children" key (operator tree)')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Profiling', 'getProfilingInfo throws when profiling not enabled', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    let threw = false
    try {
      db.getProfilingInfo()
    } catch (e: any) {
      threw = true
      const msg = String(e.message || e).toLowerCase()
      console.debug(`profiling not enabled error: ${msg}`)
      if (!msg.includes('profil')) {
        throw new Error(`Expected error about profiling, got: ${msg}`)
      }
    }
    if (!threw) throw new Error('Expected getProfilingInfo to throw when profiling not enabled')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Profiling', 'getProfilingInfo after disable throws', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync("PRAGMA enable_profiling = 'json'")
    db.executeSync('SELECT 1')
    db.executeSync('PRAGMA disable_profiling')
    let threw = false
    try {
      db.getProfilingInfo()
    } catch (e: any) {
      threw = true
      const msg = String(e.message || e).toLowerCase()
      console.debug(`profiling after disable error: ${msg}`)
      if (!msg.includes('profil')) {
        throw new Error(`Expected error about profiling, got: ${msg}`)
      }
    }
    if (!threw) throw new Error('Expected getProfilingInfo to throw after disable_profiling')
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Query Profiling', 'getProfilingInfo on child connection', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    const conn = db.connect()
    try {
      conn.executeSync("PRAGMA enable_profiling = 'json'")
      conn.executeSync("PRAGMA profiling_output = ''")
      conn.executeSync('SELECT 1 + 2')
      const info = conn.getProfilingInfo()
      console.debug(`child conn profiling info length: ${info.length}`)
      const parsed = JSON.parse(info)
      if (!parsed) throw new Error('Expected parseable JSON from child connection profiling')
    } finally {
      conn.close()
    }
  } finally {
    db.close()
  }
})
