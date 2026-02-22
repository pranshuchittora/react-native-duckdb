import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { QueryStatusBar } from '../components/StatusBar'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

const ACCENT = '#FF6900'

type FileType = 'parquet' | 'csv' | 'json'

interface BundledFile {
  name: string
  type: FileType
  description: string
  sampleQuery: string
  icon: string
}

// Only books.json exists in example/src/data/. Others are defined for future bundling.
const BUNDLED_FILES: BundledFile[] = [
  {
    name: 'books.json',
    type: 'json',
    description: 'Book catalog with titles, authors, and descriptions (FTS dataset)',
    sampleQuery: "SELECT * FROM read_json('{path}') LIMIT 50;",
    icon: 'book-open-variant',
  },
  // These files don't exist yet — placeholder for future expansion
  // {
  //   name: 'sample_data.parquet',
  //   type: 'parquet',
  //   description: 'Sample dataset with mixed column types',
  //   sampleQuery: "SELECT * FROM read_parquet('{path}') LIMIT 50;",
  //   icon: 'table',
  // },
  // {
  //   name: 'cities.csv',
  //   type: 'csv',
  //   description: 'World cities with population and coordinates',
  //   sampleQuery: "SELECT * FROM read_csv('{path}') WHERE population > 1000000 ORDER BY population DESC LIMIT 20;",
  //   icon: 'city',
  // },
  // {
  //   name: 'events.json',
  //   type: 'json',
  //   description: 'Sample event log entries',
  //   sampleQuery: "SELECT * FROM read_json('{path}') LIMIT 50;",
  //   icon: 'calendar-text',
  // },
]

const TYPE_BADGE_COLORS: Record<FileType, { bg: string; text: string }> = {
  parquet: { bg: '#E3F2FD', text: '#1565C0' },
  csv: { bg: '#E8F5E9', text: '#2E7D32' },
  json: { bg: '#FFF3E0', text: '#E65100' },
}

export function FileQueriesScreen() {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [schemaColumns, setSchemaColumns] = useState<string[]>([])
  const [schemaRows, setSchemaRows] = useState<any[][]>([])
  const [activeSchema, setActiveSchema] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  useEffect(() => {
    try {
      const db = HybridDuckDB.open(':memory:', {})
      dbRef.current = db
    } catch (e: any) {
      setError('Failed to open database: ' + String(e.message || e))
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

  const getFilePath = useCallback((fileName: string): string => {
    // For bundled JSON files loaded via require(), we can use inline data
    // via DuckDB's read_json. For a real app, files would be copied to
    // the documents directory. Here we create a temp table from the
    // required JSON data for demonstration.
    return fileName
  }, [])

  const loadSampleQuery = useCallback((file: BundledFile) => {
    // For books.json which we know exists, create a working query
    // by loading the data into a temp table first
    if (file.name === 'books.json') {
      setQuery(
        "SELECT id, title, author, language FROM books_data LIMIT 50;"
      )
    } else {
      const path = getFilePath(file.name)
      setQuery(file.sampleQuery.replace('{path}', path))
    }
    setError(null)
  }, [getFilePath])

  const ensureBooksTable = useCallback(async (db: ReturnType<typeof HybridDuckDB.open>) => {
    try {
      await db.execute('SELECT 1 FROM books_data LIMIT 1')
    } catch {
      const books = require('../data/books.json')
      await db.execute(
        'CREATE TABLE books_data (id VARCHAR, title VARCHAR, description VARCHAR, author VARCHAR, language VARCHAR)'
      )
      for (const b of books) {
        await db.execute(
          `INSERT INTO books_data VALUES ('${b.id}', '${b.title.replace(/'/g, "''")}', '${b.description.replace(/'/g, "''")}', '${b.author.replace(/'/g, "''")}', '${b.language}')`
        )
      }
    }
  }, [])

  const viewSchema = useCallback(
    async (file: BundledFile) => {
      const db = dbRef.current
      if (!db) return

      if (activeSchema === file.name) {
        setActiveSchema(null)
        return
      }

      try {
        if (file.name === 'books.json') {
          await ensureBooksTable(db)
          const result = await db.execute('DESCRIBE books_data')
          const records = result.toRows()
          const cols = result.columnNames
          setSchemaColumns(cols)
          setSchemaRows(records.map((r: any) => cols.map((c) => r[c])))
          setActiveSchema(file.name)
        }
      } catch (e: any) {
        setError(String(e.message || e))
      }
    },
    [activeSchema, ensureBooksTable]
  )

  const runQuery = useCallback(async () => {
    const db = dbRef.current
    if (!db || !query.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      await ensureBooksTable(db)
      const start = Date.now()
      const result = await db.execute(query)
      setExecutionTimeMs(Date.now() - start)
      const records = result.toRows()
      const cols = result.columnNames
      setColumns(cols)
      setRows(records.map((r: any) => cols.map((c) => r[c])))
    } catch (e: any) {
      setError(String(e.message || e))
      setColumns([])
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [query, ensureBooksTable])

  return (
    <KeyboardAwareScrollView
      bottomOffset={50}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={[styles.accentBar, { backgroundColor: ACCENT }]} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>File Queries</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Query local Parquet, CSV, and JSON files bundled with the app
          </Text>
        </View>
      </View>

      {/* File List */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Bundled Files</Text>
        {BUNDLED_FILES.map((file) => {
          const badge = TYPE_BADGE_COLORS[file.type]
          return (
            <View
              key={file.name}
              style={[styles.fileCard, { borderColor: colors.border }]}>
              <View style={styles.fileHeader}>
                <MaterialCommunityIcons
                  name={file.icon as any}
                  size={24}
                  color={ACCENT}
                />
                <View style={styles.fileInfo}>
                  <View style={styles.fileNameRow}>
                    <Text style={[styles.fileName, { color: colors.text }]}>
                      {file.name}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.typeBadgeText, { color: badge.text }]}>
                        {file.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.fileDesc, { color: colors.textSecondary }]}>
                    {file.description}
                  </Text>
                </View>
              </View>
              <View style={styles.fileActions}>
                <TouchableOpacity
                  style={[styles.fileButton, { borderColor: colors.border }]}
                  onPress={() => viewSchema(file)}>
                  <MaterialCommunityIcons name="table-eye" size={14} color={colors.textSecondary} />
                  <Text style={[styles.fileButtonText, { color: colors.textSecondary }]}>
                    {activeSchema === file.name ? 'Hide Schema' : 'View Schema'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fileButton, { borderColor: ACCENT + '60', backgroundColor: ACCENT + '10' }]}
                  onPress={() => loadSampleQuery(file)}>
                  <MaterialCommunityIcons name="code-tags" size={14} color={ACCENT} />
                  <Text style={[styles.fileButtonText, { color: ACCENT }]}>Sample Query</Text>
                </TouchableOpacity>
              </View>
              {activeSchema === file.name && schemaRows.length > 0 && (
                <View style={styles.schemaWrap}>
                  <ResultTable columns={schemaColumns} rows={schemaRows} />
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* Query Editor */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Query</Text>
        <View style={[styles.editorWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={styles.promptChar}>D</Text>
          <View style={styles.editorInner}>
            <TextInput
              style={[styles.queryInput, { color: 'transparent' }]}
              multiline
              value={query}
              onChangeText={setQuery}
              placeholder="SELECT * FROM books_data LIMIT 50;"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
            />
            <View style={styles.highlighterOverlay} pointerEvents="none">
              <SQLHighlighter sql={query} />
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.runButton, { backgroundColor: ACCENT, opacity: isLoading || !query.trim() ? 0.6 : 1 }]}
          onPress={runQuery}
          disabled={isLoading || !query.trim()}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="play" size={18} color="#fff" />
              <Text style={styles.runButtonText}>Run Query</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && (
        <View style={[styles.errorCard, { borderColor: colors.error + '40' }]}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {rows.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Results</Text>
            <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
              {rows.length} rows
            </Text>
          </View>
          <ResultTable columns={columns} rows={rows} rowCount={rows.length} />
          <View style={styles.statusBarWrap}>
            <QueryStatusBar executionTimeMs={executionTimeMs} rowCount={rows.length} />
          </View>
        </View>
      )}
    </KeyboardAwareScrollView>
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
  fileCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  fileHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  fileInfo: {
    flex: 1,
    gap: 4,
  },
  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  fileDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  fileButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  schemaWrap: {
    marginTop: 4,
  },
  editorWrap: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  promptChar: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#FF6900',
    paddingLeft: 10,
    paddingTop: 8,
  },
  editorInner: {
    flex: 1,
    minHeight: 80,
    position: 'relative',
  },
  queryInput: {
    minHeight: 80,
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  highlighterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  runButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#FEE2E220',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  resultCount: {
    fontSize: 12,
  },
  statusBarWrap: {
    marginTop: 4,
  },
})
