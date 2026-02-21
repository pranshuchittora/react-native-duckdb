import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'

const books = require('../data/books.json')

interface BookResult {
  id: string
  title: string
  description: string
  author: string
  language: string
  score: number | null
}

interface Props {
  onBack?: () => void
}

export function FTSExplorerScreen({ onBack }: Props = {}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      // Show all books initially
      const all = db.executeSync(
        'SELECT id, title, description, author, language FROM books ORDER BY id'
      )
      setResults(
        all.toRows().map((r: any) => ({
          id: r.id as string,
          title: r.title as string,
          description: r.description as string,
          author: r.author as string,
          language: r.language as string,
          score: null,
        }))
      )
      setIsReady(true)
    } catch (e: any) {
      setError(String(e.message || e))
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

  const executeSearch = useCallback((query: string) => {
    const db = dbRef.current
    if (!db) return

    try {
      if (!query.trim()) {
        const all = db.executeSync(
          'SELECT id, title, description, author, language FROM books ORDER BY id'
        )
        setResults(
          all.toRows().map((r: any) => ({
            id: r.id as string,
            title: r.title as string,
            description: r.description as string,
            author: r.author as string,
            language: r.language as string,
            score: null,
          }))
        )
        return
      }

      const escapedQuery = query.toLowerCase().replace(/'/g, "''")
      const result = db.executeSync(
        `SELECT id, title, description, author, language, score FROM (SELECT *, fts_main_books.match_bm25(id, '${escapedQuery}') AS score FROM books) sq WHERE score IS NOT NULL ORDER BY score DESC`
      )
      setResults(
        result.toRows().map((r: any) => ({
          id: r.id as string,
          title: r.title as string,
          description: r.description as string,
          author: r.author as string,
          language: r.language as string,
          score: r.score as number,
        }))
      )
    } catch (_) {
      setResults([])
    }
  }, [])

  const onChangeText = useCallback(
    (text: string) => {
      setSearchQuery(text)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => executeSearch(text), 300)
    },
    [executeSearch]
  )

  const renderItem = useCallback(({ item }: { item: BookResult }) => {
    const desc =
      item.description.length > 120
        ? item.description.slice(0, 120) + '...'
        : item.description
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.score !== null && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{item.score.toFixed(3)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.resultDesc} numberOfLines={2}>
          {desc}
        </Text>
        <View style={styles.resultFooter}>
          <Text style={styles.resultAuthor}>{item.author}</Text>
          <View
            style={[
              styles.langBadge,
              item.language === 'fr' ? styles.langBadgeFr : styles.langBadgeEn,
            ]}>
            <Text
              style={[
                styles.langBadgeText,
                item.language === 'fr'
                  ? styles.langBadgeTextFr
                  : styles.langBadgeTextEn,
              ]}>
              {item.language.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    )
  }, [])

  if (error) {
    const isRowidBug = error.includes('Information loss on integer cast')
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FTS Explorer</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          {isRowidBug ? (
            <>
              <Text style={styles.errorEmoji}>🐛</Text>
              <Text style={styles.errorTitle}>
                FTS Unavailable on Android
              </Text>
              <Text style={styles.errorDesc}>
                DuckDB's FTS extension has a known bug where internal rowid
                values overflow on Android, preventing index creation.
              </Text>
              <Text style={styles.errorDesc}>
                The stem() function and FTS on iOS work correctly. This is an
                upstream issue being tracked.
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://github.com/duckdb/duckdb-fts/issues/24'
                  )
                }
                style={styles.issueLink}>
                <Text style={styles.issueLinkText}>
                  duckdb/duckdb-fts#24
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.errorText}>Error: {error}</Text>
          )}
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
        <Text style={styles.headerTitle}>FTS Explorer</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {books.length} books · stemmer: english
        </Text>
        <Text style={styles.resultCount}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search books..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={onChangeText}
          editable={isReady}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isReady ? 'No results found' : 'Loading...'}
            </Text>
          </View>
        }
      />
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
    color: '#E65100',
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
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF3E0',
  },
  infoText: {
    fontSize: 12,
    color: '#E65100',
  },
  resultCount: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 42,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  listContent: {
    paddingVertical: 8,
  },
  resultCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  scorePill: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '600',
  },
  resultDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  resultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultAuthor: {
    fontSize: 12,
    color: '#999',
  },
  langBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  langBadgeEn: {
    backgroundColor: '#E3F2FD',
  },
  langBadgeFr: {
    backgroundColor: '#FCE4EC',
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  langBadgeTextEn: {
    color: '#1565C0',
  },
  langBadgeTextFr: {
    color: '#C62828',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  issueLink: {
    marginTop: 12,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  issueLinkText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
})
