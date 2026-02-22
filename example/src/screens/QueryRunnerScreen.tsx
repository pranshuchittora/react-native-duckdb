import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Keyboard,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { QueryStatusBar } from '../components/StatusBar'
import {
  initQueryStore,
  saveToHistory,
  saveQuery as saveQueryToStore,
  getSavedQueries,
  type SavedQuery,
} from '../db/queryStore'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { QueryStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<QueryStackParamList, 'QueryRunner'>

const EXAMPLE_QUERIES = [
  {
    label: 'Create Table',
    sql: "CREATE TABLE demo(id INT, name VARCHAR, score DOUBLE);\nINSERT INTO demo VALUES (1, 'Alice', 95.5), (2, 'Bob', 87.3), (3, 'Charlie', 92.1);",
  },
  {
    label: 'Aggregates',
    sql: 'SELECT count(*) as cnt, avg(score) as avg_score, min(score) as min_score, max(score) as max_score FROM demo;',
  },
  {
    label: 'Window Functions',
    sql: 'SELECT name, score, rank() OVER (ORDER BY score DESC) as rank FROM demo;',
  },
  {
    label: 'JSON',
    sql: "SELECT json_object('name', name, 'score', score) as json_row FROM demo;",
  },
  {
    label: 'Generate Series',
    sql: 'SELECT * FROM generate_series(1, 100);',
  },
]



interface QueryResult {
  columns: string[]
  rows: any[][]
  totalRows: number
  executionTimeMs: number
}

export function QueryRunnerScreen({ navigation, route }: Props) {
  const { colors, brand, isDark } = useTheme()
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
  const [showExamples, setShowExamples] = useState(false)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [showSaved, setShowSaved] = useState(false)

  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)
  const storeDbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  useEffect(() => {
    const db = HybridDuckDB.open(':memory:', {})
    const storeDb = HybridDuckDB.open('query_store.duckdb', {})
    dbRef.current = db
    storeDbRef.current = storeDb
    initQueryStore(storeDb)
    return () => {
      db.close()
      storeDb.close()
    }
  }, [])

  useEffect(() => {
    const prefill = route.params?.prefillSql
    if (prefill) setSql(prefill)
  }, [route.params?.prefillSql])

  const loadSavedQueries = useCallback(() => {
    if (!storeDbRef.current) return
    try {
      setSavedQueries(getSavedQueries(storeDbRef.current))
    } catch {}
  }, [])

  const executeQuery = useCallback(async () => {
    if (!dbRef.current || !sql.trim()) return
    Keyboard.dismiss()
    setExecuting(true)
    setError(null)
    setResult(null)

    const start = Date.now()
    try {
      const statements = sql.split(';').filter(s => s.trim())
      let lastResult: Awaited<ReturnType<typeof dbRef.current.execute>> | null = null

      for (const stmt of statements) {
        lastResult = await dbRef.current!.execute(stmt.trim())
      }

      const elapsed = Date.now() - start

      if (lastResult) {
        const columnNames = lastResult.columnNames
        const rowObjects = lastResult.toRows()
        const totalRows = rowObjects.length

        const rows = rowObjects.map(row =>
          columnNames.map(col => (row as Record<string, unknown>)[col]),
        )

        setResult({ columns: columnNames, rows, totalRows, executionTimeMs: elapsed })

        if (storeDbRef.current) {
          try { saveToHistory(storeDbRef.current, sql, elapsed, totalRows) } catch {}
        }
      } else {
        const elapsed2 = Date.now() - start
        setResult({ columns: [], rows: [], totalRows: 0, executionTimeMs: elapsed2 })
        if (storeDbRef.current) {
          try { saveToHistory(storeDbRef.current, sql, elapsed2, 0) } catch {}
        }
      }
    } catch (e: any) {
      const elapsed = Date.now() - start
      const msg = e?.message || String(e)
      setError(msg)
      if (storeDbRef.current) {
        try { saveToHistory(storeDbRef.current, sql, elapsed, 0, msg) } catch {}
      }
    } finally {
      setExecuting(false)
    }
  }, [sql])

  const handleSave = useCallback(() => {
    if (!storeDbRef.current || !sql.trim()) return
    Alert.prompt('Save Query', 'Enter a name for this query:', (name) => {
      if (!name?.trim()) return
      try {
        saveQueryToStore(storeDbRef.current!, name.trim(), sql)
      } catch {}
    })
  }, [sql])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Query Runner</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('QueryHistory')}>
            <MaterialCommunityIcons name="history" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => { loadSavedQueries(); setShowSaved(!showSaved) }}>
            <MaterialCommunityIcons name="bookmark-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved queries dropdown */}
      {showSaved && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {savedQueries.length === 0 ? (
            <Text style={[styles.dropdownEmpty, { color: colors.textSecondary }]}>No saved queries</Text>
          ) : (
            savedQueries.map(q => (
              <TouchableOpacity
                key={q.id}
                style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                onPress={() => { setSql(q.sql); setShowSaved(false) }}>
                <Text style={[styles.dropdownLabel, { color: colors.text }]}>{q.name}</Text>
                <Text style={[styles.dropdownSql, { color: colors.textSecondary }]} numberOfLines={1}>
                  {q.sql}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* SQL Editor */}
        <View style={[styles.editorContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.promptChar, { color: brand.yellow }]}>D</Text>
          <View style={styles.editorWrapper}>
            <TextInput
              style={[styles.editor, { color: 'transparent' }]}
              value={sql}
              onChangeText={setSql}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="Enter SQL query..."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
            />
            <View style={styles.highlighterOverlay} pointerEvents="none">
              <SQLHighlighter sql={sql} />
            </View>
          </View>
          {sql.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={() => setSql('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.examplesButton, { borderColor: colors.border }]}
            onPress={() => setShowExamples(!showExamples)}>
            <MaterialCommunityIcons name="code-braces" size={16} color={colors.textSecondary} />
            <Text style={[styles.examplesText, { color: colors.textSecondary }]}>Examples</Text>
            <MaterialCommunityIcons
              name={showExamples ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.actionRight}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <MaterialCommunityIcons name="bookmark-plus-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.runButton, { backgroundColor: brand.yellow, opacity: executing ? 0.6 : 1 }]}
              onPress={executeQuery}
              disabled={executing || !sql.trim()}>
              {executing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <MaterialCommunityIcons name="play" size={18} color="#000" />
                  <Text style={styles.runText}>Run</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Examples dropdown */}
        {showExamples && (
          <View style={[styles.examplesDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {EXAMPLE_QUERIES.map((eq, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.exampleItem, i < EXAMPLE_QUERIES.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                onPress={() => { setSql(eq.sql); setShowExamples(false) }}>
                <Text style={[styles.exampleLabel, { color: brand.purple }]}>{eq.label}</Text>
                <Text style={[styles.exampleSql, { color: colors.textSecondary }]} numberOfLines={1}>
                  {eq.sql}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status bar */}
        {(result || error) && (
          <View style={styles.statusArea}>
            <QueryStatusBar
              executionTimeMs={result?.executionTimeMs}
              rowCount={result?.totalRows}
              error={error ?? undefined}
            />
          </View>
        )}

        {/* Error card */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: isDark ? '#3D1518' : '#FEE2E2', borderColor: isDark ? '#6B2126' : '#FECACA' }]}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Result area */}
        {result && !error && result.columns.length > 0 && (
          <View style={styles.resultArea}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'table' && { backgroundColor: colors.surfaceAlt }]}
                onPress={() => setViewMode('table')}>
                <Text style={[styles.toggleText, { color: viewMode === 'table' ? colors.text : colors.textSecondary }]}>
                  Table
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'json' && { backgroundColor: colors.surfaceAlt }]}
                onPress={() => setViewMode('json')}>
                <Text style={[styles.toggleText, { color: viewMode === 'json' ? colors.text : colors.textSecondary }]}>
                  JSON
                </Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'table' ? (
              <ResultTable
                columns={result.columns}
                rows={result.rows}
                rowCount={result.totalRows}
              />
            ) : (
              <ScrollView
                style={[styles.jsonView, { backgroundColor: colors.surface, borderColor: colors.border }]}
                nestedScrollEnabled>
                <Text style={[styles.jsonText, { color: colors.text }]}>
                  {JSON.stringify(
                    result.rows.map(row =>
                      Object.fromEntries(result.columns.map((col, i) => [col, row[i]])),
                    ),
                    null,
                    2,
                  )}
                </Text>
              </ScrollView>
            )}
          </View>
        )}

        {/* Empty result */}
        {result && !error && result.columns.length === 0 && (
          <View style={[styles.emptyResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={24} color={brand.green} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Query executed successfully
            </Text>
            {result.executionTimeMs != null && (
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                {result.executionTimeMs}ms
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    maxHeight: 200,
  },
  dropdownEmpty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 13,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownSql: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  editorContainer: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  promptChar: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 10,
    paddingTop: 12,
  },
  editorWrapper: {
    flex: 1,
    minHeight: 130,
    position: 'relative',
  },
  editor: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    minHeight: 130,
    textAlignVertical: 'top',
  },
  highlighterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  examplesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  examplesText: {
    fontSize: 13,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButton: {
    padding: 6,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  runText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  examplesDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  exampleItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exampleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  exampleSql: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  statusArea: {
    marginTop: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  resultArea: {
    marginTop: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 4,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jsonView: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    maxHeight: 400,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  emptyResult: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
  },
})
