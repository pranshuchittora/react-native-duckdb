import type { Database } from './specs/Database.nitro'
import type { Appender } from './specs/Appender.nitro'
import type { AppenderOptions } from './types'
import { DuckDBError } from './DuckDBError'

export async function withAppender<T>(
  db: Database,
  table: string,
  callback: (appender: Appender) => T | Promise<T>,
  options?: AppenderOptions
): Promise<T> {
  const appender = db.createAppender(table, options)
  try {
    const result = await callback(appender)
    appender.close()
    return result
  } catch (error) {
    try {
      appender.close()
    } catch {
      // ignore close errors — don't mask original
    }
    throw DuckDBError.fromError(error)
  }
}
