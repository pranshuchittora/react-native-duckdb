import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { QueryStatusBar } from '../components/StatusBar'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

const NUM_VECTORS = 200
const DIMS = 128
const ACCENT = '#7D66FF'

const CLUSTERS: Record<string, number[]> = {
  Fruit: [1, 0.8, 0.6, 0.4],
  Color: [0, 1, 0.7, 0.3],
  Animal: [0.3, 0, 1, 0.9],
}

function makeVector(seed: number): number[] {
  const vec: number[] = []
  for (let i = 0; i < DIMS; i++) {
    vec.push(
      Math.sin(seed * (i + 1) * 0.1) * 0.5 +
        Math.cos(seed * 0.3 + i * 0.7) * 0.5
    )
  }
  return vec
}

function vecLiteral(vec: number[]): string {
  return '[' + vec.map((v) => v.toFixed(6)).join(',') + ']::FLOAT[' + DIMS + ']'
}

const LABELS = [
  'fruit: apple', 'fruit: banana', 'fruit: cherry', 'fruit: grape', 'fruit: mango',
  'fruit: orange', 'fruit: peach', 'fruit: pear', 'fruit: plum', 'fruit: kiwi',
  'color: red', 'color: blue', 'color: green', 'color: yellow', 'color: purple',
  'color: orange', 'color: pink', 'color: teal', 'color: white', 'color: black',
  'animal: cat', 'animal: dog', 'animal: bird', 'animal: fish', 'animal: horse',
  'animal: bear', 'animal: wolf', 'animal: deer', 'animal: fox', 'animal: owl',
]

function labelSeed(label: string): number {
  let h = 0
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 1000
}

type DistanceMetric = 'cosine' | 'l2' | 'ip'
const TOP_K_OPTIONS = [3, 5, 10, 20]

const METRIC_INFO: Record<DistanceMetric, { title: string; desc: string; formula: string }> = {
  cosine: {
    title: 'Cosine Distance',
    desc: 'Measures angle between vectors. Best for normalized embeddings (e.g., sentence-transformers). Range: 0 (identical) to 2 (opposite).',
    formula: 'cos_dist(a,b) = 1 - (a·b / |a||b|)',
  },
  l2: {
    title: 'L2 (Euclidean)',
    desc: 'Measures straight-line distance. Best when magnitude matters. Range: 0 (identical) to infinity.',
    formula: 'l2(a,b) = sqrt(sum((a_i - b_i)^2))',
  },
  ip: {
    title: 'Inner Product',
    desc: 'Dot product of vectors. Best for maximum inner product search (MIPS). Higher = more similar.',
    formula: 'ip(a,b) = -sum(a_i * b_i)',
  },
}

const METRIC_SQL_FN: Record<DistanceMetric, string> = {
  cosine: 'array_cosine_distance',
  l2: 'array_distance',
  ip: 'array_negative_inner_product',
}

export function VSSExplorerScreen() {
  const { colors, isDark } = useTheme()
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCluster, setActiveCluster] = useState<string>('Fruit')
  const [metric, setMetric] = useState<DistanceMetric>('cosine')
  const [topK, setTopK] = useState(5)
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [distances, setDistances] = useState<number[]>([])
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>()
  const [isSearching, setIsSearching] = useState(false)
  const [lastSql, setLastSql] = useState('')
  const [showSetupSql, setShowSetupSql] = useState(false)
  const [showQuerySql, setShowQuerySql] = useState(false)
  const [expandedMetric, setExpandedMetric] = useState<DistanceMetric | null>(null)
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  const setupSql = `LOAD 'vss';
CREATE TABLE embeddings (id INTEGER, label VARCHAR, vec FLOAT[${DIMS}]);
-- Insert ${NUM_VECTORS} vectors with deterministic trig-based seeds
CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine');
CREATE INDEX idx_l2 ON embeddings USING HNSW (vec) WITH (metric = 'l2sq');
CREATE INDEX idx_ip ON embeddings USING HNSW (vec) WITH (metric = 'ip');`

  useEffect(() => {
    try {
      const db = HybridDuckDB.open(':memory:', {})
      dbRef.current = db

      db.executeSync("LOAD 'vss'")
      db.executeSync(
        'CREATE TABLE embeddings (id INTEGER, label VARCHAR, vec FLOAT[' + DIMS + '])'
      )

      for (let i = 0; i < NUM_VECTORS; i++) {
        const label = LABELS[i % LABELS.length]
        const seed = labelSeed(label) + Math.floor(i / LABELS.length) * 7
        const vec = makeVector(seed)
        db.executeSync(
          "INSERT INTO embeddings VALUES (" + i + ", '" + label + "', " + vecLiteral(vec) + ')'
        )
      }

      db.executeSync("CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine')")
      db.executeSync("CREATE INDEX idx_l2 ON embeddings USING HNSW (vec) WITH (metric = 'l2sq')")
      db.executeSync("CREATE INDEX idx_ip ON embeddings USING HNSW (vec) WITH (metric = 'ip')")

      setIsReady(true)
      setIsInitializing(false)
      runQuery(db, 'Fruit', 'cosine', 5)
    } catch (e: any) {
      setError(String(e.message || e))
      setIsInitializing(false)
    }

    return () => {
      if (dbRef.current) {
        try {
          dbRef.current.close()
        } catch (_) {}
        dbRef.current = null
      }
    }
  }, [])

  const buildQueryVector = useCallback((cluster: string): number[] => {
    const seeds = CLUSTERS[cluster]
    if (!seeds) return []
    const queryVec: number[] = []
    const baseSeed = seeds[0] * 100 + seeds[1] * 50
    for (let i = 0; i < DIMS; i++) {
      queryVec.push(
        Math.sin(baseSeed * (i + 1) * 0.1) * seeds[0] +
          Math.cos(baseSeed * 0.3 + i * 0.7) * seeds[1] +
          Math.sin(i * seeds[2] * 0.5) * 0.3
      )
    }
    return queryVec
  }, [])

  const runQuery = useCallback(
    async (db: ReturnType<typeof HybridDuckDB.open>, cluster: string, m: DistanceMetric, k: number) => {
      const queryVec = buildQueryVector(cluster)
      if (!queryVec.length || !db) return

      const fn = METRIC_SQL_FN[m]
      const qLit = vecLiteral(queryVec)
      const sql = `SELECT id, label, ${fn}(vec, ${qLit}) AS distance
FROM embeddings
ORDER BY distance
LIMIT ${k}`

      setLastSql(sql)
      setIsSearching(true)

      try {
        const start = Date.now()
        const result = await db.execute(sql)
        setExecutionTimeMs(Date.now() - start)
        const records = result.toRows()
        const cols = result.columnNames
        setColumns(cols)
        setRows(records.map((r: any) => cols.map((c) => r[c])))
        setDistances(records.map((r: any) => Number(r.distance)))
      } catch (e: any) {
        setError(String(e.message || e))
      } finally {
        setIsSearching(false)
      }
    },
    [buildQueryVector]
  )

  const onSearch = useCallback(async () => {
    if (dbRef.current) await runQuery(dbRef.current, activeCluster, metric, topK)
  }, [runQuery, activeCluster, metric, topK])

  const onClusterChange = useCallback(
    async (cluster: string) => {
      setActiveCluster(cluster)
      if (dbRef.current) await runQuery(dbRef.current, cluster, metric, topK)
    },
    [runQuery, metric, topK]
  )

  const onMetricChange = useCallback(
    async (m: DistanceMetric) => {
      setMetric(m)
      if (dbRef.current) await runQuery(dbRef.current, activeCluster, m, topK)
    },
    [runQuery, activeCluster, topK]
  )

  const maxDist = distances.length > 0 ? Math.max(...distances, 0.001) : 1

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>VSS Error</Text>
          <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={[styles.accentBar, { backgroundColor: ACCENT }]} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Vector Similarity Search</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Find similar items using embedding vectors and HNSW indexes
          </Text>
        </View>
      </View>

      {/* Distance Metrics Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Distance Metrics</Text>
        {(['cosine', 'l2', 'ip'] as DistanceMetric[]).map((m) => {
          const info = METRIC_INFO[m]
          const isExpanded = expandedMetric === m
          return (
            <TouchableOpacity
              key={m}
              style={[styles.metricItem, { borderColor: colors.border }]}
              onPress={() => setExpandedMetric(isExpanded ? null : m)}>
              <View style={styles.metricHeader}>
                <Text style={[styles.metricTitle, { color: colors.text }]}>{info.title}</Text>
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              {isExpanded && (
                <View style={styles.metricDetail}>
                  <Text style={[styles.metricDesc, { color: colors.textSecondary }]}>
                    {info.desc}
                  </Text>
                  <Text style={[styles.metricFormula, { color: ACCENT }]}>{info.formula}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Setup Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Setup</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isReady ? ACCENT + '20' : colors.surfaceAlt },
            ]}>
            <View
              style={[styles.statusDot, { backgroundColor: isReady ? ACCENT : colors.textSecondary }]}
            />
            <Text
              style={[styles.statusText, { color: isReady ? ACCENT : colors.textSecondary }]}>
              {isInitializing ? 'Initializing...' : isReady ? 'Ready' : 'Not initialized'}
            </Text>
          </View>
        </View>
        {isInitializing && <ActivityIndicator color={ACCENT} style={styles.loader} />}
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {NUM_VECTORS} vectors · {DIMS} dimensions · 3 HNSW indexes
        </Text>
        <TouchableOpacity
          onPress={() => setShowSetupSql(!showSetupSql)}
          style={styles.sqlToggle}>
          <MaterialCommunityIcons
            name={showSetupSql ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
          <Text style={[styles.sqlToggleText, { color: colors.textSecondary }]}>
            {showSetupSql ? 'Hide' : 'Show'} Setup SQL
          </Text>
        </TouchableOpacity>
        {showSetupSql && (
          <View style={[styles.sqlPreview, { backgroundColor: colors.surfaceAlt }]}>
            <SQLHighlighter sql={setupSql} />
          </View>
        )}
      </View>

      {/* Search Section */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Search</Text>

        {/* Query cluster */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Query Vector</Text>
        <View style={styles.chipRow}>
          {Object.keys(CLUSTERS).map((cluster) => (
            <TouchableOpacity
              key={cluster}
              style={[
                styles.chip,
                {
                  backgroundColor: activeCluster === cluster ? ACCENT : 'transparent',
                  borderColor: activeCluster === cluster ? ACCENT : colors.border,
                },
              ]}
              onPress={() => onClusterChange(cluster)}>
              <Text
                style={[
                  styles.chipText,
                  { color: activeCluster === cluster ? '#fff' : colors.textSecondary },
                ]}>
                {cluster}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Distance metric picker */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Distance Metric</Text>
        <View style={styles.chipRow}>
          {(['cosine', 'l2', 'ip'] as DistanceMetric[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.chip,
                {
                  backgroundColor: metric === m ? ACCENT : 'transparent',
                  borderColor: metric === m ? ACCENT : colors.border,
                },
              ]}
              onPress={() => onMetricChange(m)}>
              <Text
                style={[
                  styles.chipText,
                  { color: metric === m ? '#fff' : colors.textSecondary },
                ]}>
                {m === 'cosine' ? 'Cosine' : m === 'l2' ? 'L2' : 'Inner Product'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top-K */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Top-K</Text>
        <View style={styles.chipRow}>
          {TOP_K_OPTIONS.map((k) => (
            <TouchableOpacity
              key={k}
              style={[
                styles.chip,
                {
                  backgroundColor: topK === k ? ACCENT : 'transparent',
                  borderColor: topK === k ? ACCENT : colors.border,
                },
              ]}
              onPress={async () => {
                setTopK(k)
                if (dbRef.current) await runQuery(dbRef.current, activeCluster, metric, k)
              }}>
              <Text
                style={[
                  styles.chipText,
                  { color: topK === k ? '#fff' : colors.textSecondary },
                ]}>
                {k}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: ACCENT, opacity: isSearching ? 0.6 : 1 }]}
          onPress={onSearch}
          disabled={!isReady || isSearching}>
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="vector-point" size={18} color="#fff" />
              <Text style={styles.searchButtonText}>Search</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Results</Text>
          <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
            {rows.length} result{rows.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {rows.length > 0 ? (
          <>
            {/* Distance indicators */}
            <View style={styles.distanceList}>
              {rows.map((row, i) => {
                const dist = distances[i] ?? 0
                const barWidth = Math.max(5, Math.min(100, (dist / maxDist) * 100))
                return (
                  <View key={i} style={[styles.distanceRow, { borderColor: colors.border }]}>
                    <Text style={[styles.distanceLabel, { color: colors.text }]} numberOfLines={1}>
                      {row[1]}
                    </Text>
                    <View style={styles.distanceBarWrap}>
                      <View
                        style={[
                          styles.distanceBar,
                          { width: `${barWidth}%`, backgroundColor: ACCENT + '80' },
                        ]}
                      />
                    </View>
                    <Text style={[styles.distanceValue, { color: colors.textSecondary }]}>
                      {dist.toFixed(4)}
                    </Text>
                  </View>
                )
              })}
            </View>

            <ResultTable columns={columns} rows={rows} rowCount={rows.length} />
            <View style={styles.statusBarWrap}>
              <QueryStatusBar executionTimeMs={executionTimeMs} rowCount={rows.length} />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="vector-triangle" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isReady ? 'Run a search to see results' : 'Initializing...'}
            </Text>
          </View>
        )}
      </View>

      {/* SQL Preview */}
      {lastSql !== '' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setShowQuerySql(!showQuerySql)}
            style={styles.sqlToggle}>
            <MaterialCommunityIcons
              name={showQuerySql ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.sqlToggleText, { color: colors.textSecondary }]}>
              {showQuerySql ? 'Hide' : 'Show'} Query SQL
            </Text>
          </TouchableOpacity>
          {showQuerySql && (
            <View style={[styles.sqlPreview, { backgroundColor: colors.surfaceAlt }]}>
              <SQLHighlighter sql={lastSql} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  accentBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    minHeight: 40,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    alignSelf: 'flex-start',
  },
  infoText: {
    fontSize: 12,
  },
  sqlToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sqlToggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sqlPreview: {
    borderRadius: 6,
    padding: 12,
  },
  metricItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricDetail: {
    marginTop: 8,
    gap: 6,
  },
  metricDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  metricFormula: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
  },
  distanceList: {
    gap: 6,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  distanceLabel: {
    width: 100,
    fontSize: 12,
    fontWeight: '500',
  },
  distanceBarWrap: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0001',
    overflow: 'hidden',
  },
  distanceBar: {
    height: '100%',
    borderRadius: 4,
  },
  distanceValue: {
    width: 60,
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  statusBarWrap: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
})
