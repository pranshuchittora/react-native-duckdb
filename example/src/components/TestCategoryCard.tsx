import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { TestResult } from '../testing/types'
import { TestResultRow } from './TestResultRow'
import { useTheme } from '../theme'

const CATEGORY_BADGES: Record<string, { text: string; bgColor: string; bgColorDark: string; textColor: string; textColorDark: string }> = {
  'Remote Queries': { text: 'NET', bgColor: '#E3F2FD', bgColorDark: '#1565C033', textColor: '#1565C0', textColorDark: '#64B5F6' },
  'Full-Text Search (fts)': { text: 'FTS', bgColor: '#E8F5E9', bgColorDark: '#00C77033', textColor: '#2E7D32', textColorDark: '#00C770' },
  'File Queries (parquet)': { text: 'FILE', bgColor: '#E8F5E9', bgColorDark: '#2E7D3233', textColor: '#2E7D32', textColorDark: '#81C784' },
  'SQLite Scanner (sqlite_scanner)': { text: 'EXT', bgColor: '#F3E5F5', bgColorDark: '#7B1FA233', textColor: '#7B1FA2', textColorDark: '#CE93D8' },
  'Vector Operations (vss)': { text: 'VSS', bgColor: '#EDE7F6', bgColorDark: '#7D66FF33', textColor: '#4527A0', textColorDark: '#7D66FF' },
  'HNSW Index (vss)': { text: 'HNSW', bgColor: '#EDE7F6', bgColorDark: '#7D66FF33', textColor: '#4527A0', textColorDark: '#7D66FF' },
}

interface Props {
  name: string
  results: TestResult[]
  totalDurationMs?: number
  onRunCategory: () => void
  isRunning: boolean
  onExplore?: () => void
}

export function TestCategoryCard({
  name,
  results,
  totalDurationMs,
  onRunCategory,
  isRunning,
  onExplore,
}: Props) {
  const { colors, brand, isDark } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const badge = CATEGORY_BADGES[name]
  const passCount = results.filter((r) => r.status === 'pass').length
  const failCount = results.filter((r) => r.status === 'fail').length
  const total = results.length
  const hasResults = total > 0

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>{expanded ? '▼' : '▶'}</Text>
              <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={2}>{name}</Text>
              {badge && (
                <View style={[styles.badge, { backgroundColor: isDark ? badge.bgColorDark : badge.bgColor }]}>
                  <Text style={[styles.badgeText, { color: isDark ? badge.textColorDark : badge.textColor }]}>{badge.text}</Text>
                </View>
              )}
            </View>
            {hasResults && (
              <View style={styles.metaRow}>
                <View style={styles.counts}>
                  {passCount > 0 && (
                    <Text style={[styles.passCount, { color: brand.green }]}>✓{passCount}</Text>
                  )}
                  {failCount > 0 && (
                    <Text style={[styles.failCount, { color: colors.error }]}>✗{failCount}</Text>
                  )}
                  <Text style={[styles.totalCount, { color: colors.textSecondary }]}>/{total}</Text>
                </View>
                {totalDurationMs !== undefined && (
                  <Text style={[styles.duration, { color: colors.textSecondary }]}>{totalDurationMs}ms</Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.actions}>
            {onExplore && (
              <TouchableOpacity
                onPress={onExplore}
                style={[styles.exploreButton, { backgroundColor: brand.green + '22' }]}>
                <Text style={[styles.exploreButtonText, { color: brand.green }]}>Explore</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onRunCategory}
              style={[styles.runButton, { backgroundColor: brand.yellow }, isRunning && styles.runButtonDisabled]}
              disabled={isRunning}>
              <Text style={[styles.runButtonText, { color: '#1F2328' }]}>
                {isRunning ? '...' : 'Run'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.testList, { borderTopColor: colors.border }]}>
          {results.length > 0 ? (
            results.map((result) => (
              <TestResultRow key={result.name} result={result} />
            ))
          ) : (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              No results yet — tap Run to execute
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  headerContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 22,
  },
  chevron: {
    fontSize: 12,
    marginRight: 10,
  },
  categoryName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  passCount: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  failCount: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  totalCount: {
    fontSize: 13,
  },
  duration: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  runButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  runButtonDisabled: {
    opacity: 0.5,
  },
  runButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  exploreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  exploreButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  testList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noResults: {
    padding: 14,
    fontSize: 13,
    textAlign: 'center',
  },
})
