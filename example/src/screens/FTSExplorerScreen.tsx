import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { ResultTable } from '../components/ResultTable'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { QueryStatusBar } from '../components/StatusBar'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

const books = require('../data/books.json')

const ACCENT = '#00C770'

type SearchMode = 'match' | 'prefix' | 'phrase'

export function FTSExplorerScreen() {
  const { colors, isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('match')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>()
  const [showSetupSql, setShowSetupSql] = useState(false)
  const [showQuerySql, setShowQuerySql] = useState(false)
  const [lastSql, setLastSql] = useState('')
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setupSql = `LOAD 'fts';
CREATE TABLE books (id VARCHAR, title VARCHAR, description VARCHAR, author VARCHAR, language VARCHAR);
-- Insert ${books.length} books from books.json
PRAGMA create_fts_index('books', 'id', 'title', 'description', stemmer='english');`

  useEffect(() => {
    try {
      const db = HybridDuckDB.open(':memory:', {})
      dbRef.current = db

      db.executeSync("LOAD 'fts'")
      db.executeSync(
        'CREATE TABLE books (id VARCHAR, title VARCHAR, description VARCHAR, author VARCHAR, language VARCHAR)'
      )

      for (const b of books) {
        db.executeSync(
          `INSERT INTO books VALUES ('${b.id}', '${b.title.replace(/'/g, "''")}', '${b.description.replace(/'/g, "''")}', '${b.author.replace(/'/g, "''")}', '${b.language}')`
        )
      }

      db.executeSync(
        "PRAGMA create_fts_index('books', 'id', 'title', 'description', stemmer='english')"
      )

      const all = db.executeSync(
        'SELECT id, title, description, author, language FROM books ORDER BY id'
      )
      const records = all.toRows()
      const cols = all.columnNames
      setColumns(cols)
      setRows(records.map((r: any) => cols.map((c) => r[c])))
      setIsReady(true)
      setIsInitializing(false)
    } catch (e: any) {
      setError(String(e.message || e))
      setIsInitializing(false)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (dbRef.current) {
        try {
          dbRef.current.close()
        } catch (_) {}
        dbRef.current = null
      }
    }
  }, [])

  const buildSearchSql = useCallback(
    (query: string, mode: SearchMode): string => {
      const escaped = query.toLowerCase().replace(/'/g, "''")
      let term = escaped
      if (mode === 'prefix') term = escaped + '*'
      else if (mode === 'phrase') term = `"${escaped}"`
      return `SELECT id, title, description, author, language, score
FROM (
  SELECT *, fts_main_books.match_bm25(id, '${term}') AS score
  FROM books
) sq
WHERE score IS NOT NULL
ORDER BY score DESC`
    },
    []
  )

  const executeSearch = useCallback(
    async (query: string, mode: SearchMode) => {
      const db = dbRef.current
      if (!db) return

      setIsSearching(true)
      try {
        if (!query.trim()) {
          const sql = 'SELECT id, title, description, author, language FROM books ORDER BY id'
          setLastSql(sql)
          const start = Date.now()
          const all = await db.execute(sql)
          setExecutionTimeMs(Date.now() - start)
          const records = all.toRows()
          const cols = all.columnNames
          setColumns(cols)
          setRows(records.map((r: any) => cols.map((c) => r[c])))
          return
        }

        const sql = buildSearchSql(query, mode)
        setLastSql(sql)
        const start = Date.now()
        const result = await db.execute(sql)
        setExecutionTimeMs(Date.now() - start)
        const records = result.toRows()
        const cols = result.columnNames
        setColumns(cols)
        setRows(records.map((r: any) => cols.map((c) => r[c])))
      } catch (_) {
        setColumns([])
        setRows([])
      } finally {
        setIsSearching(false)
      }
    },
    [buildSearchSql]
  )

  const onChangeText = useCallback(
    (text: string) => {
      setSearchQuery(text)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => executeSearch(text, searchMode), 300)
    },
    [executeSearch, searchMode]
  )

  const onModeChange = useCallback(
    (mode: SearchMode) => {
      setSearchMode(mode)
      if (searchQuery.trim()) executeSearch(searchQuery, mode)
    },
    [searchQuery, executeSearch]
  )

  const isRowidBug = error?.includes('Information loss on integer cast')

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          {isRowidBug ? (
            <>
              <MaterialCommunityIcons name="bug" size={48} color={colors.error} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>
                FTS Unavailable on Android
              </Text>
              <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
                DuckDB's FTS extension has a known bug where internal rowid
                values overflow on Android, preventing index creation.
              </Text>
              <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
                The stem() function and FTS on iOS work correctly. This is an
                upstream issue being tracked.
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://github.com/duckdb/duckdb-fts/issues/24')
                }
                style={[styles.issueLink, { backgroundColor: ACCENT + '20' }]}>
                <Text style={[styles.issueLinkText, { color: ACCENT }]}>
                  duckdb/duckdb-fts#24
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
          )}
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
          <Text style={[styles.title, { color: colors.text }]}>Full-Text Search</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            BM25-ranked text search powered by DuckDB FTS extension
          </Text>
        </View>
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
              style={[
                styles.statusDot,
                { backgroundColor: isReady ? ACCENT : colors.textSecondary },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isReady ? ACCENT : colors.textSecondary },
              ]}>
              {isInitializing ? 'Initializing...' : isReady ? 'Ready' : 'Not initialized'}
            </Text>
          </View>
        </View>
        {isInitializing && <ActivityIndicator color={ACCENT} style={styles.loader} />}
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {books.length} books loaded · stemmer: english
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
        <View style={[styles.searchInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search books..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onChangeText}
            editable={isReady}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        {/* Search mode selector */}
        <View style={styles.modeRow}>
          {(['match', 'prefix', 'phrase'] as SearchMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                {
                  backgroundColor: searchMode === mode ? ACCENT : 'transparent',
                  borderColor: searchMode === mode ? ACCENT : colors.border,
                },
              ]}
              onPress={() => onModeChange(mode)}>
              <Text
                style={[
                  styles.modeText,
                  { color: searchMode === mode ? '#fff' : colors.textSecondary },
                ]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: ACCENT, opacity: isSearching ? 0.6 : 1 }]}
          onPress={() => executeSearch(searchQuery, searchMode)}
          disabled={!isReady || isSearching}>
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="magnify" size={18} color="#fff" />
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
            <ResultTable columns={columns} rows={rows} rowCount={rows.length} />
            <View style={styles.statusBarWrap}>
              <QueryStatusBar executionTimeMs={executionTimeMs} rowCount={rows.length} />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="text-search" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isReady ? 'Enter a search term above' : 'Loading...'}
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
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeText: {
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
  issueLink: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  issueLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
})
