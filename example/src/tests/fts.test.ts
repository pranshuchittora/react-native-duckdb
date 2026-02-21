import { Platform } from 'react-native'
import { TestRegistry } from '../testing/TestRegistry'
import { HybridDuckDB } from 'react-native-duckdb'

const books = require('../data/books.json')

// DuckDB FTS has a known bug on Android where rowid values used internally
// during index creation overflow int64, causing "Information loss on integer
// cast" errors. Root cause: fts_indexing.cpp uses `SELECT rowid AS docid`
// and Android in-memory rowids can exceed int64 max.
// Upstream: https://github.com/duckdb/duckdb-fts/issues/24
// Detect this at runtime so affected tests can skip gracefully.
let ftsIndexingWorks: boolean | null = null
function canCreateFtsIndex(): boolean {
  if (ftsIndexingWorks !== null) return ftsIndexingWorks
  if (Platform.OS !== 'android') {
    ftsIndexingWorks = true
    return true
  }
  const db = HybridDuckDB.open(':memory:', {})
  try {
    db.executeSync("LOAD 'fts'")
    db.executeSync("CREATE TABLE _fts_probe (id VARCHAR, t VARCHAR)")
    db.executeSync("INSERT INTO _fts_probe VALUES ('1', 'test')")
    db.executeSync("PRAGMA create_fts_index('_fts_probe', 'id', 't')")
    db.executeSync(
      "SELECT fts_main__fts_probe.match_bm25(id, 'test') AS s FROM _fts_probe"
    )
    ftsIndexingWorks = true
  } catch {
    ftsIndexingWorks = false
  } finally {
    db.close()
  }
  return ftsIndexingWorks
}

const SKIP_MSG = 'SKIP: FTS indexing unavailable on this platform (DuckDB rowid overflow bug on Android)'

// Test 1: Create FTS index and basic search
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Create FTS index and basic search',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE books (id VARCHAR, title VARCHAR, description VARCHAR)'
      )

      // Insert books that mention "database" with varying prominence
      const subset = books.filter(
        (b: any) =>
          b.id === 'book_01' ||
          b.id === 'book_02' ||
          b.id === 'book_03' ||
          b.id === 'book_20' ||
          b.id === 'book_31' ||
          b.id === 'book_34'
      )
      for (const b of subset) {
        db.executeSync(
          `INSERT INTO books VALUES ('${b.id}', '${b.title.replace(/'/g, "''")}', '${b.description.replace(/'/g, "''")}')`
        )
      }

      db.executeSync(
        "PRAGMA create_fts_index('books', 'id', 'title', 'description', stemmer='english')"
      )

      const result = db.executeSync(
        "SELECT *, fts_main_books.match_bm25(id, 'database') AS score FROM books WHERE score IS NOT NULL ORDER BY score DESC"
      )
      const rows = result.toRows()

      if (rows.length === 0)
        throw new Error('Expected at least one result for "database" search')

      for (const row of rows) {
        if (row.score === null || row.score === undefined)
          throw new Error(`Score should be non-NULL, got ${row.score}`)
        if (typeof row.score !== 'number')
          throw new Error(`Score should be a number, got ${typeof row.score}`)
      }

      // Verify scores are in descending order (higher = more relevant)
      for (let i = 1; i < rows.length; i++) {
        if (Number(rows[i].score) > Number(rows[i - 1].score))
          throw new Error(
            `Scores not in DESC order: ${rows[i - 1].score} then ${rows[i].score}`
          )
      }

      console.debug(
        `FTS basic: ${rows.length} results, top=${rows[0].id} score=${rows[0].score}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 2: Multi-column search: title and description
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Multi-column search: title and description',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE books (id VARCHAR, title VARCHAR, description VARCHAR)'
      )

      const subset = books.slice(0, 10)
      for (const b of subset) {
        db.executeSync(
          `INSERT INTO books VALUES ('${b.id}', '${b.title.replace(/'/g, "''")}', '${b.description.replace(/'/g, "''")}')`
        )
      }

      db.executeSync(
        "PRAGMA create_fts_index('books', 'id', 'title', 'description', stemmer='english')"
      )

      // Search with fields restricted to title only
      const titleOnly = db.executeSync(
        "SELECT *, fts_main_books.match_bm25(id, 'database', fields := 'title') AS score FROM books WHERE score IS NOT NULL ORDER BY score"
      )
      const titleRows = titleOnly.toRows()

      // Search across all indexed columns
      const allFields = db.executeSync(
        "SELECT *, fts_main_books.match_bm25(id, 'database') AS score FROM books WHERE score IS NOT NULL ORDER BY score"
      )
      const allRows = allFields.toRows()

      if (allRows.length < titleRows.length)
        throw new Error(
          `Full search (${allRows.length}) should return >= title-only (${titleRows.length}) results`
        )

      console.debug(
        `FTS multi-column: title-only=${titleRows.length}, all=${allRows.length}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 3: BM25 ranking order
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'BM25 ranking order',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE docs (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      // Row A: "database" in both title and body, multiple mentions
      db.executeSync(
        "INSERT INTO docs VALUES ('A', 'Database Design and Database Management', 'The database approach to storing data uses database systems for efficiency.')"
      )
      // Row B: "database" in body only, single mention
      db.executeSync(
        "INSERT INTO docs VALUES ('B', 'Introduction to Computing', 'This chapter covers the basics of using a database for storage.')"
      )
      // Row C: no mention of "database"
      db.executeSync(
        "INSERT INTO docs VALUES ('C', 'Cooking with Passion', 'A wonderful guide to preparing meals at home.')"
      )

      db.executeSync(
        "PRAGMA create_fts_index('docs', 'id', 'title', 'body', stemmer='english')"
      )

      const result = db.executeSync(
        "SELECT *, fts_main_docs.match_bm25(id, 'database') AS score FROM docs WHERE score IS NOT NULL ORDER BY score DESC"
      )
      const rows = result.toRows()

      if (rows.length < 2)
        throw new Error(`Expected at least 2 results, got ${rows.length}`)

      // A should rank before B (higher BM25 score = more relevant, ORDER BY DESC puts best first)
      const ids = rows.map((r: any) => r.id)
      const aIdx = ids.indexOf('A')
      const bIdx = ids.indexOf('B')
      if (aIdx === -1 || bIdx === -1)
        throw new Error(
          `Expected both A and B in results, got ids: ${ids}`
        )

      if (aIdx > bIdx)
        throw new Error(
          `A (idx=${aIdx}) should rank before B (idx=${bIdx}) — A has more "database" mentions`
        )

      // C should not appear
      const cRow = rows.find((r: any) => r.id === 'C')
      if (cRow)
        throw new Error('C should not appear in results (no "database" mention)')

      console.debug(
        `BM25 ranking: A at idx=${aIdx}, B at idx=${bIdx}, C absent ✓`
      )
    } finally {
      db.close()
    }
  }
)

// Test 4: English stemmer: stem() function
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'English stemmer: stem() function',
  async () => {
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      const r1 = db.executeSync("SELECT stem('running', 'english') AS s")
      const s1 = r1.toRows()[0].s
      if (s1 !== 'run')
        throw new Error(`Expected stem('running')='run', got '${s1}'`)

      const r2 = db.executeSync("SELECT stem('communities', 'english') AS s")
      const s2 = r2.toRows()[0].s
      if (s2 !== 'communiti')
        throw new Error(`Expected stem('communities')='communiti', got '${s2}'`)

      const r3 = db.executeSync("SELECT stem('databases', 'english') AS s")
      const s3 = r3.toRows()[0].s
      if (s3 !== 'databas')
        throw new Error(`Expected stem('databases')='databas', got '${s3}'`)

      console.debug(
        `English stemmer: running→${s1}, communities→${s2}, databases→${s3}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 5: French stemmer: stem() function and search
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'French stemmer: stem() function and search',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      const r1 = db.executeSync("SELECT stem('mangeons', 'french') AS s")
      const s1 = r1.toRows()[0].s
      if (s1 !== 'mangeon')
        throw new Error(`Expected stem('mangeons','french')='mangeon', got '${s1}'`)

      const r2 = db.executeSync("SELECT stem('mange', 'french') AS s")
      const s2 = r2.toRows()[0].s
      if (s2 !== 'mang')
        throw new Error(`Expected stem('mange','french')='mang', got '${s2}'`)

      // Create table with French content from bundled dataset
      db.executeSync(
        'CREATE TABLE livres (id VARCHAR, title VARCHAR, description VARCHAR)'
      )
      const frenchBooks = books.filter((b: any) => b.language === 'fr')
      for (const b of frenchBooks) {
        db.executeSync(
          `INSERT INTO livres VALUES ('${b.id}', '${b.title.replace(/'/g, "''")}', '${b.description.replace(/'/g, "''")}')`
        )
      }

      db.executeSync(
        "PRAGMA create_fts_index('livres', 'id', 'title', 'description', stemmer='french')"
      )

      // Search for "communauté" — should match "communautés" in book_44
      const result = db.executeSync(
        "SELECT *, fts_main_livres.match_bm25(id, 'communauté') AS score FROM livres WHERE score IS NOT NULL ORDER BY score"
      )
      const rows = result.toRows()

      if (rows.length === 0)
        throw new Error(
          'Expected French stemmer to match "communauté" against "communautés"'
        )

      console.debug(
        `French stemmer: mangeons→${s1}, mange→${s2}, search found ${rows.length} result(s)`
      )
    } finally {
      db.close()
    }
  }
)

// Test 6: Accent handling with strip_accents
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Accent handling with strip_accents',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE accents (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO accents VALUES ('1', 'Le résumé complet', 'Un résumé détaillé du projet.')"
      )
      db.executeSync(
        "INSERT INTO accents VALUES ('2', 'École nationale', 'L''école supérieure de technologie.')"
      )
      db.executeSync(
        "INSERT INTO accents VALUES ('3', 'Être ou ne pas être', 'La question fondamentale de l''existence.')"
      )

      db.executeSync(
        "PRAGMA create_fts_index('accents', 'id', 'title', 'body', stemmer='french', strip_accents=1)"
      )

      // Search unaccented "resume" should match accented "résumé"
      const r1 = db.executeSync(
        "SELECT *, fts_main_accents.match_bm25(id, 'resume') AS score FROM accents WHERE score IS NOT NULL ORDER BY score"
      )
      const rows1 = r1.toRows()
      if (rows1.length === 0)
        throw new Error(
          'strip_accents=1: unaccented "resume" should match accented "résumé"'
        )

      // Search accented form should also match
      const r2 = db.executeSync(
        "SELECT *, fts_main_accents.match_bm25(id, 'résumé') AS score FROM accents WHERE score IS NOT NULL ORDER BY score"
      )
      const rows2 = r2.toRows()
      if (rows2.length === 0)
        throw new Error(
          'strip_accents=1: accented "résumé" should also match'
        )

      console.debug(
        `Accent handling: unaccented=${rows1.length} match(es), accented=${rows2.length} match(es)`
      )
    } finally {
      db.close()
    }
  }
)

// Test 7: Unicode: special characters, emoji, CJK
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Unicode: special characters, emoji, CJK',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE unicode_test (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO unicode_test VALUES ('u1', 'Quotes & Ampersands', 'Testing \"special\" characters: (parentheses), ampersands & more.')"
      )
      db.executeSync(
        "INSERT INTO unicode_test VALUES ('u2', 'Emoji World', 'The ocean is full of life 🐙 and wonder 🌊 in every wave.')"
      )
      db.executeSync(
        "INSERT INTO unicode_test VALUES ('u3', 'CJK Content', 'This document discusses 数据库 technology and 人工智能 systems.')"
      )
      db.executeSync(
        "INSERT INTO unicode_test VALUES ('u4', 'Mixed Content', 'A regular document about technology and computing.')"
      )

      // Index creation should not crash with Unicode content
      db.executeSync(
        "PRAGMA create_fts_index('unicode_test', 'id', 'title', 'body', stemmer='english')"
      )

      // Search near special characters
      const r1 = db.executeSync(
        "SELECT *, fts_main_unicode_test.match_bm25(id, 'special') AS score FROM unicode_test WHERE score IS NOT NULL ORDER BY score"
      )
      const rows1 = r1.toRows()
      if (rows1.length === 0)
        throw new Error('Expected to find "special" near special characters')

      // Search for "technology" should match both CJK and regular rows
      const r2 = db.executeSync(
        "SELECT *, fts_main_unicode_test.match_bm25(id, 'technology') AS score FROM unicode_test WHERE score IS NOT NULL ORDER BY score"
      )
      const rows2 = r2.toRows()
      if (rows2.length < 2)
        throw new Error(
          `Expected at least 2 "technology" matches, got ${rows2.length}`
        )

      // Search for "ocean" near emoji
      const r3 = db.executeSync(
        "SELECT *, fts_main_unicode_test.match_bm25(id, 'ocean') AS score FROM unicode_test WHERE score IS NOT NULL ORDER BY score"
      )
      const rows3 = r3.toRows()
      if (rows3.length === 0)
        throw new Error('Expected to find "ocean" in emoji row')

      console.debug(
        `Unicode: special=${rows1.length}, technology=${rows2.length}, ocean/emoji=${rows3.length} ✓`
      )
    } finally {
      db.close()
    }
  }
)

// Test 8: Index drop and recreate
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Index drop and recreate',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE articles (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO articles VALUES ('a1', 'Science Today', 'Exploring new frontiers in physics and chemistry.')"
      )
      db.executeSync(
        "INSERT INTO articles VALUES ('a2', 'Tech Review', 'The latest advances in computing and software engineering.')"
      )

      db.executeSync(
        "PRAGMA create_fts_index('articles', 'id', 'title', 'body', stemmer='english')"
      )

      // Verify search works
      const r1 = db.executeSync(
        "SELECT *, fts_main_articles.match_bm25(id, 'physics') AS score FROM articles WHERE score IS NOT NULL"
      )
      if (r1.toRows().length === 0)
        throw new Error('Expected results before drop')

      // Drop the index
      db.executeSync("PRAGMA drop_fts_index('articles')")

      // Verify schema is dropped — attempt match_bm25 should fail
      let dropVerified = false
      try {
        db.executeSync(
          "SELECT fts_main_articles.match_bm25(id, 'physics') AS score FROM articles"
        )
      } catch (_e) {
        dropVerified = true
      }
      if (!dropVerified)
        throw new Error('Expected error after dropping FTS index')

      // Recreate
      db.executeSync(
        "PRAGMA create_fts_index('articles', 'id', 'title', 'body', stemmer='english')"
      )

      // Verify search works again after recreation
      const r2 = db.executeSync(
        "SELECT *, fts_main_articles.match_bm25(id, 'physics') AS score FROM articles WHERE score IS NOT NULL"
      )
      if (r2.toRows().length === 0)
        throw new Error('Expected results after recreate')

      console.debug('Index drop/recreate: drop verified, recreate works ✓')
    } finally {
      db.close()
    }
  }
)

// Test 9: Error: match_bm25 without FTS index
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Error: match_bm25 without FTS index',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE noindex (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO noindex VALUES ('1', 'Test', 'Some content here.')"
      )

      let caught = false
      let errorMsg = ''
      try {
        db.executeSync(
          "SELECT fts_main_noindex.match_bm25(id, 'test') AS score FROM noindex"
        )
      } catch (e: any) {
        caught = true
        errorMsg = String(e.message || e)
      }

      if (!caught)
        throw new Error('Expected error when calling match_bm25 without index')

      // Verify error contains helpful context
      const lower = errorMsg.toLowerCase()
      if (
        !lower.includes('fts') &&
        !lower.includes('index') &&
        !lower.includes('schema') &&
        !lower.includes('catalog') &&
        !lower.includes('not found')
      )
        throw new Error(
          `Error message lacks context about missing index: ${errorMsg}`
        )

      console.debug(
        `Error without index: caught "${errorMsg.slice(0, 100)}" ✓`
      )
    } finally {
      db.close()
    }
  }
)

// Test 10: NULL values in indexed columns
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'NULL values in indexed columns',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE nulltest (id VARCHAR, title VARCHAR, description VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO nulltest VALUES ('n1', 'Database Guide', 'A guide to databases.')"
      )
      db.executeSync(
        "INSERT INTO nulltest VALUES ('n2', NULL, 'A description without a title.')"
      )
      db.executeSync(
        "INSERT INTO nulltest VALUES ('n3', 'Untitled', NULL)"
      )
      db.executeSync(
        "INSERT INTO nulltest VALUES ('n4', NULL, NULL)"
      )
      db.executeSync(
        "INSERT INTO nulltest VALUES ('n5', 'Another Database Book', 'More about databases and SQL.')"
      )

      // Index creation should not crash with NULLs
      db.executeSync(
        "PRAGMA create_fts_index('nulltest', 'id', 'title', 'description', stemmer='english')"
      )

      const result = db.executeSync(
        "SELECT *, fts_main_nulltest.match_bm25(id, 'database') AS score FROM nulltest WHERE score IS NOT NULL ORDER BY score"
      )
      const rows = result.toRows()

      // Should find n1 and n5 (both have "database" in non-null fields)
      if (rows.length < 2)
        throw new Error(
          `Expected at least 2 results with non-null "database" fields, got ${rows.length}`
        )

      const ids = rows.map((r: any) => r.id)
      if (!ids.includes('n1') || !ids.includes('n5'))
        throw new Error(
          `Expected n1 and n5 in results, got: ${ids.join(', ')}`
        )

      console.debug(
        `NULL handling: ${rows.length} results from 5 rows (2 with NULLs skipped) ✓`
      )
    } finally {
      db.close()
    }
  }
)

// Test 11: Scale test: 1K+ rows with FTS index
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Scale test: 1K+ rows with FTS index',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        "CREATE TABLE scale_test AS SELECT 'id_' || i AS id, 'Title number ' || i || ' about topic ' || (i % 10) AS title, 'Description for book ' || i || ' covering various subjects in depth' AS desc FROM range(1200) t(i)"
      )

      const countResult = db.executeSync(
        'SELECT count(*) as cnt FROM scale_test'
      )
      const cnt = Number(countResult.toRows()[0].cnt)
      if (cnt !== 1200)
        throw new Error(`Expected 1200 rows, got ${cnt}`)

      // Time index creation
      const indexStart = Date.now()
      db.executeSync(
        "PRAGMA create_fts_index('scale_test', 'id', 'title', 'desc', stemmer='english')"
      )
      const indexElapsed = Date.now() - indexStart

      // Time a search
      const searchStart = Date.now()
      const result = db.executeSync(
        "SELECT *, fts_main_scale_test.match_bm25(id, 'book') AS score FROM scale_test WHERE score IS NOT NULL ORDER BY score LIMIT 10"
      )
      const searchElapsed = Date.now() - searchStart
      const rows = result.toRows()

      if (rows.length === 0)
        throw new Error('Expected search results from 1200-row table')

      if (indexElapsed > 10000)
        throw new Error(
          `Index creation took ${indexElapsed}ms (>10s threshold)`
        )

      console.debug(
        `Scale test: 1200 rows, index=${indexElapsed}ms, search=${searchElapsed}ms, results=${rows.length}`
      )
    } finally {
      db.close()
    }
  }
)

// Test 12: Index not auto-updating: new data not in search
TestRegistry.registerTest(
  'Full-Text Search (fts)',
  'Index not auto-updating: new data not in search',
  async () => {
    if (!canCreateFtsIndex()) { console.debug(SKIP_MSG); return }
    const db = HybridDuckDB.open(':memory:', {})
    try {
      db.executeSync("LOAD 'fts'")

      db.executeSync(
        'CREATE TABLE snapshot (id VARCHAR, title VARCHAR, body VARCHAR)'
      )
      db.executeSync(
        "INSERT INTO snapshot VALUES ('s1', 'Original Article', 'This article discusses quantum computing.')"
      )

      db.executeSync(
        "PRAGMA create_fts_index('snapshot', 'id', 'title', 'body', stemmer='english')"
      )

      // Verify initial search finds the term
      const r1 = db.executeSync(
        "SELECT *, fts_main_snapshot.match_bm25(id, 'quantum') AS score FROM snapshot WHERE score IS NOT NULL"
      )
      if (r1.toRows().length === 0)
        throw new Error('Expected to find "quantum" in initial data')

      // Insert new row with the same search term
      db.executeSync(
        "INSERT INTO snapshot VALUES ('s2', 'New Quantum Paper', 'Breakthroughs in quantum entanglement research.')"
      )

      // Search again — new row should NOT be found (static snapshot)
      const r2 = db.executeSync(
        "SELECT *, fts_main_snapshot.match_bm25(id, 'quantum') AS score FROM snapshot WHERE score IS NOT NULL"
      )
      const ids2 = r2.toRows().map((r: any) => r.id)
      if (ids2.includes('s2'))
        throw new Error(
          'New row s2 should NOT appear before index rebuild (static snapshot)'
        )

      // Drop and recreate index
      db.executeSync("PRAGMA drop_fts_index('snapshot')")
      db.executeSync(
        "PRAGMA create_fts_index('snapshot', 'id', 'title', 'body', stemmer='english')"
      )

      // Now the new row should appear
      const r3 = db.executeSync(
        "SELECT *, fts_main_snapshot.match_bm25(id, 'quantum') AS score FROM snapshot WHERE score IS NOT NULL ORDER BY score"
      )
      const ids3 = r3.toRows().map((r: any) => r.id)
      if (!ids3.includes('s2'))
        throw new Error(
          'New row s2 SHOULD appear after index rebuild'
        )

      console.debug(
        `Static snapshot: before rebuild ids=${ids2.join(',')}, after=${ids3.join(',')} ✓`
      )
    } finally {
      db.close()
    }
  }
)
