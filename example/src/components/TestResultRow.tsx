import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { TestResult } from '../testing/types'

interface Props {
  result: TestResult
}

export function TestResultRow({ result }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isPassing = result.status === 'pass'
  const isFailing = result.status === 'fail'
  const isRunning = result.status === 'running'

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}>
      <View
        style={[
          styles.row,
          isPassing && styles.passRow,
          isFailing && styles.failRow,
        ]}>
        <View style={styles.indicator}>
          <Text style={styles.indicatorText}>
            {isPassing ? '✓' : isFailing ? '✗' : isRunning ? '⟳' : '○'}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {result.name}
        </Text>
        {result.durationMs !== undefined && (
          <Text style={styles.duration}>{result.durationMs}ms</Text>
        )}
        {(result.logs.length > 0 || result.error) && (
          <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
        )}
      </View>
      {expanded && (result.logs.length > 0 || result.error) && (
        <View style={styles.logPanel}>
          {result.error && (
            <Text style={styles.errorText}>Error: {result.error}</Text>
          )}
          {result.logs.map((log, i) => (
            <Text key={i} style={styles.logText}>
              {log}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  passRow: {
    backgroundColor: '#E8F5E9',
  },
  failRow: {
    backgroundColor: '#FFEBEE',
  },
  indicator: {
    width: 24,
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  name: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  duration: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  chevron: {
    fontSize: 10,
    color: '#999',
    marginLeft: 8,
  },
  logPanel: {
    backgroundColor: '#263238',
    padding: 10,
    marginHorizontal: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  errorText: {
    color: '#FF8A80',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  logText: {
    color: '#B0BEC5',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})
