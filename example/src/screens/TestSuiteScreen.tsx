import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { TestRegistry } from '../testing/TestRegistry'
import { TestRunner } from '../testing/TestRunner'
import type { TestResult } from '../testing/types'
import { TestCategoryCard } from '../components/TestCategoryCard'

export function TestSuiteScreen() {
  const [results, setResults] = useState<Map<string, TestResult[]>>(new Map())
  const [runningCategories, setRunningCategories] = useState<Set<string>>(new Set())
  const [isRunningAll, setIsRunningAll] = useState(false)

  const categories = useMemo(() => TestRegistry.getCategories(), [])

  const totalPass = useMemo(() => {
    let count = 0
    for (const categoryResults of results.values()) {
      count += categoryResults.filter((r) => r.status === 'pass').length
    }
    return count
  }, [results])

  const totalFail = useMemo(() => {
    let count = 0
    for (const categoryResults of results.values()) {
      count += categoryResults.filter((r) => r.status === 'fail').length
    }
    return count
  }, [results])

  const totalDuration = useMemo(() => {
    let total = 0
    for (const categoryResults of results.values()) {
      for (const r of categoryResults) {
        if (r.durationMs) total += r.durationMs
      }
    }
    return total
  }, [results])

  const runCategory = useCallback(async (category: string) => {
    setRunningCategories((prev) => new Set(prev).add(category))
    const categoryResults = await TestRunner.runCategory(category)
    setResults((prev) => {
      const next = new Map(prev)
      next.set(category, categoryResults)
      return next
    })
    setRunningCategories((prev) => {
      const next = new Set(prev)
      next.delete(category)
      return next
    })
  }, [])

  const runAll = useCallback(async () => {
    setIsRunningAll(true)
    const allResults = await TestRunner.runAll()
    setResults(allResults)
    setIsRunningAll(false)
  }, [])

  const getCategoryDuration = (category: string): number | undefined => {
    const categoryResults = results.get(category)
    if (!categoryResults || categoryResults.length === 0) return undefined
    return categoryResults.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DuckDB Test Suite</Text>
        <View style={styles.headerRight}>
          {(totalPass > 0 || totalFail > 0) && (
            <View style={styles.summary}>
              <Text style={styles.passText}>✓{totalPass}</Text>
              <Text style={styles.failText}>✗{totalFail}</Text>
              <Text style={styles.durationText}>{totalDuration}ms</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={runAll}
            style={[styles.runAllButton, isRunningAll && styles.runAllDisabled]}
            disabled={isRunningAll}>
            <Text style={styles.runAllText}>
              {isRunningAll ? 'Running...' : 'Run All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {categories.map((category) => (
          <TestCategoryCard
            key={category}
            name={category}
            results={results.get(category) || []}
            totalDurationMs={getCategoryDuration(category)}
            onRunCategory={() => runCategory(category)}
            isRunning={runningCategories.has(category) || isRunningAll}
          />
        ))}
        {categories.length === 0 && (
          <Text style={styles.emptyText}>No test categories registered</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  failText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  durationText: {
    color: '#666',
    fontSize: 12,
  },
  runAllButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  runAllDisabled: {
    backgroundColor: '#BDBDBD',
  },
  runAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
})
