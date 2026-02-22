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
  Animated,
  type ListRenderItem,
} from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import {
  CURATED_DATASETS,
  FORMAT_CATEGORIES,
  FORMAT_COLORS,
  fetchTrendingDatasets,
  type Dataset,
  type DatasetFormat,
} from '../data/datasets'
import type { DatasetStackParamList } from '../navigation/types'

type NavProp = NativeStackNavigationProp<DatasetStackParamList, 'DatasetExplorer'>
type TabType = 'Trending' | 'Curated'

let httpfsLoaded = false

function SkeletonCard({ colors }: { colors: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.skeletonCircle, { backgroundColor: colors.surfaceAlt }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.skeletonBar, { width: '60%', height: 14, backgroundColor: colors.surfaceAlt }]} />
          <View style={[styles.skeletonBar, { width: '90%', height: 10, backgroundColor: colors.surfaceAlt }]} />
        </View>
      </View>
      <View style={[styles.skeletonBar, { width: '40%', height: 10, backgroundColor: colors.surfaceAlt, marginTop: 8 }]} />
    </Animated.View>
  )
}

export function DatasetExplorerScreen() {
  const { colors, brand, isDark } = useTheme()
  const navigation = useNavigation<NavProp>()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('Trending')
  const [selectedFormat, setSelectedFormat] = useState<typeof FORMAT_CATEGORIES[number]>('All')
  const [loading, setLoading] = useState(!httpfsLoaded)
  const [httpfsError, setHttpfsError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [trendingByFormat, setTrendingByFormat] = useState<Record<DatasetFormat, Dataset[]>>({
    parquet: [], csv: [], json: [],
  })
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [hasMoreByFormat, setHasMoreByFormat] = useState<Record<DatasetFormat, boolean>>({
    parquet: false, csv: false, json: false,
  })
  const [offsetByFormat, setOffsetByFormat] = useState<Record<DatasetFormat, number>>({
    parquet: 0, csv: 0, json: 0,
  })
  const [loadingMore, setLoadingMore] = useState(false)

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

  // Fetch trending datasets on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setTrendingLoading(true)
      try {
        const [pq, csv, js] = await Promise.all([
          fetchTrendingDatasets('parquet').catch(() => ({ datasets: [], hasMore: false })),
          fetchTrendingDatasets('csv').catch(() => ({ datasets: [], hasMore: false })),
          fetchTrendingDatasets('json').catch(() => ({ datasets: [], hasMore: false })),
        ])
        if (cancelled) return
        setTrendingByFormat({ parquet: pq.datasets, csv: csv.datasets, json: js.datasets })
        setHasMoreByFormat({ parquet: pq.hasMore, csv: csv.hasMore, json: js.hasMore })
        setOffsetByFormat({ parquet: pq.datasets.length, csv: csv.datasets.length, json: js.datasets.length })
      } catch {
        // Silent fallback — trending stays empty, curated shows
      } finally {
        if (!cancelled) setTrendingLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const hasTrendingData = useMemo(() => {
    return trendingByFormat.parquet.length > 0 || trendingByFormat.csv.length > 0 || trendingByFormat.json.length > 0
  }, [trendingByFormat])

  // If API failed (no trending data after load), auto-switch to curated
  useEffect(() => {
    if (!trendingLoading && !hasTrendingData) {
      setActiveTab('Curated')
    }
  }, [trendingLoading, hasTrendingData])

  const isCustomPath = useMemo(() => {
    const trimmed = debouncedSearch.trim()
    return trimmed.includes('/') && !trimmed.includes(' ') && trimmed.length > 3
  }, [debouncedSearch])

  const filteredData = useMemo(() => {
    const allTrending = selectedFormat === 'All'
      ? [...trendingByFormat.parquet, ...trendingByFormat.csv, ...trendingByFormat.json]
          .sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
      : trendingByFormat[selectedFormat.toLowerCase() as DatasetFormat] ?? []

    const allCurated = selectedFormat === 'All'
      ? CURATED_DATASETS
      : CURATED_DATASETS.filter(d => d.format === selectedFormat.toLowerCase())

    const source = activeTab === 'Trending' ? allTrending : allCurated

    if (!debouncedSearch.trim() || isCustomPath) return source
    const q = debouncedSearch.toLowerCase()
    return source.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.author?.toLowerCase().includes(q) ?? false) ||
      d.repo.toLowerCase().includes(q),
    )
  }, [activeTab, selectedFormat, trendingByFormat, debouncedSearch, isCustomPath])

  const hasMoreForCurrentFormat = useMemo(() => {
    if (activeTab !== 'Trending') return false
    if (selectedFormat === 'All') {
      return hasMoreByFormat.parquet || hasMoreByFormat.csv || hasMoreByFormat.json
    }
    return hasMoreByFormat[selectedFormat.toLowerCase() as DatasetFormat] ?? false
  }, [activeTab, selectedFormat, hasMoreByFormat])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      if (selectedFormat === 'All') {
        const formats: DatasetFormat[] = ['parquet', 'csv', 'json']
        const results = await Promise.all(
          formats.map(fmt =>
            hasMoreByFormat[fmt]
              ? fetchTrendingDatasets(fmt, offsetByFormat[fmt]).catch(() => ({ datasets: [], hasMore: false }))
              : Promise.resolve({ datasets: [] as Dataset[], hasMore: false }),
          ),
        )
        setTrendingByFormat(prev => {
          const dedup = (existing: Dataset[], incoming: Dataset[]) => {
            const ids = new Set(existing.map(d => d.id))
            return [...existing, ...incoming.filter(d => !ids.has(d.id))]
          }
          return {
            parquet: dedup(prev.parquet, results[0].datasets),
            csv: dedup(prev.csv, results[1].datasets),
            json: dedup(prev.json, results[2].datasets),
          }
        })
        setHasMoreByFormat({
          parquet: results[0].hasMore,
          csv: results[1].hasMore,
          json: results[2].hasMore,
        })
        setOffsetByFormat(prev => ({
          parquet: prev.parquet + results[0].datasets.length,
          csv: prev.csv + results[1].datasets.length,
          json: prev.json + results[2].datasets.length,
        }))
      } else {
        const fmt = selectedFormat.toLowerCase() as DatasetFormat
        const result = await fetchTrendingDatasets(fmt, offsetByFormat[fmt])
        setTrendingByFormat(prev => {
          const ids = new Set(prev[fmt].map(d => d.id))
          return { ...prev, [fmt]: [...prev[fmt], ...result.datasets.filter(d => !ids.has(d.id))] }
        })
        setHasMoreByFormat(prev => ({ ...prev, [fmt]: result.hasMore }))
        setOffsetByFormat(prev => ({ ...prev, [fmt]: prev[fmt] + result.datasets.length }))
      }
    } catch {
      // Silent fail on load more
    } finally {
      setLoadingMore(false)
    }
  }, [selectedFormat, hasMoreByFormat, offsetByFormat, loadingMore])

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
      format: fmt,
      icon: 'package-variant',
      rowEstimate: 'Unknown',
      source: 'curated',
      sampleQueries: [
        { name: 'Preview', sql: 'SELECT * FROM {{TABLE}} LIMIT 100' },
        { name: 'Row Count', sql: 'SELECT COUNT(*) as total_rows FROM {{TABLE}}' },
      ],
    }
    navigation.navigate('DatasetDetail', { dataset: custom })
  }, [debouncedSearch, navigation])

  const renderFormatChip = useCallback((cat: typeof FORMAT_CATEGORIES[number]) => {
    const isSelected = cat === selectedFormat
    const formatKey = cat.toLowerCase() as DatasetFormat
    const chipColor = cat === 'All'
      ? { bg: brand.yellow, text: '#1F2328' }
      : FORMAT_COLORS[formatKey]
        ? { bg: FORMAT_COLORS[formatKey].bg.replace('33', ''), text: FORMAT_COLORS[formatKey].text }
        : { bg: brand.yellow, text: '#1F2328' }

    return (
      <TouchableOpacity
        key={cat}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected ? (cat === 'All' ? (isDark ? brand.yellow : '#FFF9C4') : FORMAT_COLORS[formatKey]?.bg ?? colors.surface) : colors.surface,
            borderColor: isSelected ? (cat === 'All' ? brand.yellow : chipColor.text) : colors.border,
          },
        ]}
        onPress={() => setSelectedFormat(cat)}>
        <Text style={[
          styles.chipText,
          { color: isSelected ? (cat === 'All' ? '#1F2328' : chipColor.text) : colors.textSecondary },
        ]}>
          {cat}
        </Text>
      </TouchableOpacity>
    )
  }, [selectedFormat, isDark, brand, colors])

  const renderDataset: ListRenderItem<Dataset> = useCallback(({ item }) => {
    const fmt = FORMAT_COLORS[item.format]
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => navigateToDataset(item)}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name={item.icon} size={24} color={colors.textSecondary} style={styles.cardIcon} />
          <View style={styles.cardTitleArea}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
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
        {item.source === 'trending' ? (
          <View style={styles.cardMeta}>
            {item.author && (
              <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
                by {item.author}
              </Text>
            )}
            <View style={styles.metaIcons}>
              <MaterialCommunityIcons name="heart" size={12} color={colors.textSecondary} />
              <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}> {item.likes ?? 0}</Text>
              <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>{'  '}</Text>
              <MaterialCommunityIcons name="download" size={12} color={colors.textSecondary} />
              <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}> {(item.downloads ?? 0).toLocaleString()}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.cardRows, { color: colors.textSecondary }]}>
            {item.rowEstimate}
          </Text>
        )}
      </TouchableOpacity>
    )
  }, [colors, navigateToDataset])

  const renderFooter = useCallback(() => {
    if (!hasMoreForCurrentFormat) return null
    return (
      <TouchableOpacity
        style={[styles.loadMoreBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={loadMore}
        disabled={loadingMore}>
        {loadingMore ? (
          <ActivityIndicator size="small" color={brand.yellow} />
        ) : (
          <Text style={[styles.loadMoreText, { color: brand.yellow }]}>Load More</Text>
        )}
      </TouchableOpacity>
    )
  }, [hasMoreForCurrentFormat, loadMore, loadingMore, colors, brand])

  const renderEmpty = useCallback(() => {
    if (activeTab === 'Trending' && trendingLoading) {
      return (
        <View style={styles.skeletonContainer}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
        </View>
      )
    }
    const formatLabel = selectedFormat === 'All' ? '' : ` ${selectedFormat.toLowerCase()}`
    const tabLabel = activeTab.toLowerCase()
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No {tabLabel}{formatLabel} datasets found
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
          Try entering an hf:// path for a custom dataset
        </Text>
      </View>
    )
  }, [activeTab, selectedFormat, trendingLoading, colors])

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
          placeholder="Search datasets or enter hf:// path..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Segmented Control — hidden when API failed */}
      {(hasTrendingData || trendingLoading) && (
        <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['Trending', 'Curated'] as TabType[]).map(tab => {
            const isActive = tab === activeTab
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.segmentPill,
                  isActive && { backgroundColor: brand.yellow },
                ]}
                onPress={() => setActiveTab(tab)}>
                <Text style={[
                  styles.segmentText,
                  { color: isActive ? '#1F2328' : colors.textSecondary },
                  isActive && { fontWeight: '700' },
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Format chips */}
      <View style={styles.chipRow}>
        {FORMAT_CATEGORIES.map(cat => renderFormatChip(cat))}
      </View>

      {isCustomPath && (
        <TouchableOpacity
          style={[styles.customCard, { backgroundColor: colors.surface, borderColor: brand.yellow }]}
          onPress={openCustomPath}>
          <MaterialCommunityIcons name="package-variant" size={24} color={brand.yellow} style={styles.customIcon} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.customTitle, { color: colors.text }]}>Open Custom Dataset</Text>
            <Text style={[styles.customPath, { color: colors.textSecondary }]} numberOfLines={1}>
              {debouncedSearch.trim()}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={activeTab === 'Trending' && trendingLoading ? [] : filteredData}
        renderItem={renderDataset}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
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
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 2,
  },
  segmentPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 18,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
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
  cardIcon: { marginRight: 10 },
  cardTitleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  metaIcons: { flexDirection: 'row', alignItems: 'center' },
  cardMetaText: { fontSize: 11 },
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
  customIcon: { marginRight: 10 },
  customTitle: { fontSize: 14, fontWeight: '600' },
  customPath: { fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 16,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorMsg: { fontSize: 14, textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#1F2328', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, marginTop: 8 },
  skeletonContainer: { paddingTop: 8 },
  skeletonCircle: { width: 24, height: 24, borderRadius: 12, marginRight: 10 },
  skeletonBar: { borderRadius: 4 },
})
