import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  type ListRenderItem,
} from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { HybridDuckDB } from 'react-native-duckdb'
import { useTheme } from '../theme'
import { initQueryStore, getHistory, type HistoryEntry } from '../db/queryStore'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { QueryStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<QueryStackParamList, 'QueryHistory'>

function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp.replace(' ', 'T') + 'Z').getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function formatMs(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function QueryHistoryScreen({ navigation }: Props) {
  const { colors, brand } = useTheme()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const storeDbRef = useRef<ReturnType<typeof HybridDuckDB.open> | null>(null)

  useEffect(() => {
    const db = HybridDuckDB.open('query_store.duckdb', {})
    storeDbRef.current = db
    try {
      initQueryStore(db)
      setHistory(getHistory(db))
    } catch {}
    return () => db.close()
  }, [])

  const renderItem: ListRenderItem<HistoryEntry> = ({ item, index }) => {
    const hasError = !!item.error
    return (
      <TouchableOpacity
        style={[
          styles.item,
          {
            backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceAlt,
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => navigation.navigate('QueryRunner', { prefillSql: item.sql })}>
        <View style={styles.itemTop}>
          <Text
            style={[styles.sqlText, { color: colors.text }]}
            numberOfLines={2}>
            {item.sql}
          </Text>
          {hasError && (
            <View style={styles.errorDot}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={colors.error} />
            </View>
          )}
        </View>
        <View style={styles.itemBottom}>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {relativeTime(item.created_at)}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialCommunityIcons name="timer-outline" size={11} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {formatMs(item.execution_time_ms)}
              </Text>
            </View>
            {item.row_count != null && !hasError && (
              <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="table-row" size={11} color={colors.textSecondary} />
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {item.row_count} rows
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {history.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="history" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No queries yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Run your first query!
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sqlText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  errorDot: {
    marginLeft: 8,
    marginTop: 2,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timestamp: {
    fontSize: 11,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
  },
})
