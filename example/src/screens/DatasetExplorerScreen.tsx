import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  type ListRenderItem,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { CURATED_DATASETS, DATASET_CATEGORIES, type Dataset } from '../data/datasets'
import type { DatasetStackParamList } from '../navigation/types'

type NavProp = NativeStackNavigationProp<DatasetStackParamList, 'DatasetExplorer'>

const CATEGORY_COLORS: Record<string, string> = {
  tabular: '#FFF100',
  nlp: '#7D66FF',
  benchmark: '#FF6900',
}

const FORMAT_BADGE: Record<string, { bg: string; text: string }> = {
  parquet: { bg: '#E3F2FD', text: '#1565C0' },
  csv: { bg: '#E8F5E9', text: '#2E7D32' },
  json: { bg: '#FFF3E0', text: '#E65100' },
}

let httpfsLoaded = false

export function DatasetExplorerScreen() {
  const { colors, brand, isDark } = useTheme()
  const navigation = useNavigation<NavProp>()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(!httpfsLoaded)
  const [httpfsError, setHttpfsError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const loadHttpfs = useCallback(async () => {
    if (httpfsLoaded) { setLoading(false); return }
    setLoading(true)
    setHttpfsError(null)
    try {
      const db = HybridDuckDB.open(':memory:', {})
      try {
        await db.execute('LOAD httpfs')
      } catch {
        await db.execute('INSTALL httpfs')
        await db.execute('LOAD httpfs')
      }
      db.close()
      httpfsLoaded = true
    } catch (e: any) {
      setHttpfsError(e?.message ?? 'Failed to load httpfs extension')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadHttpfs() }, [loadHttpfs])

  const isCustomPath = useMemo(() => {
    const trimmed = debouncedSearch.trim()
    return trimmed.includes('/') && !trimmed.includes(' ') && trimmed.length > 3
  }, [debouncedSearch])

  const filtered = useMemo(() => {
    let list = CURATED_DATASETS
    if (selectedCategory !== 'All') {
      list = list.filter(d => d.category.toLowerCase() === selectedCategory.toLowerCase())
    }
    if (debouncedSearch.trim() && !isCustomPath) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
      )
    }
    return list
  }, [selectedCategory, debouncedSearch, isCustomPath])

  const navigateToDataset = useCallback((dataset: Dataset) => {
    navigation.navigate('DatasetDetail', { dataset })
  }, [navigation])

  const openCustomPath = useCallback(() => {
    const trimmed = debouncedSearch.trim()
    const path = trimmed.startsWith('hf://') ? trimmed : `hf://datasets/${trimmed}`
    const fmt = path.endsWith('.csv') ? 'csv' as const : path.endsWith('.json') || path.endsWith('.jsonl') ? 'json' as const : 'parquet' as const
    const custom: Dataset = {
      id: 'custom',
      name: 'Custom Dataset',
      repo: trimmed,
      parquetPath: path,
      description: 'User-provided Hugging Face dataset path',
      category: 'tabular',
      format: fmt,
      icon: '📦',
      rowEstimate: 'Unknown',
      sampleQueries: [
        { name: 'Preview', sql: 'SELECT * FROM {{TABLE}} LIMIT 100' },
        { name: 'Row Count', sql: 'SELECT COUNT(*) as total_rows FROM {{TABLE}}' },
      ],
    }
    navigation.navigate('DatasetDetail', { dataset: custom })
  }, [debouncedSearch, navigation])

  const renderCategory = useCallback((cat: string) => {
    const isSelected = cat === selectedCategory
    return (
      <TouchableOpacity
        key={cat}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? (isDark ? brand.yellow : '#FFF9C4') : colors.surface,
            borderColor: isSelected ? brand.yellow : colors.border,
          },
        ]}
        onPress={() => setSelectedCategory(cat)}>
        <Text style={[
          styles.chipText,
          { color: isSelected ? '#1F2328' : colors.textSecondary },
        ]}>
          {cat}
        </Text>
      </TouchableOpacity>
    )
  }, [selectedCategory, isDark, brand, colors])

  const renderDataset: ListRenderItem<Dataset> = useCallback(({ item }) => {
    const accentColor = CATEGORY_COLORS[item.category] ?? brand.yellow
    const fmt = FORMAT_BADGE[item.format]
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => navigateToDataset(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>{item.icon}</Text>
          <View style={styles.cardTitleArea}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
              <Text style={[styles.badgeText, { color: isDark ? accentColor : '#1F2328' }]}>
                {item.category}
              </Text>
            </View>
            {fmt && (
              <View style={[styles.badge, { backgroundColor: fmt.bg }]}>
                <Text style={[styles.badgeText, { color: fmt.text }]}>
                  {item.format.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={[styles.cardRows, { color: colors.textSecondary }]}>
          {item.rowEstimate}
        </Text>
      </TouchableOpacity>
    )
  }, [colors, brand, isDark, navigateToDataset])

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={brand.yellow} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading httpfs extension...
        </Text>
      </SafeAreaView>
    )
  }

  if (httpfsError) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>Extension Error</Text>
        <Text style={[styles.errorMsg, { color: colors.textSecondary }]}>{httpfsError}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: brand.yellow }]}
          onPress={loadHttpfs}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Datasets</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Explore Hugging Face datasets with DuckDB
        </Text>
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search curated or enter hf:// path..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.chipRow}>
        {DATASET_CATEGORIES.map(cat => renderCategory(cat))}
      </View>

      {isCustomPath && (
        <TouchableOpacity
          style={[styles.customCard, { backgroundColor: colors.surface, borderColor: brand.yellow }]}
          onPress={openCustomPath}>
          <Text style={styles.customIcon}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customTitle, { color: colors.text }]}>Open Custom Dataset</Text>
            <Text style={[styles.customPath, { color: colors.textSecondary }]} numberOfLines={1}>
              {debouncedSearch.trim()}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={filtered}
        renderItem={renderDataset}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No datasets match your search
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              Try entering an hf:// path for a custom dataset
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  searchRow: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: { fontSize: 14, paddingVertical: 10, fontFamily: 'monospace' },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardIcon: { fontSize: 24, marginRight: 10 },
  cardTitleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  cardRows: { fontSize: 11, fontStyle: 'italic' },
  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  customIcon: { fontSize: 24, marginRight: 10 },
  customTitle: { fontSize: 14, fontWeight: '600' },
  customPath: { fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorMsg: { fontSize: 14, textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#1F2328', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, marginTop: 8 },
})
