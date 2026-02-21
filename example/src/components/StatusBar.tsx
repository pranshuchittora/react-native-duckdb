import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../theme'

interface Props {
  executionTimeMs?: number
  rowCount?: number
  error?: string
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function QueryStatusBar({ executionTimeMs, rowCount, error }: Props) {
  const { colors } = useTheme()

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {executionTimeMs != null && (
        <Text style={[styles.item, { color: colors.textSecondary }]}>
          {formatTime(executionTimeMs)}
        </Text>
      )}
      {rowCount != null && (
        <Text style={[styles.item, { color: colors.textSecondary }]}>
          {rowCount} rows
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
    gap: 16,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  item: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
})
