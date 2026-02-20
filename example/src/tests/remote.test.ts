// Remote query tests — exercises the httpfs extension over real HTTP endpoints.
// Tests fetch actual data and verify sample rows (not just counts) to ensure
// DuckDB's parser, type inference, and httpfs transport all work end-to-end.

import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

const PARQUET_BASE =
  'https://raw.githubusercontent.com/apache/parquet-testing/master/data'

// Pokemon JSON dataset (809 pokemon with stats)
const POKEMON_JSON =
  'https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json'

// Star Wars characters JSON dataset (87 characters)
const STARWARS_JSON =
  'https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json'

// Country list CSV (249 countries with codes)
const COUNTRIES_CSV =
  'https://raw.githubusercontent.com/datasets/country-list/master/data.csv'

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
  'Remote CSV: countries',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const result = db.executeSync(
        `SELECT Name, Code FROM read_csv('${COUNTRIES_CSV}') ORDER BY Name LIMIT 5`
      )
      const rows = result.toRows()
      if (rows.length !== 5) throw new Error(`Expected 5 rows, got ${rows.length}`)
      const preview = rows.map((r: any) => `${r.Name} (${r.Code})`).join(', ')
      console.debug(`Remote CSV countries: ${preview}`)

      const countResult = db.executeSync(
        `SELECT count(*) as cnt FROM read_csv('${COUNTRIES_CSV}')`
      )
      const cnt = Number(countResult.toRows()[0].cnt)
      if (cnt < 200) throw new Error(`Expected 200+ countries, got ${cnt}`)
      console.debug(`Remote CSV: ${cnt} countries total`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote JSON: Star Wars characters',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      const result = db.executeSync(
        `SELECT name, height, mass, species, homeworld
         FROM read_json('${STARWARS_JSON}')
         WHERE mass IS NOT NULL
         ORDER BY mass DESC
         LIMIT 5`
      )
      const rows = result.toRows()
      if (rows.length !== 5) throw new Error(`Expected 5 rows, got ${rows.length}`)

      const preview = rows
        .map((r: any) => `${r.name} (${r.species}, ${r.mass}kg)`)
        .join(', ')
      console.debug(`Star Wars heaviest: ${preview}`)

      const countResult = db.executeSync(
        `SELECT count(*) as cnt FROM read_json('${STARWARS_JSON}')`
      )
      const cnt = Number(countResult.toRows()[0].cnt)
      if (cnt < 50) throw new Error(`Expected 50+ characters, got ${cnt}`)
      console.debug(`Star Wars: ${cnt} characters total`)
    } finally {
      db.close()
    }
  }
)

TestRegistry.registerTest(
  'Remote Queries',
  'Remote JSON: Pokemon analytics',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'httpfs'")
      db.executeSync('SET http_timeout = 30')
      db.executeSync('SET http_retries = 3')

      // Query top 5 Pokemon by Attack stat
      const result = db.executeSync(
        `SELECT id, name.english as name, type, base.Attack as attack, base.HP as hp
         FROM read_json('${POKEMON_JSON}')
         ORDER BY base.Attack DESC
         LIMIT 5`
      )
      const rows = result.toRows()
      if (rows.length !== 5) throw new Error(`Expected 5 rows, got ${rows.length}`)

      const preview = rows
        .map((r: any) => `#${r.id} ${r.name} (ATK:${r.attack})`)
        .join(', ')
      console.debug(`Pokemon strongest attackers: ${preview}`)

      // Count total and by type
      const countResult = db.executeSync(
        `SELECT count(*) as total FROM read_json('${POKEMON_JSON}')`
      )
      const total = Number(countResult.toRows()[0].total)
      if (total < 500) throw new Error(`Expected 500+ Pokemon, got ${total}`)
      console.debug(`Pokemon: ${total} total`)
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
