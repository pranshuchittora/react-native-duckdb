export interface DatasetQuery {
  name: string
  sql: string
}

export type DatasetFormat = 'parquet' | 'csv' | 'json'

export interface Dataset {
  id: string
  name: string
  repo: string
  parquetPath: string
  description: string
  category: 'tabular' | 'nlp' | 'benchmark'
  format: DatasetFormat
  icon: string
  rowEstimate: string
  sampleQueries: DatasetQuery[]
}

export const DATASET_CATEGORIES = ['All', 'Tabular', 'NLP', 'Benchmark'] as const

export const CURATED_DATASETS: Dataset[] = [
  {
    id: 'swe_bench',
    name: 'SWE-bench Verified',
    repo: 'princeton-nlp/SWE-bench_Verified',
    parquetPath: 'hf://datasets/princeton-nlp/SWE-bench_Verified/data/test-00000-of-00001.parquet',
    description: 'Human-validated GitHub issues for evaluating automated code repair systems',
    category: 'benchmark',
    format: 'parquet',
    icon: '🐛',
    rowEstimate: '500 rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT instance_id, repo, version, difficulty FROM {{TABLE}} LIMIT 20" },
      { name: 'By Repo', sql: "SELECT repo, COUNT(*) as issues, LIST(DISTINCT difficulty) as difficulties FROM {{TABLE}} GROUP BY repo ORDER BY issues DESC LIMIT 15" },
      { name: 'By Difficulty', sql: "SELECT difficulty, COUNT(*) as count FROM {{TABLE}} GROUP BY difficulty ORDER BY count DESC" },
    ],
  },
  {
    id: 'mmlu_pro',
    name: 'MMLU-Pro',
    repo: 'TIGER-Lab/MMLU-Pro',
    parquetPath: 'hf://datasets/TIGER-Lab/MMLU-Pro/data/test-00000-of-00001.parquet',
    description: 'Challenging multi-task LLM benchmark with 12K complex questions across many disciplines',
    category: 'benchmark',
    format: 'parquet',
    icon: '🧠',
    rowEstimate: '~12K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT question_id, LEFT(question, 120) as question, answer, category FROM {{TABLE}} LIMIT 15" },
      { name: 'By Category', sql: "SELECT category, COUNT(*) as questions FROM {{TABLE}} GROUP BY category ORDER BY questions DESC" },
      { name: 'Sources', sql: "SELECT src, COUNT(*) as count FROM {{TABLE}} GROUP BY src ORDER BY count DESC LIMIT 15" },
    ],
  },
  {
    id: 'gsm8k',
    name: 'GSM8K',
    repo: 'openai/gsm8k',
    parquetPath: 'hf://datasets/openai/gsm8k/main/train-00000-of-00001.parquet',
    description: 'Grade school math word problems requiring multi-step reasoning by OpenAI',
    category: 'benchmark',
    format: 'parquet',
    icon: '🧮',
    rowEstimate: '~7.5K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT LEFT(question, 200) as question, LEFT(answer, 100) as answer FROM {{TABLE}} LIMIT 10" },
      { name: 'Row Count', sql: "SELECT COUNT(*) as total_problems FROM {{TABLE}}" },
      { name: 'Longest', sql: "SELECT LENGTH(question) as q_len, LEFT(question, 150) as question FROM {{TABLE}} ORDER BY q_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'food_facts',
    name: 'Open Food Facts',
    repo: 'openfoodfacts/product-database',
    parquetPath: 'hf://datasets/openfoodfacts/product-database/food.parquet',
    description: 'Crowdsourced database of 4M+ food products with ingredients and nutrition facts',
    category: 'tabular',
    format: 'parquet',
    icon: '🍊',
    rowEstimate: '~4.3M rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT code, product_name, brands, countries_en FROM {{TABLE}} WHERE product_name IS NOT NULL LIMIT 20" },
      { name: 'Top Brands', sql: "SELECT brands, COUNT(*) as products FROM {{TABLE}} WHERE brands IS NOT NULL AND brands != '' GROUP BY brands ORDER BY products DESC LIMIT 20" },
      { name: 'Nutrition', sql: "SELECT product_name, energy_100g, fat_100g, sugars_100g, proteins_100g FROM {{TABLE}} WHERE product_name IS NOT NULL AND energy_100g IS NOT NULL ORDER BY energy_100g DESC LIMIT 20" },
    ],
  },
  {
    id: 'wine',
    name: 'Wine Quality',
    repo: 'codesignal/wine-quality',
    parquetPath: 'hf://datasets/codesignal/wine-quality/data/red-00000-of-00001.parquet',
    description: 'Red wine samples with chemical properties and quality ratings',
    category: 'tabular',
    format: 'parquet',
    icon: '🍷',
    rowEstimate: '~1.6K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Quality by Alcohol', sql: "SELECT ROUND(alcohol) as alcohol_range, ROUND(AVG(quality), 2) as avg_quality, COUNT(*) as wines FROM {{TABLE}} GROUP BY alcohol_range ORDER BY alcohol_range" },
      { name: 'Best Wines', sql: "SELECT * FROM {{TABLE}} WHERE quality >= 7 ORDER BY quality DESC, alcohol DESC LIMIT 20" },
    ],
  },
  {
    id: 'ag_news',
    name: 'AG News',
    repo: 'fancyzhx/ag_news',
    parquetPath: 'hf://datasets/fancyzhx/ag_news/data/train-00000-of-00001.parquet',
    description: 'News articles classified into World, Sports, Business, and Sci/Tech',
    category: 'nlp',
    format: 'parquet',
    icon: '📰',
    rowEstimate: '~120K rows',
    sampleQueries: [
      { name: 'Label Counts', sql: "SELECT label, COUNT(*) as count FROM {{TABLE}} GROUP BY label ORDER BY count DESC" },
      { name: 'Samples', sql: "SELECT label, LEFT(text, 150) as preview FROM {{TABLE}} LIMIT 12" },
      { name: 'Longest', sql: "SELECT label, LENGTH(text) as text_len, LEFT(text, 120) as preview FROM {{TABLE}} ORDER BY text_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'imdb',
    name: 'IMDB Reviews',
    repo: 'stanfordnlp/imdb',
    parquetPath: 'hf://datasets/stanfordnlp/imdb/plain_text/train-00000-of-00001.parquet',
    description: '25K movie reviews with binary sentiment labels for NLP benchmarking',
    category: 'nlp',
    format: 'parquet',
    icon: '🎬',
    rowEstimate: '~25K rows',
    sampleQueries: [
      { name: 'Sentiment', sql: "SELECT CASE WHEN label = 1 THEN 'positive' ELSE 'negative' END as sentiment, COUNT(*) as count FROM {{TABLE}} GROUP BY label" },
      { name: 'Longest', sql: "SELECT CASE WHEN label = 1 THEN 'pos' ELSE 'neg' END as sentiment, LENGTH(text) as len, LEFT(text, 100) as preview FROM {{TABLE}} ORDER BY len DESC LIMIT 10" },
      { name: 'Short Positive', sql: "SELECT LEFT(text, 200) as review FROM {{TABLE}} WHERE label = 1 AND LENGTH(text) < 300 LIMIT 10" },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify Tracks',
    repo: 'maharshipandya/spotify-tracks-dataset',
    parquetPath: 'hf://datasets/maharshipandya/spotify-tracks-dataset/dataset.csv',
    description: '114K Spotify tracks with audio features: danceability, energy, tempo, and more',
    category: 'tabular',
    format: 'csv',
    icon: '🎵',
    rowEstimate: '~114K rows',
    sampleQueries: [
      { name: 'Most Popular', sql: "SELECT track_name, artists, popularity FROM {{TABLE}} ORDER BY popularity DESC LIMIT 20" },
      { name: 'Avg Features', sql: "SELECT ROUND(AVG(danceability), 3) as avg_dance, ROUND(AVG(energy), 3) as avg_energy, ROUND(AVG(tempo), 1) as avg_tempo FROM {{TABLE}}" },
      { name: 'Dance Hits', sql: "SELECT track_name, artists, danceability, energy, tempo FROM {{TABLE}} WHERE danceability > 0.8 AND energy > 0.8 ORDER BY popularity DESC LIMIT 20" },
    ],
  },
  {
    id: 'chatgpt_prompts',
    name: 'ChatGPT Prompts',
    repo: 'fka/prompts.chat',
    parquetPath: 'hf://datasets/fka/prompts.chat/prompts.csv',
    description: 'Community-curated collection of creative AI prompts from prompts.chat',
    category: 'nlp',
    format: 'csv',
    icon: '💬',
    rowEstimate: '~1.3K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Row Count', sql: "SELECT COUNT(*) as total_prompts FROM {{TABLE}}" },
      { name: 'Longest', sql: "SELECT LENGTH(prompt) as len, LEFT(prompt, 150) as preview FROM {{TABLE}} ORDER BY len DESC LIMIT 10" },
    ],
  },
  {
    id: 'iris',
    name: 'Iris Dataset',
    repo: 'scikit-learn/iris',
    parquetPath: 'hf://datasets/scikit-learn/iris/Iris.csv',
    description: 'Classic ML dataset — flower measurements by species',
    category: 'tabular',
    format: 'csv',
    icon: '🌸',
    rowEstimate: '150 rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Avg by Species', sql: "SELECT \"Species\", ROUND(AVG(\"PetalLengthCm\"), 2) as avg_petal_len, ROUND(AVG(\"PetalWidthCm\"), 2) as avg_petal_width FROM {{TABLE}} GROUP BY \"Species\"" },
      { name: 'Distribution', sql: "SELECT \"Species\", COUNT(*) as count FROM {{TABLE}} GROUP BY \"Species\" ORDER BY count DESC" },
    ],
  },
  {
    id: 'dolly',
    name: 'Databricks Dolly',
    repo: 'databricks/databricks-dolly-15k',
    parquetPath: 'hf://datasets/databricks/databricks-dolly-15k/databricks-dolly-15k.jsonl',
    description: '15K instruction-following records generated by Databricks employees',
    category: 'nlp',
    format: 'json',
    icon: '🤖',
    rowEstimate: '~15K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT category, LEFT(instruction, 120) as instruction, LEFT(response, 80) as response FROM {{TABLE}} LIMIT 15" },
      { name: 'By Category', sql: "SELECT category, COUNT(*) as count FROM {{TABLE}} GROUP BY category ORDER BY count DESC" },
      { name: 'With Context', sql: "SELECT category, LEFT(instruction, 100) as instruction, LEFT(context, 80) as context FROM {{TABLE}} WHERE context IS NOT NULL AND context != '' LIMIT 15" },
    ],
  },
]
