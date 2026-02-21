import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'
import type { StreamingResult, QueryResult, Database } from 'react-native-duckdb'
import { ResultTable } from '../components/ResultTable'
import { useTheme } from '../theme'

type Status = 'idle' | 'generating' | 'streaming' | 'complete' | 'cancelled' | 'error'

const TOTAL_ROWS = 100_000
const ESTIMATED_CHUNK_SIZE = 2048

export function StreamingDemoScreen() {
  const { colors, brand } = useTheme()
  const dbRef = useRef<Database | null>(null)
  const streamRef = useRef<StreamingResult | null>(null)
  const cancelledRef = useRef(false)

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [chunksProcessed, setChunksProcessed] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [chunkSize, setChunkSize] = useState(0)
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<any[][]>([])

  useEffect(() => {
    const db = HybridDuckDB.open(':memory:', {})
    dbRef.current = db
    return () => {
      try { streamRef.current?.close() } catch (_) {}
      try { db.close() } catch (_) {}
      dbRef.current = null
    }
  }, [])

  const handleStream = useCallback(async () => {
    const db = dbRef.current
    if (!db) return

    cancelledRef.current = false
    setStatus('generating')
    setError(null)
    setChunksProcessed(0)
    setTotalRows(0)
    setElapsedMs(0)
    setChunkSize(0)
    setPreviewColumns([])
    setPreviewRows([])

    try {
      await db.execute('DROP TABLE IF EXISTS stream_demo')
      await db.execute(`
        CREATE TABLE stream_demo AS
        SELECT
          i AS id,
          'item_' || i AS name,
          (i * 17 % 1000) / 10.0 AS value,
          CASE i % 5
            WHEN 0 THEN 'alpha'
            WHEN 1 THEN 'beta'
            WHEN 2 THEN 'gamma'
            WHEN 3 THEN 'delta'
            ELSE 'epsilon'
          END AS category
        FROM generate_series(1, ${TOTAL_ROWS}) t(i)
      `)

      setStatus('streaming')
      const startTime = Date.now()
      const stream = await db.stream('SELECT * FROM stream_demo')
      streamRef.current = stream

      let chunks = 0
      let rows = 0

      while (!cancelledRef.current) {
        const chunk: QueryResult | undefined = await stream.fetchChunk()
        if (chunk === undefined || chunk === null) break

        chunks++
        rows += chunk.rowCount
        const elapsed = Date.now() - startTime

        setChunksProcessed(chunks)
        setTotalRows(rows)
        setElapsedMs(elapsed)
        setChunkSize(chunk.rowCount)

        if (chunks === 1 || chunks % 5 === 0) {
          const cols = chunk.columnNames
          const records = chunk.toRows()
          const lastFive = records.slice(-5)
          setPreviewColumns(cols)
          setPreviewRows(lastFive.map(r => cols.map(c => r[c])))
        }
      }

      stream.close()
      streamRef.current = null
      const finalElapsed = Date.now() - startTime
      setElapsedMs(finalElapsed)
      setStatus(cancelledRef.current ? 'cancelled' : 'complete')
    } catch (e: any) {
      setError(String(e.message || e))
      setStatus('error')
    }
  }, [])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    try { streamRef.current?.close() } catch (_) {}
    streamRef.current = null
  }, [])

  const progress = Math.min(totalRows / TOTAL_ROWS, 1)
  const rowsPerSec = elapsedMs > 0 ? Math.round((totalRows / elapsedMs) * 1000) : 0

  const statusColor =
    status === 'streaming' ? brand.blue :
    status === 'complete' ? brand.green :
    status === 'cancelled' ? brand.orange :
    status === 'error' ? colors.error : colors.textSecondary

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Streaming Demo</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Chunk-by-chunk result processing
      </Text>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: brand.blue }]}>Why Streaming?</Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Streaming processes results in chunks instead of loading everything into memory at once.
          This is critical on mobile where memory is limited — a 100K row result would consume
          significant RAM if materialized fully. With streaming, only one chunk is in memory at a time.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: brand.blue, opacity: status === 'streaming' ? 0.5 : 1 }]}
          onPress={handleStream}
          disabled={status === 'streaming' || status === 'generating'}>
          <Text style={styles.buttonText}>
            {status === 'generating' ? 'Generating...' : 'Generate & Stream'}
          </Text>
        </TouchableOpacity>
        {status === 'streaming' && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: brand.orange }]}
            onPress={handleCancel}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {status !== 'idle' && (
        <>
          <View style={[styles.statusRow, { borderColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>

          <View style={[styles.progressContainer, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.progressBar,
                { width: `${progress * 100}%`, backgroundColor: brand.blue },
              ]}
            />
          </View>

          {status === 'streaming' && (
            <ActivityIndicator size="small" color={brand.blue} style={styles.spinner} />
          )}

          <View style={[styles.statsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{chunksProcessed}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Chunks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalRows.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rows</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Elapsed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {rowsPerSec.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rows/sec</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{chunkSize}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Chunk Size</Text>
            </View>
          </View>
        </>
      )}

      {error && (
        <View style={[styles.errorBox, { borderColor: colors.error }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {previewColumns.length > 0 && previewRows.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
            Last Chunk Preview (last 5 rows)
          </Text>
          <ResultTable columns={previewColumns} rows={previewRows} />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  infoCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  infoText: { fontSize: 13, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600' },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: { height: '100%', borderRadius: 4 },
  spinner: { marginBottom: 12 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    marginBottom: 16,
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { fontSize: 11, marginTop: 2 },
  errorBox: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, fontFamily: 'monospace' },
  previewSection: { marginTop: 8 },
  previewTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
})
