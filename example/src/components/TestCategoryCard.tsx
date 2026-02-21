import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { TestResult } from '../testing/types'
import { TestResultRow } from './TestResultRow'

const CATEGORY_BADGES: Record<string, { text: string; bgColor: string; textColor: string }> = {
  'Remote Queries': { text: 'NET', bgColor: '#E3F2FD', textColor: '#1565C0' },
  'Full-Text Search (fts)': { text: 'FTS', bgColor: '#FFF3E0', textColor: '#E65100' },
  'File Queries (parquet)': { text: 'FILE', bgColor: '#E8F5E9', textColor: '#2E7D32' },
  'SQLite Scanner (sqlite_scanner)': { text: 'EXT', bgColor: '#F3E5F5', textColor: '#7B1FA2' },
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
  const [expanded, setExpanded] = useState(false)
  const badge = CATEGORY_BADGES[name]
  const passCount = results.filter((r) => r.status === 'pass').length
  const failCount = results.filter((r) => r.status === 'fail').length
  const total = results.length
  const hasResults = total > 0

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.header}>
          <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
          <Text style={styles.categoryName}>{name}</Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.bgColor }]}>
              <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.text}</Text>
            </View>
          )}
          {hasResults && (
            <View style={styles.counts}>
              {passCount > 0 && (
                <Text style={styles.passCount}>✓{passCount}</Text>
              )}
              {failCount > 0 && (
                <Text style={styles.failCount}>✗{failCount}</Text>
              )}
              <Text style={styles.totalCount}>/{total}</Text>
            </View>
          )}
          {totalDurationMs !== undefined && (
            <Text style={styles.duration}>{totalDurationMs}ms</Text>
          )}
          {onExplore && (
            <TouchableOpacity
              onPress={onExplore}
              style={styles.exploreButton}>
              <Text style={styles.exploreButtonText}>Explore</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onRunCategory}
            style={[styles.runButton, isRunning && styles.runButtonDisabled]}
            disabled={isRunning}>
            <Text style={styles.runButtonText}>
              {isRunning ? '...' : 'Run'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.testList}>
          {results.length > 0 ? (
            results.map((result) => (
              <TestResultRow key={result.name} result={result} />
            ))
          ) : (
            <Text style={styles.noResults}>
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
    backgroundColor: '#fff',
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
  chevron: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  passCount: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  failCount: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  totalCount: {
    color: '#999',
    fontSize: 13,
  },
  duration: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  runButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  runButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  runButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  exploreButton: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  exploreButtonText: {
    color: '#E65100',
    fontSize: 13,
    fontWeight: '600',
  },
  testList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
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
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
})
