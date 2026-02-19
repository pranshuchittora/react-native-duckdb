import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

TestRegistry.registerTest('Progress Callbacks', 'Per-query onProgress callback fires during long query', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prog_test AS SELECT range a, mod(range,10) b FROM range(100000)')
    const percentages: number[] = []
    await db.execute(
      'SELECT count(*) FROM prog_test t1 INNER JOIN prog_test t2 ON (t1.a = t2.a)',
      undefined,
      { onProgress: (pct) => percentages.push(pct) }
    )
    console.debug(`progress callbacks received: ${percentages.length}, values: ${percentages.slice(0, 5).join(', ')}...`)
    if (percentages.length === 0) throw new Error('Expected at least one progress callback')
    for (const p of percentages) {
      if (p < 0 || p > 100) throw new Error(`Progress value ${p} out of range [0, 100]`)
    }
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Progress Callbacks', 'Per-connection setProgressCallback fires for all queries', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prog2 AS SELECT range a FROM range(100000)')
    const allPcts: number[] = []
    db.setProgressCallback((pct) => allPcts.push(pct))
    await db.execute('SELECT count(*) FROM prog2 t1 INNER JOIN prog2 t2 ON (t1.a = t2.a)')
    const firstCallCount = allPcts.length
    console.debug(`first query progress callbacks: ${firstCallCount}`)
    if (firstCallCount === 0) throw new Error('Expected at least one progress callback from first query')
    await db.execute('SELECT count(*) FROM prog2 t1 INNER JOIN prog2 t2 ON (t1.a = t2.a)')
    console.debug(`total progress callbacks after second query: ${allPcts.length}`)
    if (allPcts.length <= firstCallCount) throw new Error('Expected second query to also fire progress callbacks')
    db.removeProgressCallback()
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Progress Callbacks', 'Per-query overrides per-connection callback', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prog3 AS SELECT range a FROM range(100000)')
    const connPcts: number[] = []
    const queryPcts: number[] = []
    db.setProgressCallback((pct) => connPcts.push(pct))
    await db.execute(
      'SELECT count(*) FROM prog3 t1 INNER JOIN prog3 t2 ON (t1.a = t2.a)',
      undefined,
      { onProgress: (pct) => queryPcts.push(pct) }
    )
    console.debug(`per-query callbacks: ${queryPcts.length}, per-connection callbacks: ${connPcts.length}`)
    if (queryPcts.length === 0) throw new Error('Expected per-query callback to fire')
    if (connPcts.length !== 0) throw new Error(`Expected per-connection callback to NOT fire when per-query is set, got ${connPcts.length} calls`)
    db.removeProgressCallback()
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Progress Callbacks', 'removeProgressCallback stops callbacks', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prog4 AS SELECT range a FROM range(100000)')
    const pcts: number[] = []
    db.setProgressCallback((pct) => pcts.push(pct))
    await db.execute('SELECT count(*) FROM prog4 t1 INNER JOIN prog4 t2 ON (t1.a = t2.a)')
    const firstCount = pcts.length
    console.debug(`callbacks before remove: ${firstCount}`)
    if (firstCount === 0) throw new Error('Expected at least one callback before remove')
    db.removeProgressCallback()
    pcts.length = 0
    await db.execute('SELECT count(*) FROM prog4 t1 INNER JOIN prog4 t2 ON (t1.a = t2.a)')
    console.debug(`callbacks after remove: ${pcts.length}`)
    if (pcts.length !== 0) throw new Error(`Expected no callbacks after remove, got ${pcts.length}`)
  } finally {
    db.close()
  }
})

TestRegistry.registerTest('Progress Callbacks', 'Progress values are non-negative', async () => {
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync('CREATE TABLE prog5 AS SELECT range a FROM range(50000)')
    const pcts: number[] = []
    await db.execute(
      'SELECT count(*) FROM prog5 t1, prog5 t2 WHERE t1.a < 100',
      undefined,
      { onProgress: (pct) => pcts.push(pct) }
    )
    console.debug(`non-negative check: ${pcts.length} callbacks, min=${Math.min(...pcts)}, max=${Math.max(...pcts)}`)
    for (const p of pcts) {
      if (p < 0) throw new Error(`Progress value ${p} is negative`)
    }
  } finally {
    db.close()
  }
})
