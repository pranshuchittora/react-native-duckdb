import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'

const NUM_VECTORS = 200
const DIMS = 128

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

interface SearchResult {
  id: number
  label: string
  distance: number
}

interface Props {
  onBack?: () => void
}

const LABELS = [
  'fruit: apple',
  'fruit: banana',
  'fruit: cherry',
  'fruit: grape',
  'fruit: mango',
  'fruit: orange',
  'fruit: peach',
  'fruit: pear',
  'fruit: plum',
  'fruit: kiwi',
  'color: red',
  'color: blue',
  'color: green',
  'color: yellow',
  'color: purple',
  'color: orange',
  'color: pink',
  'color: teal',
  'color: white',
  'color: black',
  'animal: cat',
  'animal: dog',
  'animal: bird',
  'animal: fish',
  'animal: horse',
  'animal: bear',
  'animal: wolf',
  'animal: deer',
  'animal: fox',
  'animal: owl',
]

function labelSeed(label: string): number {
  let h = 0
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 1000
}

export function VSSExplorerScreen({ onBack }: Props = {}) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeQuery, setActiveQuery] = useState<string>('Fruit')
  const [cosineResults, setCosineResults] = useState<SearchResult[]>([])
  const [l2Results, setL2Results] = useState<SearchResult[]>([])
  const [ipResults, setIpResults] = useState<SearchResult[]>([])
  const [expandedVector, setExpandedVector] = useState<string | null>(null)
  const [vectorData, setVectorData] = useState<Record<string, number[]>>({})
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  useEffect(() => {
    try {
      const db = HybridDuckDB.open(':memory:', {})
      dbRef.current = db

      db.executeSync("LOAD 'vss'")
      db.executeSync(
        'CREATE TABLE embeddings (id INTEGER, label VARCHAR, vec FLOAT[' +
          DIMS +
          '])'
      )

      // Insert labeled vectors with deterministic trig seeds
      const allLabels: string[] = []
      for (let i = 0; i < NUM_VECTORS; i++) {
        const label = LABELS[i % LABELS.length]
        allLabels.push(label)
        const seed = labelSeed(label) + Math.floor(i / LABELS.length) * 7
        const vec = makeVector(seed)
        db.executeSync(
          "INSERT INTO embeddings VALUES (" +
            i +
            ", '" +
            label +
            "', " +
            vecLiteral(vec) +
            ')'
        )
      }

      // Create three HNSW indexes — one per metric
      db.executeSync(
        "CREATE INDEX idx_cosine ON embeddings USING HNSW (vec) WITH (metric = 'cosine')"
      )
      db.executeSync(
        "CREATE INDEX idx_l2 ON embeddings USING HNSW (vec) WITH (metric = 'l2sq')"
      )
      db.executeSync(
        "CREATE INDEX idx_ip ON embeddings USING HNSW (vec) WITH (metric = 'ip')"
      )

      setIsReady(true)
      runQuery(db, 'Fruit')
    } catch (e: any) {
      setError(String(e.message || e))
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

  const runQuery = useCallback(
    (db: ReturnType<typeof HybridDuckDB.open>, cluster: string) => {
      const seeds = CLUSTERS[cluster]
      if (!seeds || !db) return

      // Build a query vector using the cluster's characteristic seed pattern
      const queryVec: number[] = []
      const baseSeed = seeds[0] * 100 + seeds[1] * 50
      for (let i = 0; i < DIMS; i++) {
        queryVec.push(
          Math.sin(baseSeed * (i + 1) * 0.1) * seeds[0] +
            Math.cos(baseSeed * 0.3 + i * 0.7) * seeds[1] +
            Math.sin(i * seeds[2] * 0.5) * 0.3
        )
      }
      const qLit = vecLiteral(queryVec)

      const parseResults = (rows: any[]): SearchResult[] =>
        rows.map((r: any) => ({
          id: Number(r.id),
          label: String(r.label),
          distance: Number(r.distance),
        }))

      try {
        const cosine = db.executeSync(
          'SELECT id, label, array_cosine_distance(vec, ' +
            qLit +
            ') AS distance FROM embeddings ORDER BY distance LIMIT 5'
        )
        setCosineResults(parseResults(cosine.toRows()))

        const l2 = db.executeSync(
          'SELECT id, label, array_distance(vec, ' +
            qLit +
            ') AS distance FROM embeddings ORDER BY distance LIMIT 5'
        )
        setL2Results(parseResults(l2.toRows()))

        const ip = db.executeSync(
          'SELECT id, label, array_negative_inner_product(vec, ' +
            qLit +
            ') AS distance FROM embeddings ORDER BY distance LIMIT 5'
        )
        setIpResults(parseResults(ip.toRows()))

        // Fetch vector data for expanded previews
        const allIds = new Set<number>()
        ;[cosine, l2, ip].forEach((r) =>
          r.toRows().forEach((row: any) => allIds.add(Number(row.id)))
        )
        const vecMap: Record<string, number[]> = {}
        for (const id of allIds) {
          const vr = db.executeSync(
            'SELECT vec FROM embeddings WHERE id = ' + id
          )
          const rows = vr.toRows()
          if (rows.length > 0) {
            const raw = rows[0].vec
            if (typeof raw === 'string') {
              const nums = raw
                .replace(/[\[\]]/g, '')
                .split(',')
                .map(Number)
              vecMap[String(id)] = nums
            } else if (Array.isArray(raw)) {
              vecMap[String(id)] = raw.map(Number)
            }
          }
        }
        setVectorData(vecMap)
      } catch (e: any) {
        setError(String(e.message || e))
      }
    },
    []
  )

  const onSelectQuery = useCallback(
    (cluster: string) => {
      setActiveQuery(cluster)
      setExpandedVector(null)
      if (dbRef.current) runQuery(dbRef.current, cluster)
    },
    [runQuery]
  )

  const toggleVector = useCallback(
    (key: string) => {
      setExpandedVector(expandedVector === key ? null : key)
    },
    [expandedVector]
  )

  const formatVecPreview = (id: number): string => {
    const vec = vectorData[String(id)]
    if (!vec || vec.length === 0) return '...'
    const preview = vec
      .slice(0, 4)
      .map((v) => v.toFixed(3))
      .join(', ')
    return '[' + preview + ', ... (' + vec.length + ' dims)]'
  }

  const renderResultColumn = (
    title: string,
    results: SearchResult[],
    accentColor: string,
    columnKey: string
  ) => (
    <View style={styles.column}>
      <View style={[styles.columnHeader, { backgroundColor: accentColor + '20' }]}>
        <Text style={[styles.columnTitle, { color: accentColor }]}>{title}</Text>
      </View>
      {results.map((r, i) => {
        const vecKey = columnKey + '-' + r.id
        const isExpanded = expandedVector === vecKey
        return (
          <TouchableOpacity
            key={vecKey}
            style={[styles.resultRow, i % 2 === 0 && styles.resultRowAlt]}
            onPress={() => toggleVector(vecKey)}
            activeOpacity={0.7}>
            <View style={styles.resultContent}>
              <Text style={styles.resultLabel} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={styles.resultDistance}>
                {r.distance.toFixed(4)}
              </Text>
            </View>
            {isExpanded && (
              <View style={styles.vectorPreview}>
                <Text style={styles.vectorText}>
                  {formatVecPreview(r.id)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vector Search Explorer</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vector Search Explorer</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4527A0" />
          <Text style={styles.loadingText}>
            Building HNSW indexes ({NUM_VECTORS} vectors × {DIMS} dims)...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vector Search Explorer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.queryBar}>
        <Text style={styles.queryLabel}>Query cluster:</Text>
        <View style={styles.queryButtons}>
          {Object.keys(CLUSTERS).map((cluster) => (
            <TouchableOpacity
              key={cluster}
              style={[
                styles.queryButton,
                activeQuery === cluster && styles.queryButtonActive,
              ]}
              onPress={() => onSelectQuery(cluster)}>
              <Text
                style={[
                  styles.queryButtonText,
                  activeQuery === cluster && styles.queryButtonTextActive,
                ]}>
                {cluster}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.columnsContainer}>
          {renderResultColumn('Cosine', cosineResults, '#4527A0', 'cos')}
          {renderResultColumn('L2', l2Results, '#1565C0', 'l2')}
          {renderResultColumn('Inner Product', ipResults, '#2E7D32', 'ip')}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          HNSW indexed • {NUM_VECTORS} vectors • {DIMS} dims
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    color: '#4527A0',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  queryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EDE7F6',
  },
  queryLabel: {
    fontSize: 13,
    color: '#4527A0',
    marginRight: 10,
    fontWeight: '500',
  },
  queryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  queryButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1C4E9',
  },
  queryButtonActive: {
    backgroundColor: '#4527A0',
    borderColor: '#4527A0',
  },
  queryButtonText: {
    fontSize: 13,
    color: '#4527A0',
    fontWeight: '600',
  },
  queryButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  column: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  columnHeader: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultRow: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  resultRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  resultContent: {
    flexDirection: 'column',
  },
  resultLabel: {
    fontSize: 11,
    color: '#212121',
    fontWeight: '500',
  },
  resultDistance: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  vectorPreview: {
    marginTop: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    padding: 4,
  },
  vectorText: {
    fontSize: 9,
    color: '#666',
    fontFamily: 'monospace',
  },
  footer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#4527A0',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
})
