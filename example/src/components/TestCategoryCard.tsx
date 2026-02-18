import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { TestResult } from '../testing/types'
import { TestResultRow } from './TestResultRow'

interface Props {
  name: string
  results: TestResult[]
  totalDurationMs?: number
  onRunCategory: () => void
  isRunning: boolean
}

export function TestCategoryCard({
  name,
  results,
  totalDurationMs,
  onRunCategory,
  isRunning,
}: Props) {
  const [expanded, setExpanded] = useState(false)
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
  testList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  noResults: {
    padding: 14,
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
})
