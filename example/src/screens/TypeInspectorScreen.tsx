import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { HybridDuckDB } from 'react-native-duckdb'
import type { Database } from 'react-native-duckdb'
import { SQLHighlighter } from '../components/SQLHighlighter'
import { useTheme } from '../theme'

interface TypeEntry {
  name: string
  duckdbType: string
  jsType: string
  jsValue: string
  stringRepr: string
  sql: string
  notes: string
  supported: boolean
}

interface Section {
  title: string
  data: TypeEntry[]
}

const TYPE_SQL = `
CREATE TABLE type_demo AS SELECT
  1::TINYINT as tinyint_val,
  32000::SMALLINT as smallint_val,
  2147483647::INTEGER as integer_val,
  9223372036854775807::BIGINT as bigint_val,
  170141183460469231731687303715884105727::HUGEINT as hugeint_val,
  255::UTINYINT as utinyint_val,
  65535::USMALLINT as usmallint_val,
  4294967295::UINTEGER as uinteger_val,
  3.14::FLOAT as float_val,
  2.718281828459045::DOUBLE as double_val,
  12345.67::DECIMAL(10,2) as decimal_val,
  'hello world'::VARCHAR as varchar_val,
  '\\xDEADBEEF'::BLOB as blob_val,
  '10101'::BIT as bit_val,
  true::BOOLEAN as boolean_val,
  CURRENT_DATE as date_val,
  CURRENT_TIME as time_val,
  CURRENT_TIMESTAMP as timestamp_val,
  CURRENT_TIMESTAMP::TIMESTAMPTZ as timestamptz_val,
  INTERVAL '2 years 3 months 4 days' as interval_val,
  uuid() as uuid_val,
  [1, 2, 3]::INTEGER[] as list_val,
  {'name': 'duck', 'age': 5} as struct_val,
  MAP {'key1': 'value1', 'key2': 'value2'} as map_val,
  [1, 2, 3]::INTEGER[3] as array_val
`

const CATEGORIES: Record<string, string[]> = {
  Numeric: [
    'tinyint_val', 'smallint_val', 'integer_val', 'bigint_val', 'hugeint_val',
    'utinyint_val', 'usmallint_val', 'uinteger_val',
    'float_val', 'double_val', 'decimal_val',
  ],
  String: ['varchar_val', 'blob_val', 'bit_val'],
  Temporal: ['date_val', 'time_val', 'timestamp_val', 'timestamptz_val', 'interval_val'],
  Boolean: ['boolean_val'],
  Identity: ['uuid_val'],
  Nested: ['list_val', 'struct_val', 'map_val', 'array_val'],
  Advanced: ['enum_val', 'union_val'],
}

const TYPE_NOTES: Record<string, string> = {
  tinyint_val: 'Range: -128 to 127. Maps to JS number.',
  smallint_val: 'Range: -32768 to 32767. Maps to JS number.',
  integer_val: 'Range: -2^31 to 2^31-1. Maps to JS number.',
  bigint_val: 'Range: -2^63 to 2^63-1. Returned as string to avoid JS precision loss.',
  hugeint_val: '128-bit integer. Returned as string.',
  utinyint_val: 'Range: 0 to 255. Maps to JS number.',
  usmallint_val: 'Range: 0 to 65535. Maps to JS number.',
  uinteger_val: 'Range: 0 to 2^32-1. Maps to JS number.',
  float_val: '32-bit IEEE 754. Maps to JS number (some precision loss).',
  double_val: '64-bit IEEE 754. Maps to JS number directly.',
  decimal_val: 'Fixed-point. Returned as string for precision.',
  varchar_val: 'Variable-length UTF-8 string. Maps directly.',
  blob_val: 'Binary data. Returned as hex string.',
  bit_val: 'Bit string. Returned as string.',
  boolean_val: 'True/false. Maps to JS boolean.',
  date_val: 'Calendar date. Returned as ISO string.',
  time_val: 'Time of day. Returned as string.',
  timestamp_val: 'Date + time. Returned as ISO string.',
  timestamptz_val: 'Timestamp with timezone. Returned as ISO string.',
  interval_val: 'Duration. Returned as string.',
  uuid_val: 'RFC 4122 UUID. Returned as string.',
  list_val: 'Variable-length typed array. Returned as JSON string.',
  struct_val: 'Named fields. Returned as JSON string.',
  map_val: 'Key-value pairs. Returned as JSON string.',
  array_val: 'Fixed-length typed array. Returned as JSON string.',
  enum_val: 'User-defined enum. Returned as string.',
  union_val: 'Tagged union. Returned as string.',
}

export function TypeInspectorScreen() {
  const { colors, brand } = useTheme()
  const dbRef = useRef<Database | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalTypes, setTotalTypes] = useState(0)
  const [expandedType, setExpandedType] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const db = HybridDuckDB.open(':memory:', {})
        dbRef.current = db

        await db.execute('DROP TABLE IF EXISTS type_demo')
        await db.execute(TYPE_SQL)

        try {
          await db.execute("CREATE TYPE mood AS ENUM ('happy', 'sad', 'neutral')")
          await db.execute("ALTER TABLE type_demo ADD COLUMN enum_val mood DEFAULT 'happy'")
          await db.execute("UPDATE type_demo SET enum_val = 'happy'")
        } catch (_) {}

        try {
          await db.execute("ALTER TABLE type_demo ADD COLUMN union_val UNION(num INTEGER, str VARCHAR) DEFAULT 42::UNION(num INTEGER, str VARCHAR)")
          await db.execute("UPDATE type_demo SET union_val = 42::UNION(num INTEGER, str VARCHAR)")
        } catch (_) {}

        const result = await db.execute('SELECT * FROM type_demo')
        if (cancelled) return
        const rows = result.toRows()
        const row = rows[0] || {}
        const colNames = result.columnNames
        const colTypes = result.columnTypes

        const typeMap: Record<string, { type: string; value: any }> = {}
        colNames.forEach((name, i) => {
          typeMap[name] = { type: colTypes[i], value: row[name] }
        })

        const builtSections: Section[] = []
        let count = 0

        for (const [category, keys] of Object.entries(CATEGORIES)) {
          const entries: TypeEntry[] = []
          for (const key of keys) {
            const info = typeMap[key]
            if (info) {
              const jsVal = info.value
              entries.push({
                name: key.replace(/_val$/, '').toUpperCase(),
                duckdbType: info.type,
                jsType: typeof jsVal,
                jsValue: jsVal === null || jsVal === undefined ? 'null' : String(jsVal),
                stringRepr: String(jsVal),
                sql: `${jsVal === null ? 'NULL' : `...::${info.type}`}`,
                notes: TYPE_NOTES[key] || '',
                supported: true,
              })
              count++
            } else {
              entries.push({
                name: key.replace(/_val$/, '').toUpperCase(),
                duckdbType: '?',
                jsType: '?',
                jsValue: '',
                stringRepr: '',
                sql: '',
                notes: TYPE_NOTES[key] || '',
                supported: false,
              })
              count++
            }
          }
          if (entries.length > 0) {
            builtSections.push({ title: category, data: entries })
          }
        }

        setSections(builtSections)
        setTotalTypes(count)
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(String(e.message || e))
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (dbRef.current) {
        try { dbRef.current.close() } catch (_) {}
        dbRef.current = null
      }
    }
  }, [])

  const toggleExpand = useCallback((name: string) => {
    setExpandedType(prev => prev === name ? null : name)
  }, [])

  const renderItem = useCallback(({ item }: { item: TypeEntry }) => {
    const isExpanded = expandedType === item.name
    return (
      <TouchableOpacity
        style={[styles.typeRow, { backgroundColor: colors.surface }]}
        onPress={() => toggleExpand(item.name)}
        activeOpacity={0.7}>
        <View style={styles.typeHeader}>
          <View style={styles.typeNameRow}>
            <Text style={[styles.typeName, { color: brand.green }]}>{item.name}</Text>
            {!item.supported && (
              <View style={[styles.unsupportedBadge, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.unsupportedText, { color: colors.error }]}>unsupported</Text>
              </View>
            )}
          </View>
          <Text style={[styles.duckdbType, { color: colors.textSecondary }]}>
            {item.duckdbType}
          </Text>
        </View>
        {item.supported && (
          <View style={styles.valueRow}>
            <Text style={[styles.jsType, { color: colors.textSecondary }]}>
              typeof: {item.jsType}
            </Text>
            <Text style={[styles.jsValue, { color: colors.text }]} numberOfLines={1}>
              {item.jsValue.length > 60 ? item.jsValue.slice(0, 57) + '...' : item.jsValue}
            </Text>
          </View>
        )}
        {isExpanded && item.supported && (
          <View style={[styles.expandedInfo, { borderTopColor: colors.border }]}>
            <View style={[styles.sqlBox, { backgroundColor: colors.surfaceAlt }]}>
              <SQLHighlighter sql={`SELECT ${item.jsValue}::${item.duckdbType}`} />
            </View>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{item.notes}</Text>
            {item.jsValue !== item.stringRepr && (
              <Text style={[styles.roundtripText, { color: colors.textSecondary }]}>
                String repr: {item.stringRepr}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    )
  }, [expandedType, colors, brand, toggleExpand])

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: brand.green }]}>{section.title}</Text>
      <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
        {section.data.filter(d => d.supported).length} types
      </Text>
    </View>
  ), [colors, brand])

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={brand.green} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading type system...
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Type Inspector</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          DuckDB's type system in JavaScript
        </Text>
        <View style={[styles.countBadge, { backgroundColor: brand.green + '20' }]}>
          <Text style={[styles.countText, { color: brand.green }]}>
            {totalTypes} types mapped
          </Text>
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 10 },
  countBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCount: { fontSize: 12 },
  typeRow: {
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 12,
    borderRadius: 8,
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeName: { fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  duckdbType: { fontSize: 12, fontFamily: 'monospace' },
  unsupportedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  unsupportedText: { fontSize: 10, fontWeight: '600' },
  valueRow: { marginTop: 6 },
  jsType: { fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  jsValue: { fontSize: 12, fontFamily: 'monospace' },
  expandedInfo: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  sqlBox: { padding: 8, borderRadius: 6, marginBottom: 8 },
  notesText: { fontSize: 12, lineHeight: 18 },
  roundtripText: { fontSize: 11, fontFamily: 'monospace', marginTop: 6 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', padding: 20 },
})
