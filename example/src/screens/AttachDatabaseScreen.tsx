import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'
import type { Database } from 'react-native-duckdb'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { useTheme } from '../theme'

type StepStatus = 'locked' | 'ready' | 'done'

interface StepState {
  status: StepStatus
  result?: string
  error?: string
  columns?: string[]
  rows?: any[][]
}

const STEPS = [
  { id: 1, title: 'Create Databases', desc: 'Create sales and inventory databases with sample data' },
  { id: 2, title: 'Attach', desc: 'Attach both databases and list available databases' },
  { id: 3, title: 'Cross-Database Query', desc: 'JOIN data across databases' },
  { id: 4, title: 'Detach', desc: 'Detach databases and verify cleanup' },
]

const SALES_DATA = [
  [1, 'Widget', 29.99, '2024-01-15'],
  [2, 'Gadget', 49.99, '2024-01-16'],
  [3, 'Widget', 29.99, '2024-02-01'],
  [4, 'Doohickey', 19.99, '2024-02-10'],
  [5, 'Gadget', 49.99, '2024-03-01'],
  [6, 'Thingamajig', 9.99, '2024-03-05'],
  [7, 'Widget', 29.99, '2024-03-10'],
]

const INVENTORY_DATA = [
  ['Widget', 150, 'North'],
  ['Gadget', 75, 'South'],
  ['Doohickey', 200, 'North'],
  ['Thingamajig', 500, 'East'],
  ['Whatchamacallit', 30, 'West'],
]

export function AttachDatabaseScreen() {
  const { colors, brand } = useTheme()
  const dbRef = useRef<Database | null>(null)
  const [steps, setSteps] = useState<StepState[]>([
    { status: 'ready' },
    { status: 'locked' },
    { status: 'locked' },
    { status: 'locked' },
  ])

  useEffect(() => {
    const db = HybridDuckDB.open(':memory:', {})
    dbRef.current = db
    return () => {
      try { db.close() } catch (_) {}
      dbRef.current = null
    }
  }, [])

  const updateStep = useCallback((index: number, update: Partial<StepState>) => {
    setSteps(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...update }
      return next
    })
  }, [])

  const unlockNext = useCallback((currentIndex: number) => {
    setSteps(prev => {
      const next = [...prev]
      if (currentIndex + 1 < next.length) {
        next[currentIndex + 1] = { ...next[currentIndex + 1], status: 'ready' }
      }
      return next
    })
  }, [])

  const executeStep1 = useCallback(() => {
    const db = dbRef.current
    if (!db) return
    try {
      // Create in-memory attached databases (portable, no file system needed)
      db.executeSync("ATTACH ':memory:' AS sales_db")
      db.executeSync(`
        CREATE TABLE sales_db.sales (
          id INTEGER, product VARCHAR, amount DOUBLE, sale_date VARCHAR
        )
      `)
      for (const row of SALES_DATA) {
        db.executeSync(
          `INSERT INTO sales_db.sales VALUES (${row[0]}, '${row[1]}', ${row[2]}, '${row[3]}')`
        )
      }

      db.executeSync("ATTACH ':memory:' AS inventory_db")
      db.executeSync(`
        CREATE TABLE inventory_db.inventory (
          product VARCHAR, stock INTEGER, warehouse VARCHAR
        )
      `)
      for (const row of INVENTORY_DATA) {
        db.executeSync(
          `INSERT INTO inventory_db.inventory VALUES ('${row[0]}', ${row[1]}, '${row[2]}')`
        )
      }

      // Detach them so step 2 can re-attach (we need them created and detached for demo flow)
      // Actually, for in-memory, we keep them attached — step 2 will just show them
      // The flow: step 1 creates+attaches, step 2 shows the database list, step 3 queries, step 4 detaches

      updateStep(0, {
        status: 'done',
        result: `Created sales_db (${SALES_DATA.length} sales rows) and inventory_db (${INVENTORY_DATA.length} inventory rows)`,
      })
      unlockNext(0)
    } catch (e: any) {
      updateStep(0, { error: String(e.message || e) })
    }
  }, [updateStep, unlockNext])

  const executeStep2 = useCallback(() => {
    const db = dbRef.current
    if (!db) return
    try {
      const result = db.executeSync('SHOW DATABASES')
      const records = result.toRows()
      const cols = result.columnNames
      const rows = records.map(r => cols.map(c => r[c]))

      updateStep(1, {
        status: 'done',
        result: `${records.length} databases attached`,
        columns: cols,
        rows,
      })
      unlockNext(1)
    } catch (e: any) {
      updateStep(1, { error: String(e.message || e) })
    }
  }, [updateStep, unlockNext])

  const executeStep3 = useCallback(() => {
    const db = dbRef.current
    if (!db) return
    try {
      const sql = `SELECT s.product, s.amount, i.stock, i.warehouse
FROM sales_db.sales s
JOIN inventory_db.inventory i ON s.product = i.product
ORDER BY s.product`
      const result = db.executeSync(sql)
      const records = result.toRows()
      const cols = result.columnNames
      const rows = records.map(r => cols.map(c => r[c]))

      updateStep(2, {
        status: 'done',
        result: `${records.length} joined rows`,
        columns: cols,
        rows,
      })
      unlockNext(2)
    } catch (e: any) {
      updateStep(2, { error: String(e.message || e) })
    }
  }, [updateStep, unlockNext])

  const executeStep4 = useCallback(() => {
    const db = dbRef.current
    if (!db) return
    try {
      db.executeSync('DETACH sales_db')
      db.executeSync('DETACH inventory_db')

      const result = db.executeSync('SHOW DATABASES')
      const records = result.toRows()
      const cols = result.columnNames
      const rows = records.map(r => cols.map(c => r[c]))

      updateStep(3, {
        status: 'done',
        result: `Detached both databases. ${records.length} database(s) remaining.`,
        columns: cols,
        rows,
      })
    } catch (e: any) {
      updateStep(3, { error: String(e.message || e) })
    }
  }, [updateStep])

  const stepHandlers = [executeStep1, executeStep2, executeStep3, executeStep4]

  const handleReset = useCallback(() => {
    const db = dbRef.current
    if (!db) return
    try { db.executeSync('DETACH sales_db') } catch (_) {}
    try { db.executeSync('DETACH inventory_db') } catch (_) {}
    setSteps([
      { status: 'ready' },
      { status: 'locked' },
      { status: 'locked' },
      { status: 'locked' },
    ])
  }, [])

  const CROSS_DB_SQL = `SELECT s.product, s.amount, i.stock, i.warehouse
FROM sales_db.sales s
JOIN inventory_db.inventory i ON s.product = i.product`

  const completedCount = steps.filter(s => s.status === 'done').length

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Attach Database</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Cross-database queries
      </Text>

      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                backgroundColor: steps[i].status === 'done' ? brand.purple : colors.surfaceAlt,
                borderColor: steps[i].status === 'ready' ? brand.purple : 'transparent',
              },
            ]}
          />
        ))}
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {completedCount}/{STEPS.length} complete
        </Text>
      </View>

      {STEPS.map((step, i) => {
        const state = steps[i]
        const isLocked = state.status === 'locked'

        return (
          <View
            key={step.id}
            style={[
              styles.stepCard,
              {
                backgroundColor: colors.surface,
                borderColor: isLocked ? colors.border : brand.purple,
                opacity: isLocked ? 0.5 : 1,
              },
            ]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, { backgroundColor: brand.purple }]}>
                <Text style={styles.stepBadgeText}>{step.id}</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>{step.desc}</Text>
              </View>
              {state.status === 'done' && (
                <Text style={[styles.checkmark, { color: brand.green }]}>&#10003;</Text>
              )}
            </View>

            {state.status === 'ready' && (
              <TouchableOpacity
                style={[styles.stepButton, { backgroundColor: brand.purple }]}
                onPress={stepHandlers[i]}>
                <Text style={styles.stepButtonText}>Run Step {step.id}</Text>
              </TouchableOpacity>
            )}

            {i === 2 && state.status !== 'locked' && (
              <View style={[styles.sqlPreview, { backgroundColor: colors.surfaceAlt }]}>
                <SQLHighlighter sql={CROSS_DB_SQL} />
              </View>
            )}

            {state.error && (
              <View style={[styles.errorBox, { borderColor: colors.error }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{state.error}</Text>
              </View>
            )}

            {state.result && (
              <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                {state.result}
              </Text>
            )}

            {state.columns && state.rows && (
              <View style={styles.tableWrapper}>
                <ResultTable columns={state.columns} rows={state.rows} />
              </View>
            )}
          </View>
        )
      })}

      <TouchableOpacity
        style={[styles.resetButton, { borderColor: colors.border }]}
        onPress={handleReset}>
        <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reset</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  progressText: { fontSize: 12, marginLeft: 4 },
  stepCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600' },
  stepDesc: { fontSize: 12, marginTop: 2 },
  checkmark: { fontSize: 20, fontWeight: '700' },
  stepButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  stepButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sqlPreview: { marginTop: 10, padding: 10, borderRadius: 6 },
  errorBox: { marginTop: 8, padding: 8, borderWidth: 1, borderRadius: 6 },
  errorText: { fontSize: 12, fontFamily: 'monospace' },
  resultText: { fontSize: 13, marginTop: 8 },
  tableWrapper: { marginTop: 10 },
  resetButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetText: { fontSize: 14, fontWeight: '600' },
})
