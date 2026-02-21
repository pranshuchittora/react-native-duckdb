import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
} from 'react-native'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { QueryStatusBar } from '../components/StatusBar'
import type { DatasetStackParamList } from '../navigation/types'
import type { Dataset } from '../data/datasets'

type DetailRoute = RouteProp<DatasetStackParamList, 'DatasetDetail'>

interface SchemaColumn {
  column_name: string
  column_type: string
  null: string
}

const ROW_CAP = 500

function resolveQuery(sql: string, parquetPath: string): string {
  return sql.replace(/\{\{TABLE\}\}/g, `'${parquetPath}'`)
}

function ensureLimit(sql: string): string {
  if (/LIMIT\s+\d+/i.test(sql)) return sql
  return sql.trimEnd().replace(/;?\s*$/, '') + ' LIMIT 501'
}

export function DatasetDetailScreen() {
  const { colors, brand, isDark } = useTheme()
  const route = useRoute<DetailRoute>()
  const { dataset } = route.params

  const [schema, setSchema] = useState<SchemaColumn[] | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const [currentQuery, setCurrentQuery] = useState('')
  const [activeChip, setActiveChip] = useState<number | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [rowCount, setRowCount] = useState(0)
  const [execTimeMs, setExecTimeMs] = useState<number | undefined>()
  const [queryError, setQueryError] = useState<string | undefined>()
  const [executing, setExecuting] = useState(false)
  const [overflowed, setOverflowed] = useState(false)

  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)
  const schemaFetchedPath = useRef<string | null>(null)

  const getDb = useCallback(() => {
    if (!dbRef.current) {
      const db = HybridDuckDB.open(':memory:', {})
      try { db.executeSync('LOAD httpfs') } catch { /* already loaded or will fail on query */ }
      dbRef.current = db
    }
    return dbRef.current
  }, [])

  useEffect(() => {
    return () => {
      if (dbRef.current) { try { dbRef.current.close() } catch {} }
    }
  }, [])

  useEffect(() => {
    if (schemaFetchedPath.current === dataset.parquetPath) return
    schemaFetchedPath.current = dataset.parquetPath
    setSchemaLoading(true)
    setSchemaError(null)

    try {
      const db = getDb()
      const describeSql = `DESCRIBE SELECT * FROM '${dataset.parquetPath}' LIMIT 0`
      const result = db.executeSync(describeSql)
      const records = result.toRows() as unknown as SchemaColumn[]
      setSchema(records)
    } catch (e: any) {
      setSchemaError(e?.message ?? 'Failed to load schema')
    } finally {
      setSchemaLoading(false)
    }
  }, [dataset.parquetPath, getDb])

  const executeQuery = useCallback((sql: string) => {
    setExecuting(true)
    setQueryError(undefined)
    setOverflowed(false)

    try {
      const db = getDb()
      const limitedSql = ensureLimit(sql)
      const start = Date.now()
      const result = db.executeSync(limitedSql)
      const elapsed = Date.now() - start

      const cols = result.columnNames
      const records = result.toRows()
      const tableRows = records.map((r: Record<string, any>) => cols.map(c => r[c]))

      if (tableRows.length > ROW_CAP) {
        setOverflowed(true)
        setRows(tableRows.slice(0, ROW_CAP))
        setRowCount(result.rowCount)
      } else {
        setRows(tableRows)
        setRowCount(tableRows.length)
      }
      setColumns(cols)
      setExecTimeMs(elapsed)
    } catch (e: any) {
      const msg = e?.message ?? 'Query execution failed'
      if (msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('network')) {
        setQueryError('Cannot reach Hugging Face. Check your connection.')
      } else {
        setQueryError(msg)
      }
      setColumns([])
      setRows([])
      setRowCount(0)
    } finally {
      setExecuting(false)
    }
  }, [getDb])

  const handleChipPress = useCallback((idx: number) => {
    const query = dataset.sampleQueries[idx]
    if (!query) return
    const resolved = resolveQuery(query.sql, dataset.parquetPath)
    setCurrentQuery(resolved)
    setActiveChip(idx)
    executeQuery(resolved)
  }, [dataset, executeQuery])

  const handleExecute = useCallback(() => {
    if (currentQuery.trim()) {
      setActiveChip(null)
      executeQuery(currentQuery)
    }
  }, [currentQuery, executeQuery])

  const categoryColor = {
    tabular: '#FFF100',
    nlp: '#7D66FF',
  }[dataset.category] ?? brand.yellow

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={[styles.datasetName, { color: colors.text }]}>{dataset.icon} {dataset.name}</Text>
          <View style={[styles.badge, { backgroundColor: categoryColor + '22' }]}>
            <Text style={[styles.badgeText, { color: isDark ? categoryColor : '#1F2328' }]}>
              {dataset.category}
            </Text>
          </View>
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{dataset.description}</Text>
        <TouchableOpacity onPress={() => Clipboard.setString(dataset.parquetPath)}>
          <Text style={[styles.pathText, { color: colors.textSecondary, backgroundColor: colors.surfaceAlt }]}>
            {dataset.parquetPath}
          </Text>
        </TouchableOpacity>
        {dataset.rowEstimate !== 'Unknown' && (
          <Text style={[styles.rowEstimate, { color: colors.textSecondary }]}>{dataset.rowEstimate}</Text>
        )}
      </View>

      {/* Schema */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Schema</Text>
        {schemaLoading && <ActivityIndicator size="small" color={brand.yellow} style={{ marginTop: 8 }} />}
        {schemaError && (
          <View style={[styles.errorBox, { borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{schemaError}</Text>
            <Text style={[styles.errorSql, { color: colors.textSecondary }]}>
              DESCRIBE SELECT * FROM '{dataset.parquetPath}' LIMIT 0
            </Text>
          </View>
        )}
        {schema && (
          <View style={[styles.schemaTable, { borderColor: colors.border }]}>
            <View style={[styles.schemaHeaderRow, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
              <Text style={[styles.schemaCell, styles.schemaCellName, { color: colors.text }]}>Column</Text>
              <Text style={[styles.schemaCell, styles.schemaCellType, { color: colors.text }]}>Type</Text>
              <Text style={[styles.schemaCell, styles.schemaCellNull, { color: colors.text }]}>Null</Text>
            </View>
            {schema.map((col, i) => (
              <View
                key={col.column_name}
                style={[styles.schemaRow, {
                  backgroundColor: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
                  borderBottomColor: colors.border,
                }]}>
                <Text style={[styles.schemaCell, styles.schemaCellName, { color: colors.text }]} numberOfLines={1}>
                  {col.column_name}
                </Text>
                <Text style={[styles.schemaCell, styles.schemaCellType, { color: brand.purple }]} numberOfLines={1}>
                  {col.column_type}
                </Text>
                <Text style={[styles.schemaCell, styles.schemaCellNull, { color: colors.textSecondary }]}>
                  {col.null}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Sample Queries */}
      {dataset.sampleQueries.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sample Queries</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.queryChips}>
            {dataset.sampleQueries.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.queryChip,
                  {
                    backgroundColor: activeChip === i ? (isDark ? brand.yellow : '#FFF9C4') : colors.surface,
                    borderColor: activeChip === i ? brand.yellow : colors.border,
                  },
                ]}
                onPress={() => handleChipPress(i)}>
                <Text style={[
                  styles.queryChipText,
                  { color: activeChip === i ? '#1F2328' : colors.textSecondary },
                ]}>
                  {q.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Query Editor */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Query</Text>
        <View style={[styles.editorBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {currentQuery ? (
            <SQLHighlighter sql={currentQuery} />
          ) : (
            <Text style={[styles.editorPlaceholder, { color: colors.textSecondary }]}>
              Tap a sample query or type below
            </Text>
          )}
        </View>
        <TextInput
          style={[styles.editorInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="Edit query here..."
          placeholderTextColor={colors.textSecondary}
          value={currentQuery}
          onChangeText={setCurrentQuery}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.executeBtn, { backgroundColor: brand.yellow, opacity: executing ? 0.6 : 1 }]}
          onPress={handleExecute}
          disabled={executing || !currentQuery.trim()}>
          {executing ? (
            <ActivityIndicator size="small" color="#1F2328" />
          ) : (
            <Text style={styles.executeBtnText}>Execute</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {(columns.length > 0 || queryError) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Results</Text>
          <QueryStatusBar executionTimeMs={execTimeMs} rowCount={rowCount} error={queryError} />
          {overflowed && (
            <View style={[styles.overflowBanner, { backgroundColor: '#FFF9C4', borderColor: brand.yellow }]}>
              <Text style={styles.overflowText}>
                Showing {ROW_CAP} of {rowCount} rows. Add a LIMIT clause for faster results.
              </Text>
            </View>
          )}
          {columns.length > 0 && rows.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <ResultTable columns={columns} rows={rows} rowCount={rowCount} />
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  datasetName: { fontSize: 22, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  pathText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rowEstimate: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  schemaTable: { borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  schemaHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  schemaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  schemaCell: {
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  schemaCellName: { flex: 2, fontWeight: '600' },
  schemaCellType: { flex: 2 },
  schemaCellNull: { flex: 1, textAlign: 'center' },
  errorBox: { borderWidth: 1, borderRadius: 6, padding: 12, marginTop: 4 },
  errorText: { fontSize: 13, fontWeight: '600' },
  errorSql: { fontSize: 11, fontFamily: 'monospace', marginTop: 6 },
  queryChips: { marginBottom: 4 },
  queryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  queryChipText: { fontSize: 13, fontWeight: '500' },
  editorBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    minHeight: 60,
    marginBottom: 8,
  },
  editorPlaceholder: { fontSize: 13, fontStyle: 'italic' },
  editorInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  executeBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  executeBtnText: { color: '#1F2328', fontSize: 15, fontWeight: '700' },
  overflowBanner: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  overflowText: { fontSize: 12, color: '#1F2328' },
})
