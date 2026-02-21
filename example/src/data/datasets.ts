export interface DatasetQuery {
  name: string
  sql: string
}

export interface Dataset {
  id: string
  name: string
  repo: string
  parquetPath: string
  description: string
  category: 'tabular' | 'nlp'
  icon: string
  rowEstimate: string
  sampleQueries: DatasetQuery[]
}

export const DATASET_CATEGORIES = ['All', 'Tabular', 'NLP'] as const

export const CURATED_DATASETS: Dataset[] = [
  {
    id: 'iris',
    name: 'Iris Dataset',
    repo: 'scikit-learn/iris',
    parquetPath: 'hf://datasets/scikit-learn/iris/Iris.csv',
    description: 'Classic ML dataset — flower measurements by species',
    category: 'tabular',
    icon: '🌸',
    rowEstimate: '150 rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Avg by Species', sql: "SELECT \"Species\", ROUND(AVG(\"PetalLengthCm\"), 2) as avg_petal_len, ROUND(AVG(\"PetalWidthCm\"), 2) as avg_petal_width FROM {{TABLE}} GROUP BY \"Species\"" },
      { name: 'Species Distribution', sql: "SELECT \"Species\", COUNT(*) as count FROM {{TABLE}} GROUP BY \"Species\" ORDER BY count DESC" },
    ],
  },
  {
    id: 'wine',
    name: 'Wine Quality',
    repo: 'codesignal/wine-quality',
    parquetPath: 'hf://datasets/codesignal/wine-quality/data/red-00000-of-00001.parquet',
    description: 'Red wine samples with chemical properties and quality ratings',
    category: 'tabular',
    icon: '🍷',
    rowEstimate: '~1.6K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Avg Quality by Alcohol', sql: "SELECT ROUND(alcohol) as alcohol_range, ROUND(AVG(quality), 2) as avg_quality, COUNT(*) as wines FROM {{TABLE}} GROUP BY alcohol_range ORDER BY alcohol_range" },
      { name: 'Best Wines', sql: "SELECT * FROM {{TABLE}} WHERE quality >= 7 ORDER BY quality DESC, alcohol DESC LIMIT 20" },
    ],
  },
  {
    id: 'sst2',
    name: 'SST-2 Sentiment',
    repo: 'nyu-mll/glue',
    parquetPath: 'hf://datasets/nyu-mll/glue/sst2/train-00000-of-00001.parquet',
    description: 'Stanford Sentiment Treebank — movie review sentences with positive/negative labels',
    category: 'nlp',
    icon: '😊',
    rowEstimate: '~67K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Sentiment Counts', sql: "SELECT CASE WHEN label = 1 THEN 'positive' ELSE 'negative' END as sentiment, COUNT(*) as count FROM {{TABLE}} GROUP BY label" },
      { name: 'Short Sentences', sql: "SELECT sentence, CASE WHEN label = 1 THEN 'positive' ELSE 'negative' END as sentiment, LENGTH(sentence) as len FROM {{TABLE}} WHERE LENGTH(sentence) < 50 ORDER BY len LIMIT 20" },
    ],
  },
  {
    id: 'ag_news',
    name: 'AG News',
    repo: 'fancyzhx/ag_news',
    parquetPath: 'hf://datasets/fancyzhx/ag_news/data/train-00000-of-00001.parquet',
    description: 'News articles classified into 4 categories: World, Sports, Business, Sci/Tech',
    category: 'nlp',
    icon: '📰',
    rowEstimate: '~120K rows',
    sampleQueries: [
      { name: 'Label Counts', sql: "SELECT label, COUNT(*) as count FROM {{TABLE}} GROUP BY label ORDER BY count DESC" },
      { name: 'Sample Articles', sql: "SELECT label, LEFT(text, 150) as preview FROM {{TABLE}} LIMIT 12" },
      { name: 'Longest Articles', sql: "SELECT label, LENGTH(text) as text_len, LEFT(text, 120) as preview FROM {{TABLE}} ORDER BY text_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'imdb',
    name: 'IMDB Reviews',
    repo: 'stanfordnlp/imdb',
    parquetPath: 'hf://datasets/stanfordnlp/imdb/plain_text/train-00000-of-00001.parquet',
    description: '25K movie reviews with binary sentiment labels for NLP benchmarking',
    category: 'nlp',
    icon: '🎬',
    rowEstimate: '~25K rows',
    sampleQueries: [
      { name: 'Sentiment Counts', sql: "SELECT CASE WHEN label = 1 THEN 'positive' ELSE 'negative' END as sentiment, COUNT(*) as count FROM {{TABLE}} GROUP BY label" },
      { name: 'Longest Reviews', sql: "SELECT CASE WHEN label = 1 THEN 'pos' ELSE 'neg' END as sentiment, LENGTH(text) as review_len, LEFT(text, 100) as preview FROM {{TABLE}} ORDER BY review_len DESC LIMIT 10" },
      { name: 'Short Positive', sql: "SELECT LEFT(text, 200) as review FROM {{TABLE}} WHERE label = 1 AND LENGTH(text) < 300 LIMIT 10" },
    ],
  },
  {
    id: 'gsm8k',
    name: 'GSM8K Math',
    repo: 'openai/gsm8k',
    parquetPath: 'hf://datasets/openai/gsm8k/main/train-00000-of-00001.parquet',
    description: 'Grade school math word problems requiring multi-step reasoning',
    category: 'nlp',
    icon: '🧮',
    rowEstimate: '~7.5K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT LEFT(question, 200) as question, LEFT(answer, 100) as answer FROM {{TABLE}} LIMIT 10" },
      { name: 'Row Count', sql: "SELECT COUNT(*) as total_problems FROM {{TABLE}}" },
      { name: 'Longest Problems', sql: "SELECT LENGTH(question) as q_len, LEFT(question, 150) as question FROM {{TABLE}} ORDER BY q_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'squad',
    name: 'SQuAD',
    repo: 'rajpurkar/squad',
    parquetPath: 'hf://datasets/rajpurkar/squad/plain_text/train-00000-of-00001.parquet',
    description: 'Stanford QA dataset — 87K questions on Wikipedia passages',
    category: 'nlp',
    icon: '❓',
    rowEstimate: '~87K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT title, LEFT(question, 100) as question, LEFT(context, 100) as context FROM {{TABLE}} LIMIT 10" },
      { name: 'Topics', sql: "SELECT title, COUNT(*) as questions FROM {{TABLE}} GROUP BY title ORDER BY questions DESC LIMIT 15" },
      { name: 'Short Questions', sql: "SELECT question, title FROM {{TABLE}} WHERE LENGTH(question) < 40 ORDER BY LENGTH(question) LIMIT 15" },
    ],
  },
]
