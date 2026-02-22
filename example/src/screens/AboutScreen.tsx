import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { HybridDuckDB } from 'react-native-duckdb'
import type { Database } from 'react-native-duckdb'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { useTheme } from '../theme'
import { brand } from '../theme/colors'

const REPO_URL = 'https://github.com/pranshuchittora/react-native-duckdb'
const NPM_URL = 'https://www.npmjs.com/package/react-native-duckdb'
const ISSUES_URL = 'https://github.com/pranshuchittora/react-native-duckdb/issues'
const PKG_VERSION = '0.1.0'

const EXTENSIONS = [
  { name: 'httpfs', icon: 'cloud-download-outline', color: brand.blue, desc: 'Query remote Parquet, CSV & JSON over HTTP/S3' },
  { name: 'fts', icon: 'text-search', color: brand.green, desc: 'Full-text search with BM25 ranking' },
  { name: 'vss', icon: 'vector-combine', color: brand.purple, desc: 'Vector similarity search with HNSW indexes' },
]

const LINKS = [
  { label: 'GitHub Repository', icon: 'github', url: REPO_URL },
  { label: 'npm Package', icon: 'npm', url: NPM_URL },
  { label: 'Report an Issue', icon: 'bug-outline', url: ISSUES_URL },
  { label: 'DuckDB Documentation', icon: 'book-open-outline', url: 'https://duckdb.org/docs/' },
]

export function AboutScreen() {
  const { colors, isDark } = useTheme()
  const dbRef = useRef<Database | null>(null)
  const [duckdbVersion, setDuckdbVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const db = await HybridDuckDB.open(':memory:')
        dbRef.current = db
        const result = await db.execute('SELECT version() AS v')
        if (!cancelled && result.rows.length > 0) {
          setDuckdbVersion(String(result.rows[0][0]))
        }
      } catch {
        if (!cancelled) setDuckdbVersion('unknown')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      dbRef.current?.close()
    }
  }, [])

  const openLink = (url: string) => Linking.openURL(url)

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="duck" size={56} color={brand.yellow} />
        <Text style={[styles.title, { color: colors.text }]}>react-native-duckdb</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          DuckDB for React Native, built with Nitro Modules
        </Text>
      </View>

      {/* Star prompt */}
      <TouchableOpacity
        style={[styles.starBanner, { backgroundColor: isDark ? '#1C1C00' : '#FFFDE0', borderColor: brand.yellow }]}
        activeOpacity={0.7}
        onPress={() => openLink(REPO_URL)}>
        <MaterialCommunityIcons name="star-outline" size={22} color={brand.yellow} />
        <Text style={[styles.starText, { color: colors.text }]}>
          If you find this useful, give us a star on GitHub!
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Version cards */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Versions</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.versionRow}>
          <View style={styles.versionLabel}>
            <MaterialCommunityIcons name="package-variant" size={20} color={brand.orange} />
            <Text style={[styles.versionKey, { color: colors.text }]}>Package</Text>
          </View>
          <Text style={[styles.versionValue, { color: brand.orange }]}>v{PKG_VERSION}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.versionRow}>
          <View style={styles.versionLabel}>
            <MaterialCommunityIcons name="duck" size={20} color={brand.yellow} />
            <Text style={[styles.versionKey, { color: colors.text }]}>DuckDB Engine</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={brand.yellow} />
          ) : (
            <Text style={[styles.versionValue, { color: brand.yellow }]}>{duckdbVersion}</Text>
          )}
        </View>
        <View style={styles.queryHint}>
          <SQLHighlighter sql="SELECT version()" />
        </View>
      </View>

      {/* Extensions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Extensions in Example App</Text>
      {EXTENSIONS.map((ext) => (
        <View key={ext.name} style={[styles.extCard, { backgroundColor: colors.surface, borderLeftColor: ext.color }]}>
          <View style={styles.extHeader}>
            <MaterialCommunityIcons name={ext.icon} size={22} color={ext.color} />
            <Text style={[styles.extName, { color: colors.text }]}>{ext.name}</Text>
          </View>
          <Text style={[styles.extDesc, { color: colors.textSecondary }]}>{ext.desc}</Text>
        </View>
      ))}

      {/* Links */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Links</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {LINKS.map((link, i) => (
          <React.Fragment key={link.url}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <TouchableOpacity style={styles.linkRow} activeOpacity={0.6} onPress={() => openLink(link.url)}>
              <MaterialCommunityIcons name={link.icon} size={20} color={brand.blue} />
              <Text style={[styles.linkLabel, { color: colors.text }]}>{link.label}</Text>
              <MaterialCommunityIcons name="open-in-new" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* Author */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Author</Text>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        activeOpacity={0.7}
        onPress={() => openLink('https://github.com/pranshuchittora')}>
        <View style={styles.authorRow}>
          <MaterialCommunityIcons name="account-circle-outline" size={36} color={brand.purple} />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: colors.text }]}>Pranshu Chittora</Text>
            <Text style={[styles.authorHandle, { color: colors.textSecondary }]}>@pranshuchittora</Text>
          </View>
          <MaterialCommunityIcons name="github" size={20} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* License */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          MIT License • Made with Nitro Modules
        </Text>
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 10 },
  subtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  starBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
    gap: 10,
  },
  starText: { flex: 1, fontSize: 14, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  card: { borderRadius: 10, padding: 14, marginBottom: 20 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  versionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionKey: { fontSize: 14, fontWeight: '500' },
  versionValue: { fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  queryHint: { marginTop: 6, paddingTop: 8, opacity: 0.7 },
  divider: { height: 1, marginVertical: 6 },
  extCard: {
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  extHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  extName: { fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  extDesc: { fontSize: 13, lineHeight: 18 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  linkLabel: { flex: 1, fontSize: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '600' },
  authorHandle: { fontSize: 13, marginTop: 2 },
  footer: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  footerText: { fontSize: 12 },
})
