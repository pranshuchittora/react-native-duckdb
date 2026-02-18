export class DuckDBError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DuckDBError'
    Object.setPrototypeOf(this, DuckDBError.prototype)
  }

  static fromError(error: unknown): DuckDBError {
    if (error instanceof DuckDBError) return error
    if (error instanceof Error) {
      const e = new DuckDBError(error.message, { cause: error.cause })
      if (error.stack) e.stack = error.stack
      return e
    }
    if (typeof error === 'string') return new DuckDBError(error)
    return new DuckDBError('Unknown DuckDB error', { cause: error })
  }
}
