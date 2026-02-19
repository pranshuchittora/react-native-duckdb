import type { TestCase } from './types'

class TestRegistryClass {
  private categories: Map<string, TestCase[]> = new Map()

  registerTest(category: string, name: string, run: () => Promise<void>) {
    const tests = this.categories.get(category) || []
    const existing = tests.findIndex((t) => t.name === name)
    if (existing !== -1) {
      tests[existing] = { name, category, run }
    } else {
      tests.push({ name, category, run })
    }
    this.categories.set(category, tests)
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys())
  }

  getTests(category: string): TestCase[] {
    return this.categories.get(category) || []
  }

  getAllTests(): TestCase[] {
    const all: TestCase[] = []
    for (const tests of this.categories.values()) {
      all.push(...tests)
    }
    return all
  }
}

export const TestRegistry = new TestRegistryClass()
