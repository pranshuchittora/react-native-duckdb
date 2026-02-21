import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

const DIMS = 384

function makeVecLiteral(dims: number, seedFn: (dim: number) => number): string {
  const vals: number[] = []
  for (let d = 0; d < dims; d++) vals.push(seedFn(d))
  return `[${vals.join(',')}]::FLOAT[${dims}]`
}

// Build a SQL expression that generates a 384-dim array_value(...) call using
// trig functions with varying frequency multipliers, parameterized by row variable `rowVar`.
function makeArrayValueExpr(dims: number, rowVar: string): string {
  const elems: string[] = []
  for (let d = 0; d < dims; d++) {
    const freq = ((d + 1) * 0.001).toFixed(4)
    elems.push(d % 2 === 0 ? `sin(${rowVar} * ${freq})` : `cos(${rowVar} * ${freq})`)
  }
  return `array_value(${elems.join(', ')})::FLOAT[${dims}]`
}

// ── Category 1: Vector Operations (vss) ─────────────────────────────

// Test 1: Store and retrieve FLOAT[384] embeddings
TestRegistry.registerTest(
  'Vector Operations (vss)',
  'Store and retrieve FLOAT[384] embeddings',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE vec_store (id INTEGER, vec FLOAT[384])')

      const literal = makeVecLiteral(DIMS, (d) => Math.sin(d * 0.1))
      db.executeSync(`INSERT INTO vec_store VALUES (1, ${literal})`)

      const result = db.executeSync('SELECT vec FROM vec_store WHERE id = 1')
      const rows = result.toRows()
      if (rows.length !== 1) throw new Error(`Expected 1 row, got ${rows.length}`)

      const vec = rows[0].vec as string
      // DuckDB returns ARRAY as a string like "[0.0, 0.0998334, ...]"
      const values = vec.replace(/[\[\]]/g, '').split(',').map(Number)
      if (values.length !== DIMS) throw new Error(`Expected ${DIMS} dimensions, got ${values.length}`)

      // Verify first few values match our seed function
      const expected0 = Math.sin(0 * 0.1)
      if (Math.abs(values[0] - expected0) > 0.001)
        throw new Error(`values[0]=${values[0]}, expected ~${expected0}`)

      const expected1 = Math.sin(1 * 0.1)
      if (Math.abs(values[1] - expected1) > 0.001)
        throw new Error(`values[1]=${values[1]}, expected ~${expected1}`)

      console.debug(`FLOAT[384] store/retrieve: ${values.length} dims, first=${values[0].toFixed(4)}`)
    } finally {
      db.close()
    }
  }
)

// Test 2: Cosine distance between known vectors
TestRegistry.registerTest(
  'Vector Operations (vss)',
  'Cosine distance between known vectors',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE vec_cos (id INTEGER, vec FLOAT[384])')

      // Vector A: all positive (sin-based, shifted up)
      const vecA = makeVecLiteral(DIMS, (d) => Math.abs(Math.sin(d * 0.05)) + 0.1)
      // Vector B: all negative
      const vecB = makeVecLiteral(DIMS, (d) => -(Math.abs(Math.sin(d * 0.05)) + 0.1))

      db.executeSync(`INSERT INTO vec_cos VALUES (1, ${vecA})`)
      db.executeSync(`INSERT INTO vec_cos VALUES (2, ${vecB})`)

      const result = db.executeSync(
        'SELECT array_cosine_distance(a.vec, b.vec) AS dist FROM vec_cos a, vec_cos b WHERE a.id = 1 AND b.id = 2'
      )
      const dist = Number(result.toRows()[0].dist)

      // All-positive vs all-negative should have cosine distance close to 2.0 (opposite directions)
      if (dist < 1.5 || dist > 2.1)
        throw new Error(`Cosine distance between opposite vectors should be ~2.0, got ${dist}`)

      // Self-distance should be ~0
      const selfResult = db.executeSync(
        'SELECT array_cosine_distance(a.vec, b.vec) AS dist FROM vec_cos a, vec_cos b WHERE a.id = 1 AND b.id = 1'
      )
      const selfDist = Number(selfResult.toRows()[0].dist)
      if (selfDist > 0.001)
        throw new Error(`Self cosine distance should be ~0, got ${selfDist}`)

      console.debug(`Cosine distance: opposite=${dist.toFixed(4)}, self=${selfDist.toFixed(6)}`)
    } finally {
      db.close()
    }
  }
)

// Test 3: L2 (Euclidean) distance
TestRegistry.registerTest(
  'Vector Operations (vss)',
  'L2 (Euclidean) distance',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE vec_l2 (id INTEGER, vec FLOAT[384])')

      // Two vectors with known difference: vecA = 0.0 everywhere, vecB = 1.0 everywhere
      const vecA = makeVecLiteral(DIMS, () => 0.0)
      const vecB = makeVecLiteral(DIMS, () => 1.0)

      db.executeSync(`INSERT INTO vec_l2 VALUES (1, ${vecA})`)
      db.executeSync(`INSERT INTO vec_l2 VALUES (2, ${vecB})`)

      const result = db.executeSync(
        'SELECT array_distance(a.vec, b.vec) AS dist FROM vec_l2 a, vec_l2 b WHERE a.id = 1 AND b.id = 2'
      )
      const dist = Number(result.toRows()[0].dist)

      // L2 distance between zero vector and all-ones vector = sqrt(384 * 1^2) = sqrt(384) ≈ 19.596
      const expected = Math.sqrt(DIMS)
      if (Math.abs(dist - expected) > 0.1)
        throw new Error(`L2 distance should be ~${expected.toFixed(3)}, got ${dist}`)

      console.debug(`L2 distance: got=${dist.toFixed(4)}, expected=${expected.toFixed(4)}`)
    } finally {
      db.close()
    }
  }
)

// Test 4: Inner product distance
TestRegistry.registerTest(
  'Vector Operations (vss)',
  'Inner product distance',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE vec_ip (id INTEGER, vec FLOAT[384])')

      // vecA = all 1.0, vecB = all 2.0
      const vecA = makeVecLiteral(DIMS, () => 1.0)
      const vecB = makeVecLiteral(DIMS, () => 2.0)

      db.executeSync(`INSERT INTO vec_ip VALUES (1, ${vecA})`)
      db.executeSync(`INSERT INTO vec_ip VALUES (2, ${vecB})`)

      const result = db.executeSync(
        'SELECT array_negative_inner_product(a.vec, b.vec) AS dist FROM vec_ip a, vec_ip b WHERE a.id = 1 AND b.id = 2'
      )
      const dist = Number(result.toRows()[0].dist)

      // Inner product of all-1 and all-2 = 384 * 1 * 2 = 768
      // Negative inner product = -768
      const expected = -(DIMS * 2)
      if (Math.abs(dist - expected) > 0.1)
        throw new Error(`Negative inner product should be ~${expected}, got ${dist}`)

      console.debug(`Inner product distance: got=${dist.toFixed(4)}, expected=${expected}`)
    } finally {
      db.close()
    }
  }
)

// Test 5: Distance metric consistency
TestRegistry.registerTest(
  'Vector Operations (vss)',
  'Distance metric consistency across 100 vectors',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE vec_consist (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      db.executeSync(
        `INSERT INTO vec_consist SELECT i, ${arrayExpr} FROM range(100) t(i)`
      )

      const queryVec = makeVecLiteral(DIMS, (d) => Math.sin(42 * (d + 1) * 0.001))

      // Test all three distance metrics
      const metrics = [
        { fn: 'array_cosine_distance', name: 'cosine' },
        { fn: 'array_distance', name: 'L2' },
        { fn: 'array_negative_inner_product', name: 'inner product' },
      ]

      for (const m of metrics) {
        const result = db.executeSync(
          `SELECT id, ${m.fn}(vec, ${queryVec}) AS dist FROM vec_consist ORDER BY dist LIMIT 5`
        )
        const rows = result.toRows()

        if (rows.length !== 5)
          throw new Error(`${m.name}: expected 5 results, got ${rows.length}`)

        for (let i = 0; i < rows.length; i++) {
          const d = Number(rows[i].dist)
          if (d === null || d === undefined || isNaN(d))
            throw new Error(`${m.name}: result ${i} has invalid distance: ${rows[i].dist}`)
        }

        // Verify ascending order
        for (let i = 1; i < rows.length; i++) {
          if (Number(rows[i].dist) < Number(rows[i - 1].dist) - 0.0001)
            throw new Error(
              `${m.name}: results not in ascending order at index ${i}: ${rows[i - 1].dist} then ${rows[i].dist}`
            )
        }
      }

      console.debug('Distance consistency: all 3 metrics return 5 valid, ordered results from 100 vectors')
    } finally {
      db.close()
    }
  }
)

// ── Category 2: HNSW Index (vss) ────────────────────────────────────

// Test 6: Create HNSW index on 5000 vectors
TestRegistry.registerTest(
  'HNSW Index (vss)',
  'Create HNSW index on 5000 vectors',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE embeddings (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      const insertStart = Date.now()
      db.executeSync(
        `INSERT INTO embeddings SELECT i, ${arrayExpr} FROM range(5000) t(i)`
      )
      const insertMs = Date.now() - insertStart

      const count = Number(
        db.executeSync('SELECT count(*) AS cnt FROM embeddings').toRows()[0].cnt
      )
      if (count !== 5000) throw new Error(`Expected 5000 rows, got ${count}`)

      const indexStart = Date.now()
      db.executeSync(
        "CREATE INDEX idx_hnsw ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
      )
      const indexMs = Date.now() - indexStart

      console.debug(
        `HNSW index: 5000x384 vectors, insert=${insertMs}ms, index=${indexMs}ms`
      )
    } finally {
      db.close()
    }
  }
)

// Test 7: EXPLAIN shows HNSW_INDEX_SCAN
TestRegistry.registerTest(
  'HNSW Index (vss)',
  'EXPLAIN shows HNSW_INDEX_SCAN',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE embeddings (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      db.executeSync(
        `INSERT INTO embeddings SELECT i, ${arrayExpr} FROM range(1000) t(i)`
      )

      db.executeSync(
        "CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
      )

      const queryVec = makeVecLiteral(DIMS, (d) => Math.sin(42 * (d + 1) * 0.001))
      const explain = db.executeSync(
        `EXPLAIN SELECT * FROM embeddings ORDER BY array_cosine_distance(vec, ${queryVec}) LIMIT 10`
      )
      const rows = explain.toRows()

      // Concatenate all values from all rows to find HNSW_INDEX_SCAN
      const planText = rows
        .map((r: any) => Object.values(r).join(' '))
        .join('\n')

      if (!planText.includes('HNSW_INDEX_SCAN'))
        throw new Error(
          `Expected HNSW_INDEX_SCAN in EXPLAIN output, got:\n${planText.slice(0, 500)}`
        )

      console.debug('EXPLAIN: HNSW_INDEX_SCAN found in query plan')
    } finally {
      db.close()
    }
  }
)

// Test 8: Cosine similarity search with HNSW
TestRegistry.registerTest(
  'HNSW Index (vss)',
  'Cosine similarity search with HNSW',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE embeddings (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      db.executeSync(
        `INSERT INTO embeddings SELECT i, ${arrayExpr} FROM range(5000) t(i)`
      )

      db.executeSync(
        "CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
      )

      const queryVec = makeVecLiteral(DIMS, (d) => Math.sin(42 * (d + 1) * 0.001))
      const result = db.executeSync(
        `SELECT id, array_cosine_distance(vec, ${queryVec}) AS dist FROM embeddings ORDER BY dist LIMIT 10`
      )
      const rows = result.toRows()

      if (rows.length !== 10)
        throw new Error(`Expected 10 results, got ${rows.length}`)

      // Verify ascending distance order
      for (let i = 1; i < rows.length; i++) {
        if (Number(rows[i].dist) < Number(rows[i - 1].dist) - 0.0001)
          throw new Error(
            `Results not in ascending order at index ${i}: ${rows[i - 1].dist} then ${rows[i].dist}`
          )
      }

      // First result should have smallest distance
      const minDist = Number(rows[0].dist)
      if (minDist < 0 || minDist > 2)
        throw new Error(`First result distance out of range [0,2]: ${minDist}`)

      console.debug(
        `Cosine HNSW search: top-10, nearest id=${rows[0].id} dist=${Number(rows[0].dist).toFixed(4)}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 9: L2 distance search with HNSW
TestRegistry.registerTest(
  'HNSW Index (vss)',
  'L2 distance search with HNSW',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE embeddings (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      db.executeSync(
        `INSERT INTO embeddings SELECT i, ${arrayExpr} FROM range(5000) t(i)`
      )

      // Create HNSW index with L2 metric
      db.executeSync(
        "CREATE INDEX idx_l2 ON embeddings USING HNSW (vec) WITH (metric = 'l2sq')"
      )

      const queryVec = makeVecLiteral(DIMS, (d) => Math.sin(42 * (d + 1) * 0.001))
      const result = db.executeSync(
        `SELECT id, array_distance(vec, ${queryVec}) AS dist FROM embeddings ORDER BY dist LIMIT 10`
      )
      const rows = result.toRows()

      if (rows.length !== 10)
        throw new Error(`Expected 10 results, got ${rows.length}`)

      // Verify ascending distance order
      for (let i = 1; i < rows.length; i++) {
        if (Number(rows[i].dist) < Number(rows[i - 1].dist) - 0.0001)
          throw new Error(
            `L2 results not in ascending order at index ${i}: ${rows[i - 1].dist} then ${rows[i].dist}`
          )
      }

      console.debug(
        `L2 HNSW search: top-10, nearest id=${rows[0].id} dist=${Number(rows[0].dist).toFixed(4)}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 10: Brute-force vs HNSW timing comparison
TestRegistry.registerTest(
  'HNSW Index (vss)',
  'Brute-force vs HNSW timing comparison',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'vss'")
      db.executeSync('CREATE TABLE embeddings (id INTEGER, vec FLOAT[384])')

      const arrayExpr = makeArrayValueExpr(DIMS, 'i')
      db.executeSync(
        `INSERT INTO embeddings SELECT i, ${arrayExpr} FROM range(5000) t(i)`
      )

      const queryVec = makeVecLiteral(DIMS, (d) => Math.sin(42 * (d + 1) * 0.001))
      const query = `SELECT id, array_cosine_distance(vec, ${queryVec}) AS dist FROM embeddings ORDER BY dist LIMIT 10`

      // Brute-force (no index)
      const bruteStart = Date.now()
      const bruteResult = db.executeSync(query)
      const bruteMs = Date.now() - bruteStart
      const bruteRows = bruteResult.toRows()

      // Create HNSW index
      db.executeSync(
        "CREATE INDEX idx_timing ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
      )

      // HNSW-accelerated query
      const hnswStart = Date.now()
      const hnswResult = db.executeSync(query)
      const hnswMs = Date.now() - hnswStart
      const hnswRows = hnswResult.toRows()

      if (bruteRows.length !== 10)
        throw new Error(`Brute-force: expected 10 results, got ${bruteRows.length}`)
      if (hnswRows.length !== 10)
        throw new Error(`HNSW: expected 10 results, got ${hnswRows.length}`)

      const speedup = bruteMs / Math.max(hnswMs, 1)

      // HNSW should be faster than brute-force
      if (hnswMs > bruteMs)
        throw new Error(
          `HNSW (${hnswMs}ms) should be faster than brute-force (${bruteMs}ms)`
        )

      console.debug('=== Brute-force vs HNSW (5000x384 vectors) ===')
      console.debug(`  Brute-force: ${bruteMs}ms`)
      console.debug(`  HNSW:        ${hnswMs}ms`)
      console.debug(`  Speedup:     ${speedup.toFixed(1)}x`)
    } finally {
      db.close()
    }
  }
)
