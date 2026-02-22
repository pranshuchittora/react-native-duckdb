import React, { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type ListRenderItem,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTheme } from '../theme'

interface Props {
  columns: string[]
  rows: any[][]
  rowCount?: number
  maxHeight?: number
}

const MIN_COL_WIDTH = 80
const MAX_COL_WIDTH = 300
const CHAR_WIDTH = 8.5
const ROW_HEIGHT = 36
const DEFAULT_MAX_HEIGHT = 400

export function ResultTable({ columns, rows, rowCount, maxHeight = DEFAULT_MAX_HEIGHT }: Props) {
  const { colors } = useTheme()

  const colWidths = useMemo(() => {
    return columns.map((col, i) => {
      let maxLen = col.length
      for (let r = 0; r < Math.min(rows.length, 50); r++) {
        const val = rows[r]?.[i]
        const len = val == null ? 4 : String(val).length
        if (len > maxLen) maxLen = len
      }
      const estimated = maxLen * CHAR_WIDTH + 24
      return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, estimated))
    })
  }, [columns, rows])

  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0)

  const renderRow: ListRenderItem<any[]> = ({ item, index }) => (
    <View
      style={[
        styles.row,
        { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceAlt },
      ]}>
      {item.map((cell, ci) => (
        <View key={ci} style={[styles.cell, { width: colWidths[ci] }]}>
          {cell == null ? (
            <Text style={[styles.cellText, styles.nullText, { color: colors.textSecondary }]}>
              NULL
            </Text>
          ) : (
            <Text style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
              {String(cell)}
            </Text>
          )}
        </View>
      ))}
    </View>
  )

  const displayCount = rows.length
  const totalCount = rowCount ?? rows.length
  const listHeight = Math.min(rows.length * ROW_HEIGHT, maxHeight)

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ width: totalWidth }}>
          <View style={[styles.headerRow, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
            {columns.map((col, i) => (
              <View key={i} style={[styles.cell, { width: colWidths[i] }]}>
                <Text style={[styles.headerText, { color: colors.text }]} numberOfLines={1}>
                  {col}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ height: listHeight, width: totalWidth }}>
            <FlashList
              data={rows}
              renderItem={renderRow}
              estimatedItemSize={ROW_HEIGHT}
              nestedScrollEnabled
            />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Showing {displayCount} of {totalCount} rows
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    minHeight: ROW_HEIGHT,
    alignItems: 'center',
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cellText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  nullText: {
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 11,
  },
})
