import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { TestRegistry } from '../testing/TestRegistry'
import { TestRunner } from '../testing/TestRunner'
import type { TestResult } from '../testing/types'
import { TestCategoryCard } from '../components/TestCategoryCard'
import { useTheme } from '../theme'

const BENCHMARK_CATEGORY = 'Benchmarks'

export function TestsScreen() {
  const { colors, brand } = useTheme()
  const [results, setResults] = useState<Map<string, TestResult[]>>(new Map())
  const [runningCategories, setRunningCategories] = useState<Set<string>>(new Set())
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false)

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
    const allResults = new Map<string, TestResult[]>()
    for (const category of TestRegistry.getCategories()) {
      if (!includeBenchmarks && category === BENCHMARK_CATEGORY) continue
      allResults.set(category, await TestRunner.runCategory(category))
      setResults(new Map(allResults))
    }
    setResults(allResults)
    setIsRunningAll(false)
  }, [includeBenchmarks])

  const getCategoryDuration = (category: string): number | undefined => {
    const categoryResults = results.get(category)
    if (!categoryResults || categoryResults.length === 0) return undefined
    return categoryResults.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  }

  const hasResults = totalPass > 0 || totalFail > 0

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]}>Test Suite</Text>
          <TouchableOpacity
            onPress={runAll}
            style={[styles.runAllButton, { backgroundColor: brand.yellow }, isRunningAll && styles.runAllDisabled]}
            disabled={isRunningAll}>
            <Text style={[styles.runAllText, { color: '#1F2328' }]}>
              {isRunningAll ? 'Running...' : 'Run All'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.benchmarkToggle}>
            <Switch
              value={includeBenchmarks}
              onValueChange={setIncludeBenchmarks}
              trackColor={{ false: colors.border, true: brand.yellow }}
              thumbColor="#fff"
              style={styles.switch}
            />
            <Text style={[styles.benchmarkLabel, { color: colors.textSecondary }]}>Benchmarks</Text>
          </View>
          {hasResults && (
            <View style={styles.summary}>
              <Text style={[styles.passText, { color: brand.green }]}>{totalPass} passed</Text>
              <Text style={[styles.failText, { color: colors.error }]}>{totalFail} failed</Text>
              <Text style={[styles.durationText, { color: colors.textSecondary }]}>{totalDuration}ms</Text>
            </View>
          )}
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
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No test categories registered</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  benchmarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switch: {
    transform: [{ scale: 0.8 }],
  },
  benchmarkLabel: {
    fontSize: 13,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passText: {
    fontSize: 13,
    fontWeight: '600',
  },
  failText: {
    fontSize: 13,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 12,
  },
  runAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  runAllDisabled: {
    opacity: 0.5,
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
    fontSize: 16,
    marginTop: 40,
  },
})
