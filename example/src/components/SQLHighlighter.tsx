import React, { useMemo } from 'react'
import { Text, StyleSheet } from 'react-native'
import { useTheme } from '../theme'

interface Props {
  sql: string
}

type TokenType = 'keyword' | 'string' | 'number' | 'function' | 'comment' | 'operator' | 'text'

interface Token {
  type: TokenType
  value: string
}

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
  'ALTER', 'JOIN', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ORDER',
  'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'WITH', 'DISTINCT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IS', 'NULL', 'TRUE', 'FALSE',
  'BETWEEN', 'EXISTS', 'SET', 'VALUES', 'INTO', 'TABLE', 'INDEX', 'VIEW',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT',
  'CHECK', 'UNIQUE', 'CASCADE', 'LOAD', 'INSTALL', 'DESCRIBE', 'EXPLAIN',
  'COPY', 'EXPORT', 'IMPORT', 'BEGIN', 'COMMIT', 'ROLLBACK', 'GRANT',
  'REVOKE', 'PRAGMA', 'ATTACH', 'DETACH', 'LEFT', 'RIGHT', 'INNER',
  'OUTER', 'CROSS', 'NATURAL', 'FULL', 'ASC', 'DESC', 'ALL', 'ANY',
  'SOME', 'TOP', 'RECURSIVE', 'IF', 'REPLACE', 'TEMPORARY', 'TEMP',
  'TYPE', 'USING', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'PRECEDING',
  'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW',
])

const OPERATOR_CHARS = new Set(['=', '<', '>', '+', '-', '*', '/', '|', '!'])

function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < sql.length) {
    // Single-line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const commentEnd = end === -1 ? sql.length : end
      tokens.push({ type: 'comment', value: sql.slice(i, commentEnd) })
      i = commentEnd
      continue
    }

    // Block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const commentEnd = end === -1 ? sql.length : end + 2
      tokens.push({ type: 'comment', value: sql.slice(i, commentEnd) })
      i = commentEnd
      continue
    }

    // String literal
    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue }
        if (sql[j] === "'") { j++; break }
        j++
      }
      tokens.push({ type: 'string', value: sql.slice(i, j) })
      i = j
      continue
    }

    // Number
    if (/\d/.test(sql[i]) || (sql[i] === '.' && i + 1 < sql.length && /\d/.test(sql[i + 1]))) {
      let j = i
      while (j < sql.length && /[\d.eE]/.test(sql[j])) j++
      tokens.push({ type: 'number', value: sql.slice(i, j) })
      i = j
      continue
    }

    // Operator
    if (OPERATOR_CHARS.has(sql[i])) {
      let j = i
      while (j < sql.length && OPERATOR_CHARS.has(sql[j])) j++
      tokens.push({ type: 'operator', value: sql.slice(i, j) })
      i = j
      continue
    }

    // Word (keyword, function, or identifier)
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++
      const word = sql.slice(i, j)

      // Check if function (word followed by open paren)
      let k = j
      while (k < sql.length && sql[k] === ' ') k++
      if (k < sql.length && sql[k] === '(') {
        tokens.push({ type: 'function', value: word })
      } else if (SQL_KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ type: 'keyword', value: word })
      } else {
        tokens.push({ type: 'text', value: word })
      }
      i = j
      continue
    }

    // Whitespace and other characters
    let j = i
    while (j < sql.length && !/[a-zA-Z_\d'"=<>+\-*/|!.]/.test(sql[j]) && sql[j] !== '-' && sql[j] !== '/') j++
    if (j === i) j++
    tokens.push({ type: 'text', value: sql.slice(i, j) })
    i = j
  }

  return tokens
}

export function SQLHighlighter({ sql }: Props) {
  const { syntax, colors } = useTheme()

  const tokens = useMemo(() => tokenize(sql), [sql])

  const colorMap: Record<TokenType, string> = {
    keyword: syntax.keyword,
    string: syntax.string,
    number: syntax.number,
    function: syntax.function,
    comment: syntax.comment,
    operator: syntax.operator,
    text: colors.text,
  }

  return (
    <Text style={[styles.container, { color: colors.text }]}>
      {tokens.map((token, i) => (
        <Text key={i} style={{ color: colorMap[token.type] }}>
          {token.value}
        </Text>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  container: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
})
