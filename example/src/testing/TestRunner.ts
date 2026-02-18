import type { TestCase, TestResult } from './types'
import { TestRegistry } from './TestRegistry'

export class TestRunner {
  static async runTest(test: TestCase): Promise<TestResult> {
    const logs: string[] = []
    const originalDebug = console.debug
    console.debug = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
      originalDebug(...args)
    }

    const start = performance.now()
    try {
      await test.run()
      const durationMs = Math.round(performance.now() - start)
      console.debug = originalDebug
      console.log(`[TEST PASS] ${test.name} (${durationMs}ms)`)
      return { name: test.name, status: 'pass', durationMs, logs }
    } catch (e) {
      const durationMs = Math.round(performance.now() - start)
      console.debug = originalDebug
      const error = e instanceof Error ? e.message : String(e)
      const stack = e instanceof Error ? e.stack : undefined
      console.error(`[TEST FAIL] ${test.name}: ${error}`)
      if (stack) console.error(stack)
      return { name: test.name, status: 'fail', durationMs, error, logs }
    }
  }

  static async runCategory(category: string): Promise<TestResult[]> {
    const tests = TestRegistry.getTests(category)
    const results: TestResult[] = []
    for (const test of tests) {
      results.push(await TestRunner.runTest(test))
    }
    return results
  }

  static async runAll(): Promise<Map<string, TestResult[]>> {
    const allResults = new Map<string, TestResult[]>()
    for (const category of TestRegistry.getCategories()) {
      allResults.set(category, await TestRunner.runCategory(category))
    }
    return allResults
  }
}
