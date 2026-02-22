import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
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

const ACCENT = '#2EAFFF'

type FileType = 'parquet' | 'csv' | 'json'

const READER_FN: Record<FileType, string> = {
  parquet: 'read_parquet',
  csv: 'read_csv',
  json: 'read_json',
}

const EXAMPLE_URLS: { label: string; url: string; type: FileType }[] = [
  {
    label: 'Taxi Data (Parquet)',
    url: 'https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet',
    type: 'parquet',
  },
  {
    label: 'Iris CSV',
    url: 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv',
    type: 'csv',
  },
  {
    label: 'Countries JSON',
    url: 'https://raw.githubusercontent.com/samayo/country-json/master/src/country-by-population.json',
    type: 'json',
  },
]

function detectFileType(url: string): FileType | null {
  const lower = url.toLowerCase()
  if (lower.includes('.parquet')) return 'parquet'
  if (lower.includes('.csv')) return 'csv'
  if (lower.includes('.json')) return 'json'
  return null
}

export function RemoteFilesScreen() {
  const { colors, isDark } = useTheme()
  const [url, setUrl] = useState('')
  const [fileType, setFileType] = useState<FileType>('parquet')
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [schemaColumns, setSchemaColumns] = useState<string[]>([])
  const [schemaRows, setSchemaRows] = useState<any[][]>([])
  const [showSchema, setShowSchema] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExtLoading, setIsExtLoading] = useState(true)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const db = HybridDuckDB.open(':memory:', {})
        dbRef.current = db
        await db.execute('INSTALL httpfs; LOAD httpfs;')
        if (!cancelled) setIsExtLoading(false)
      } catch (e: any) {
        if (!cancelled) {
          setError('Failed to load httpfs extension: ' + String(e.message || e))
          setIsExtLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      if (dbRef.current) {
        try { dbRef.current.close() } catch (_) {}
        dbRef.current = null
      }
    }
  }, [])

  const updateUrl = useCallback(
    (newUrl: string, type?: FileType) => {
      setUrl(newUrl)
      const detected = type ?? detectFileType(newUrl)
      if (detected) {
        setFileType(detected)
        const fn = READER_FN[detected]
        setQuery(`SELECT * FROM ${fn}('${newUrl}') LIMIT 100;`)
      }
      setError(null)
      setSchemaColumns([])
      setSchemaRows([])
      setShowSchema(false)
    },
    []
  )

  const describeSchema = useCallback(async () => {
    const db = dbRef.current
    if (!db || !url.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const fn = READER_FN[fileType]
      const sql = `DESCRIBE SELECT * FROM ${fn}('${url}');`
      const result = await db.execute(sql)
      const records = result.toRows()
      const cols = result.columnNames
      setSchemaColumns(cols)
      setSchemaRows(records.map((r: any) => cols.map((c) => r[c])))
      setShowSchema(true)
    } catch (e: any) {
      const msg = String(e.message || e)
      if (msg.includes('HTTP') || msg.includes('Could not') || msg.includes('connect')) {
        setError('Could not reach URL. Check the address and try again.')
      } else if (msg.includes('format') || msg.includes('parse')) {
        setError('Invalid file format. Make sure the URL points to a valid ' + fileType + ' file.')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [url, fileType])

  const runQuery = useCallback(async () => {
    const db = dbRef.current
    if (!db || !query.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const start = Date.now()
      const result = await db.execute(query)
      setExecutionTimeMs(Date.now() - start)
      const records = result.toRows()
      const cols = result.columnNames
      setColumns(cols)
      setRows(records.map((r: any) => cols.map((c) => r[c])))
    } catch (e: any) {
      const msg = String(e.message || e)
      if (msg.includes('HTTP') || msg.includes('Could not') || msg.includes('connect')) {
        setError('Could not reach URL. Check the address and try again.')
      } else {
        setError(msg)
      }
      setColumns([])
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [query])

  const typeBadgeColor = (t: FileType) => {
    switch (t) {
      case 'parquet': return '#E3F2FD'
      case 'csv': return '#E8F5E9'
      case 'json': return '#FFF3E0'
    }
  }
  const typeBadgeTextColor = (t: FileType) => {
    switch (t) {
      case 'parquet': return '#1565C0'
      case 'csv': return '#2E7D32'
      case 'json': return '#E65100'
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={[styles.accentBar, { backgroundColor: ACCENT }]} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Remote Files</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Query Parquet, CSV, and JSON files directly from URLs
          </Text>
        </View>
      </View>

      {isExtLoading && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Loading httpfs extension...
          </Text>
        </View>
      )}

      {/* URL Input */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>URL</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <MaterialCommunityIcons name="link" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.urlInput, { color: colors.text }]}
            placeholder="https://example.com/data.parquet"
            placeholderTextColor={colors.textSecondary}
            value={url}
            onChangeText={(t) => updateUrl(t)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {/* File type indicator */}
        <View style={styles.typeRow}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Type:</Text>
          {(['parquet', 'csv', 'json'] as FileType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeBadge,
                {
                  backgroundColor: fileType === t ? typeBadgeColor(t) : 'transparent',
                  borderColor: fileType === t ? typeBadgeTextColor(t) + '40' : colors.border,
                },
              ]}
              onPress={() => {
                setFileType(t)
                if (url.trim()) {
                  setQuery(`SELECT * FROM ${READER_FN[t]}('${url}') LIMIT 100;`)
                }
              }}>
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: fileType === t ? typeBadgeTextColor(t) : colors.textSecondary },
                ]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Example URL chips */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Examples</Text>
        <View style={styles.chipRow}>
          {EXAMPLE_URLS.map((ex) => (
            <TouchableOpacity
              key={ex.label}
              style={[styles.chip, { borderColor: ACCENT + '60', backgroundColor: ACCENT + '10' }]}
              onPress={() => updateUrl(ex.url, ex.type)}>
              <Text style={[styles.chipText, { color: ACCENT }]}>{ex.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Schema Explorer */}
      {url.trim() !== '' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Schema</Text>
            <TouchableOpacity
              style={[styles.describeButton, { backgroundColor: ACCENT + '20' }]}
              onPress={describeSchema}
              disabled={isLoading}>
              <MaterialCommunityIcons name="table-search" size={16} color={ACCENT} />
              <Text style={[styles.describeButtonText, { color: ACCENT }]}>Describe</Text>
            </TouchableOpacity>
          </View>
          {showSchema && schemaRows.length > 0 && (
            <ResultTable columns={schemaColumns} rows={schemaRows} />
          )}
        </View>
      )}

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
              placeholder="SELECT * FROM read_parquet('...') LIMIT 100;"
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
        )}
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
          <TouchableOpacity onPress={runQuery} style={[styles.retryButton, { borderColor: colors.error }]}>
            <Text style={[styles.retryText, { color: colors.error }]}>Retry</Text>
          </TouchableOpacity>
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
  infoText: {
    fontSize: 13,
    textAlign: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  describeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  describeButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
    color: '#2EAFFF',
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
  retryButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
  },
  statusBarWrap: {
    marginTop: 4,
  },
})
