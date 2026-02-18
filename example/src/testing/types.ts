export type TestStatus = 'idle' | 'running' | 'pass' | 'fail'

export interface TestCase {
  name: string
  category: string
  run: () => Promise<void>
}

export interface TestResult {
  name: string
  status: TestStatus
  durationMs?: number
  error?: string
  logs: string[]
}

export interface TestCategory {
  name: string
  tests: TestCase[]
  results: Map<string, TestResult>
  totalDurationMs?: number
}
