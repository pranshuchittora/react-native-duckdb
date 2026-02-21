import type { HybridDuckDB } from 'react-native-duckdb'

type DB = ReturnType<typeof HybridDuckDB.open>

export interface HistoryEntry {
  id: number
  sql: string
  execution_time_ms: number | null
  row_count: number | null
  error: string | null
  created_at: string
}

export interface SavedQuery {
  id: number
  name: string
  sql: string
  created_at: string
}

export function initQueryStore(db: DB) {
  db.executeSync("CREATE SEQUENCE IF NOT EXISTS _qh_seq START 1")
  db.executeSync("CREATE SEQUENCE IF NOT EXISTS _sq_seq START 1")
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS _query_history (
      id INTEGER PRIMARY KEY DEFAULT nextval('_qh_seq'),
      sql TEXT NOT NULL,
      execution_time_ms INTEGER,
      row_count INTEGER,
      error TEXT,
      created_at TIMESTAMP DEFAULT current_timestamp
    )
  `)
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS _saved_queries (
      id INTEGER PRIMARY KEY DEFAULT nextval('_sq_seq'),
      name TEXT NOT NULL,
      sql TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT current_timestamp
    )
  `)
}

export function saveToHistory(
  db: DB,
  sql: string,
  timeMs: number,
  rows: number,
  error?: string,
) {
  const escapedSql = sql.replace(/'/g, "''")
  const errorVal = error ? `'${error.replace(/'/g, "''")}'` : 'NULL'
  db.executeSync(
    `INSERT INTO _query_history (sql, execution_time_ms, row_count, error)
     VALUES ('${escapedSql}', ${timeMs}, ${rows}, ${errorVal})`,
  )
}

export function getHistory(db: DB, limit = 100): HistoryEntry[] {
  const result = db.executeSync(
    `SELECT id, sql, execution_time_ms, row_count, error,
            created_at::VARCHAR as created_at
     FROM _query_history ORDER BY created_at DESC LIMIT ${limit}`,
  )
  return result.toRows() as unknown as HistoryEntry[]
}

export function saveQuery(db: DB, name: string, sql: string) {
  const escapedName = name.replace(/'/g, "''")
  const escapedSql = sql.replace(/'/g, "''")
  db.executeSync(
    `INSERT INTO _saved_queries (name, sql)
     VALUES ('${escapedName}', '${escapedSql}')`,
  )
}

export function getSavedQueries(db: DB): SavedQuery[] {
  const result = db.executeSync(
    `SELECT id, name, sql, created_at::VARCHAR as created_at
     FROM _saved_queries ORDER BY created_at DESC`,
  )
  return result.toRows() as unknown as SavedQuery[]
}

export function deleteSavedQuery(db: DB, id: number) {
  db.executeSync(`DELETE FROM _saved_queries WHERE id = ${id}`)
}
