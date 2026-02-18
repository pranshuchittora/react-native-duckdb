import type { Database } from './specs/Database.nitro'
import type { QueryResult } from './specs/QueryResult.nitro'
import type { PreparedStatement } from './specs/PreparedStatement.nitro'
import type {
  DuckDBValue,
  BatchCommand,
  BatchResult,
  AttachOptions,
  CloseOptions,
  ConnectionInfo,
} from './types'
import { DuckDBError } from './DuckDBError'

export type TransactionInfo = {
  statementsExecuted: number
  rolledBack: boolean
  depth: number
}

export type TransactionContext = {
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>
}

export interface WrappedDatabase {
  readonly isOpen: boolean
  close(options?: CloseOptions): void
  executeSync(sql: string, params?: DuckDBValue[]): QueryResult
  execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult>
  prepare(sql: string): PreparedStatement
  connect(): WrappedDatabase
  connections(): ConnectionInfo
  closeConnections(): void
  attach(path: string, alias: string, options?: AttachOptions): void
  detach(alias: string): void
  executeBatchSync(commands: BatchCommand[]): BatchResult
  executeBatch(commands: BatchCommand[]): Promise<BatchResult>
  transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>
  ): Promise<T>
}

function createTransactionContext(
  conn: Database,
  depth: number,
  counter: { value: number }
): TransactionContext {
  const trackedStatements: PreparedStatement[] = []

  const ctx: TransactionContext = {
    executeSync(sql: string, params?: DuckDBValue[]): QueryResult {
      counter.value++
      return conn.executeSync(sql, params)
    },

    async execute(sql: string, params?: DuckDBValue[]): Promise<QueryResult> {
      counter.value++
      return conn.execute(sql, params)
    },

    prepare(sql: string): PreparedStatement {
      counter.value++
      const stmt = conn.prepare(sql)
      trackedStatements.push(stmt)
      return stmt
    },

    async transaction<T>(
      callback: (tx: TransactionContext) => Promise<T>
    ): Promise<T> {
      return executeNestedTransaction(conn, depth + 1, counter, callback)
    },
  }

  return ctx
}

function cleanupStatements(statements: PreparedStatement[]): void {
  for (const stmt of statements) {
    try {
      stmt.finalize()
    } catch {
      // ignore — don't mask the original error
    }
  }
}

async function executeNestedTransaction<T>(
  conn: Database,
  depth: number,
  counter: { value: number },
  callback: (tx: TransactionContext) => Promise<T>
): Promise<T> {
  const savepointName = `sp_${depth}_${Date.now()}`
  conn.executeSync(`SAVEPOINT ${savepointName}`)

  const trackedStatements: PreparedStatement[] = []
  const ctx = createTransactionContext(conn, depth, counter)
  // intercept prepare to track at this nesting level too
  const originalPrepare = ctx.prepare
  ctx.prepare = (sql: string): PreparedStatement => {
    const stmt = originalPrepare(sql)
    trackedStatements.push(stmt)
    return stmt
  }

  try {
    const result = await callback(ctx)
    conn.executeSync(`RELEASE SAVEPOINT ${savepointName}`)
    return result
  } catch (error) {
    try {
      conn.executeSync(`ROLLBACK TO SAVEPOINT ${savepointName}`)
    } catch {
      // rollback failed — still rethrow original
    }

    const duckErr = DuckDBError.fromError(error)
    duckErr.transaction = {
      statementsExecuted: counter.value,
      rolledBack: true,
      depth,
    }
    throw duckErr
  } finally {
    cleanupStatements(trackedStatements)
  }
}

export async function executeTransaction<T>(
  db: Database,
  callback: (tx: TransactionContext) => Promise<T>
): Promise<T> {
  const conn = db.connect()
  const counter = { value: 0 }
  const trackedStatements: PreparedStatement[] = []

  conn.executeSync('BEGIN TRANSACTION')

  const ctx = createTransactionContext(conn, 0, counter)
  // intercept prepare to track at top level
  const originalPrepare = ctx.prepare
  ctx.prepare = (sql: string): PreparedStatement => {
    const stmt = originalPrepare(sql)
    trackedStatements.push(stmt)
    return stmt
  }

  try {
    const result = await callback(ctx)
    conn.executeSync('COMMIT')
    return result
  } catch (error) {
    try {
      conn.executeSync('ROLLBACK')
    } catch {
      // rollback failed — still rethrow original
    }

    const duckErr = DuckDBError.fromError(error)
    duckErr.transaction = {
      statementsExecuted: counter.value,
      rolledBack: true,
      depth: 0,
    }
    throw duckErr
  } finally {
    cleanupStatements(trackedStatements)
    try {
      conn.close()
    } catch {
      // connection cleanup — don't mask errors
    }
  }
}

export function createWrappedDatabase(db: Database): WrappedDatabase {
  return {
    get isOpen() {
      return db.isOpen
    },
    close(options?: CloseOptions) {
      return db.close(options)
    },
    executeSync(sql: string, params?: DuckDBValue[]) {
      return db.executeSync(sql, params)
    },
    execute(sql: string, params?: DuckDBValue[]) {
      return db.execute(sql, params)
    },
    prepare(sql: string) {
      return db.prepare(sql)
    },
    connect() {
      return createWrappedDatabase(db.connect())
    },
    connections() {
      return db.connections()
    },
    closeConnections() {
      return db.closeConnections()
    },
    attach(path: string, alias: string, options?: AttachOptions) {
      return db.attach(path, alias, options)
    },
    detach(alias: string) {
      return db.detach(alias)
    },
    executeBatchSync(commands: BatchCommand[]) {
      return db.executeBatchSync(commands)
    },
    executeBatch(commands: BatchCommand[]) {
      return db.executeBatch(commands)
    },
    transaction<T>(
      callback: (tx: TransactionContext) => Promise<T>
    ): Promise<T> {
      return executeTransaction(db, callback)
    },
  }
}
