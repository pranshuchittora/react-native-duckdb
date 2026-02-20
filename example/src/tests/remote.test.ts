import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

const PARQUET_BASE =
  'https://raw.githubusercontent.com/apache/parquet-testing/master/data'

TestRegistry.registerTest(
  'Remote Queries',
  'Remote Parquet: plain (alltypes_plain.parquet)',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const url = `${PARQUET_BASE}/alltypes_plain.parquet`
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM '${url}'`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0, got ${cnt}`)
      console.debug(`Remote Parquet plain: ${cnt} rows from ${url}`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote Parquet: snappy compressed',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const url = `${PARQUET_BASE}/alltypes_plain.snappy.parquet`
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM '${url}'`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0, got ${cnt}`)
      console.debug(`Remote Parquet snappy: ${cnt} rows from ${url}`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote Parquet: dictionary encoded',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const url = `${PARQUET_BASE}/alltypes_dictionary.parquet`
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM '${url}'`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0, got ${cnt}`)
      console.debug(`Remote Parquet dictionary: ${cnt} rows from ${url}`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote CSV over HTTP',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const url =
        'https://raw.githubusercontent.com/datasets/country-list/master/data.csv'
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM read_csv('${url}')`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0, got ${cnt}`)
      console.debug(`Remote CSV: ${cnt} rows from ${url}`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote JSON over HTTP',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const url =
        'https://raw.githubusercontent.com/datasets/country-list/master/data.json'
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM read_json('${url}')`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0, got ${cnt}`)
      console.debug(`Remote JSON: ${cnt} rows from ${url}`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'httpfs config: timeout and retries via SET',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")

      db.executeSync('SET http_timeout = 10')
      db.executeSync('SET http_retries = 5')
      db.executeSync('SET http_retry_wait_ms = 200')
      db.executeSync('SET http_retry_backoff = 2.0')
      db.executeSync('SET http_keep_alive = true')

      // Prove custom settings don't break functionality
      const url = `${PARQUET_BASE}/alltypes_plain.parquet`
      const result = db.executeSync(
        `SELECT count(*) as cnt FROM '${url}'`
      )
      const cnt = Number(result.toRows()[0].cnt)
      if (cnt <= 0) throw new Error(`Expected rows > 0 after config, got ${cnt}`)
      console.debug(
        `httpfs config: SET statements accepted, query returned ${cnt} rows`
      )
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Network error: invalid URL returns DuckDB error',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 10')
      db.executeSync('SET http_retries = 1')

      const url = 'https://httpbin.org/status/404'
      let caught = false
      try {
        db.executeSync(`SELECT * FROM read_csv('${url}')`)
      } catch (e: any) {
        caught = true
        const msg = String(e.message || e)
        console.debug(`Network error test: caught "${msg.slice(0, 120)}"`)
        // Verify the error contains useful context (URL or HTTP status)
        if (!msg.includes('http') && !msg.includes('HTTP') && !msg.includes('404')) {
          throw new Error(`Error message lacks HTTP context: ${msg}`)
        }
      }
      if (!caught) throw new Error('Expected network error but query succeeded')
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Proxy discovery: SET http_proxy',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")

      // Exploratory: test if http_proxy setting is accepted
      let proxySupported = true
      try {
        db.executeSync("SET http_proxy = 'test'")
        db.executeSync("SET http_proxy = ''")
      } catch (e: any) {
        proxySupported = false
        console.debug(
          `Proxy config not supported on this platform: ${String(e.message || e).slice(0, 100)}`
        )
      }

      if (proxySupported) {
        console.debug('Proxy discovery: SET http_proxy accepted by DuckDB httpfs')
      }
    } finally {
      db.close()
    }
  }
)
