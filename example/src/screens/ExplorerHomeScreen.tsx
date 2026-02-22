import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTheme } from '../theme'
import type { ExplorerStackParamList } from '../navigation/types'

type NavProp = NativeStackNavigationProp<ExplorerStackParamList, 'ExplorerHome'>

interface FeatureCard {
  title: string
  icon: string
  accent: string
  description: string
  screen: keyof ExplorerStackParamList
}

const FEATURES: FeatureCard[] = [
  {
    title: 'Vector Search',
    icon: 'vector-combine',
    accent: '#7D66FF',
    description: 'Similarity search with embeddings',
    screen: 'VSSExplorer',
  },
  {
    title: 'File Queries',
    icon: 'file-document-outline',
    accent: '#FF6900',
    description: 'Query local bundled files',
    screen: 'FileQueries',
  },
  {
    title: 'Streaming Demo',
    icon: 'waves',
    accent: '#2EAFFF',
    description: 'Stream large result sets',
    screen: 'StreamingDemo',
  },
  {
    title: 'Appender Bench',
    icon: 'speedometer',
    accent: '#FF6900',
    description: 'Benchmark bulk insert performance',
    screen: 'AppenderBenchmark',
  },
  {
    title: 'Type Inspector',
    icon: 'format-list-bulleted-type',
    accent: '#7D66FF',
    description: 'Explore DuckDB type system',
    screen: 'TypeInspector',
  },
  {
    title: 'Attach Database',
    icon: 'database-plus-outline',
    accent: '#00C770',
    description: 'Attach and query multiple DBs',
    screen: 'AttachDatabase',
  },
  {
    title: 'Remote Files',
    icon: 'cloud-download-outline',
    accent: '#2EAFFF',
    description: 'Query Parquet/CSV/JSON over HTTP',
    screen: 'RemoteFiles',
  },
  {
    title: 'Full-Text Search',
    icon: 'text-search',
    accent: '#00C770',
    description: 'Search text with BM25 ranking',
    screen: 'FTSExplorer',
  },
]

const SCREEN_WIDTH = Dimensions.get('window').width
const CARD_GAP = 12
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP) / 2

export function ExplorerHomeScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<NavProp>()

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.screen}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderLeftColor: feature.accent,
                width: CARD_WIDTH,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(feature.screen)}>
            <MaterialCommunityIcons
              name={feature.icon}
              size={28}
              color={feature.accent}
              style={styles.icon}
            />
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {feature.title}
            </Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {feature.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 14,
    minHeight: 110,
  },
  icon: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
})
