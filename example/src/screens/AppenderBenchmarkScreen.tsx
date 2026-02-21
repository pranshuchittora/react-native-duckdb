import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { HybridDuckDB, withAppender } from 'react-native-duckdb'
import type { Database } from 'react-native-duckdb'
import { useTheme } from '../theme'

type Phase = 'idle' | 'insert' | 'appender' | 'done'

interface BenchmarkResult {
  rowCount: number
  insertMs: number
  appenderMs: number
}

const ROW_OPTIONS = [1000, 5000, 10000, 50000]
const ROW_LABELS = ['1K', '5K', '10K', '50K']

export function AppenderBenchmarkScreen() {
  const { colors, brand } = useTheme()
  const dbRef = useRef<Database | null>(null)
  const [selectedRows, setSelectedRows] = useState(1000)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<BenchmarkResult[]>([])

  useEffect(() => {
    const db = HybridDuckDB.open(':memory:', {})
    dbRef.current = db
    return () => {
      try { db.close() } catch (_) {}
      dbRef.current = null
    }
  }, [])

  const runBenchmark = useCallback(async () => {
    const db = dbRef.current
    if (!db) return

    setPhase('insert')
    setError(null)

    try {
      // Phase 1: INSERT loop (executeSync intentional — benchmarking JSI overhead)
      await db.execute('DROP TABLE IF EXISTS insert_bench')
      await db.execute('CREATE TABLE insert_bench (id INTEGER, name VARCHAR, value DOUBLE)')

      const insertStart = Date.now()
      for (let i = 0; i < selectedRows; i++) {
        db.executeSync(`INSERT INTO insert_bench VALUES (${i}, 'row_${i}', ${(i * 3.14).toFixed(2)})`)
      }
      const insertMs = Date.now() - insertStart

      await db.execute('DROP TABLE insert_bench')

      // Yield to UI before phase 2
      await new Promise(resolve => setTimeout(resolve, 0))
      setPhase('appender')

      // Phase 2: Appender
      await db.execute('DROP TABLE IF EXISTS appender_bench')
      await db.execute('CREATE TABLE appender_bench (id INTEGER, name VARCHAR, value DOUBLE)')

      const appenderStart = Date.now()
      await withAppender(db, 'appender_bench', (appender) => {
        for (let i = 0; i < selectedRows; i++) {
          appender.appendRow([i, `row_${i}`, parseFloat((i * 3.14).toFixed(2))])
        }
      })
      const appenderMs = Date.now() - appenderStart

      await db.execute('DROP TABLE appender_bench')

      const result: BenchmarkResult = { rowCount: selectedRows, insertMs, appenderMs }
      setResults(prev => [result, ...prev].slice(0, 3))
      setPhase('done')
    } catch (e: any) {
      setError(String(e.message || e))
      setPhase('idle')
    }
  }, [selectedRows])

  const latestResult = results[0]
  const speedup = latestResult
    ? (latestResult.insertMs / Math.max(latestResult.appenderMs, 1)).toFixed(1)
    : null

  const maxTime = latestResult
    ? Math.max(latestResult.insertMs, latestResult.appenderMs, 1)
    : 1

  const isRunning = phase === 'insert' || phase === 'appender'

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Appender Benchmark</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        INSERT vs Appender performance
      </Text>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          DuckDB's Appender API batches inserts internally, bypassing per-row SQL parsing overhead.
          Each individual INSERT through JSI still pays per-call overhead.
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Row Count</Text>
      <View style={styles.segmentRow}>
        {ROW_OPTIONS.map((count, i) => {
          const active = selectedRows === count
          return (
            <TouchableOpacity
              key={count}
              style={[
                styles.segment,
                { borderColor: colors.border, backgroundColor: active ? brand.orange : colors.surface },
              ]}
              onPress={() => !isRunning && setSelectedRows(count)}
              disabled={isRunning}>
              <Text
                style={[styles.segmentText, { color: active ? '#fff' : colors.text }]}>
                {ROW_LABELS[i]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <TouchableOpacity
        style={[styles.runButton, { backgroundColor: brand.orange, opacity: isRunning ? 0.5 : 1 }]}
        onPress={runBenchmark}
        disabled={isRunning}>
        <Text style={styles.runButtonText}>
          {isRunning ? `Running... (${phase === 'insert' ? 'INSERT loop' : 'Appender'})` : 'Run Benchmark'}
        </Text>
      </TouchableOpacity>

      {isRunning && (
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={brand.orange} />
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {phase === 'insert' ? 'Phase 1: Running INSERT loop...' : 'Phase 2: Running Appender...'}
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorBox, { borderColor: colors.error }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {latestResult && (
        <View style={[styles.resultsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              Results ({latestResult.rowCount.toLocaleString()} rows)
            </Text>
            {speedup && (
              <View style={[styles.speedupBadge, { backgroundColor: brand.orange }]}>
                <Text style={styles.speedupText}>{speedup}x faster</Text>
              </View>
            )}
          </View>

          <View style={styles.barSection}>
            <Text style={[styles.barLabel, { color: colors.textSecondary }]}>INSERT</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${(latestResult.insertMs / maxTime) * 100}%`,
                    backgroundColor: colors.textSecondary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barTime, { color: colors.text }]}>
              {latestResult.insertMs.toLocaleString()}ms
            </Text>
          </View>

          <View style={styles.barSection}>
            <Text style={[styles.barLabel, { color: brand.orange }]}>Appender</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${(latestResult.appenderMs / maxTime) * 100}%`,
                    backgroundColor: brand.orange,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barTime, { color: colors.text }]}>
              {latestResult.appenderMs.toLocaleString()}ms
            </Text>
          </View>

          <View style={styles.rateRow}>
            <Text style={[styles.rateText, { color: colors.textSecondary }]}>
              INSERT: {Math.round((latestResult.rowCount / latestResult.insertMs) * 1000).toLocaleString()} rows/sec
            </Text>
            <Text style={[styles.rateText, { color: brand.orange }]}>
              Appender: {Math.round((latestResult.rowCount / Math.max(latestResult.appenderMs, 1)) * 1000).toLocaleString()} rows/sec
            </Text>
          </View>
        </View>
      )}

      {results.length > 1 && (
        <View style={styles.historySection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>History</Text>
          {results.slice(1).map((r, i) => (
            <View key={i} style={[styles.historyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.historyText, { color: colors.text }]}>
                {r.rowCount.toLocaleString()} rows
              </Text>
              <Text style={[styles.historyText, { color: colors.textSecondary }]}>
                INSERT: {r.insertMs}ms
              </Text>
              <Text style={[styles.historyText, { color: brand.orange }]}>
                Appender: {r.appenderMs}ms
              </Text>
              <Text style={[styles.historyText, { color: colors.text }]}>
                {(r.insertMs / Math.max(r.appenderMs, 1)).toFixed(1)}x
              </Text>
            </View>
          ))}
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
  infoText: { fontSize: 13, lineHeight: 19 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  runButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  runButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressText: { fontSize: 13 },
  errorBox: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 16 },
  errorText: { fontSize: 13, fontFamily: 'monospace' },
  resultsCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: { fontSize: 16, fontWeight: '700' },
  speedupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speedupText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  barSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  barLabel: { width: 65, fontSize: 12, fontWeight: '600' },
  barTrack: {
    flex: 1,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: 4, minWidth: 4 },
  barTime: { width: 80, fontSize: 12, fontWeight: '600', fontFamily: 'monospace', textAlign: 'right' },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  rateText: { fontSize: 11, fontFamily: 'monospace' },
  historySection: { marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  historyText: { fontSize: 11, fontFamily: 'monospace' },
})
