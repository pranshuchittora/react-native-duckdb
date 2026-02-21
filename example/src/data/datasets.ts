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
  category: 'tabular' | 'nlp' | 'embeddings' | 'geospatial'
  icon: string
  rowEstimate: string
  sampleQueries: DatasetQuery[]
}

export const DATASET_CATEGORIES = ['All', 'Tabular', 'NLP', 'Embeddings', 'Geospatial'] as const

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
    parquetPath: 'hf://datasets/codesignal/wine-quality/data/red-train.parquet',
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
    id: 'spotify',
    name: 'Spotify Tracks',
    repo: 'maharshipandya/spotify-tracks-dataset',
    parquetPath: 'hf://datasets/maharshipandya/spotify-tracks-dataset/data/train-00000-of-00001.parquet',
    description: 'Spotify tracks with audio features: danceability, energy, tempo, and more',
    category: 'tabular',
    icon: '🎵',
    rowEstimate: '~114K rows',
    sampleQueries: [
      { name: 'Most Popular', sql: "SELECT track_name, artists, popularity FROM {{TABLE}} ORDER BY popularity DESC LIMIT 20" },
      { name: 'Avg Features', sql: "SELECT ROUND(AVG(danceability), 3) as avg_dance, ROUND(AVG(energy), 3) as avg_energy, ROUND(AVG(tempo), 1) as avg_tempo FROM {{TABLE}}" },
      { name: 'High Energy Dance', sql: "SELECT track_name, artists, danceability, energy, tempo FROM {{TABLE}} WHERE danceability > 0.8 AND energy > 0.8 ORDER BY popularity DESC LIMIT 20" },
    ],
  },
  {
    id: 'data_jobs',
    name: 'Data Jobs',
    repo: 'lukebarousse/data_jobs',
    parquetPath: 'hf://datasets/lukebarousse/data_jobs/data/train-00000-of-00001.parquet',
    description: 'Data science job postings with skills, salaries, and locations',
    category: 'tabular',
    icon: '💼',
    rowEstimate: '~785K rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Top Job Titles', sql: "SELECT job_title_short, COUNT(*) as count FROM {{TABLE}} GROUP BY job_title_short ORDER BY count DESC LIMIT 15" },
      { name: 'Avg Salary', sql: "SELECT job_title_short, ROUND(AVG(salary_year_avg)) as avg_salary, COUNT(*) as jobs FROM {{TABLE}} WHERE salary_year_avg IS NOT NULL GROUP BY job_title_short ORDER BY avg_salary DESC LIMIT 15" },
    ],
  },
  {
    id: 'imdb',
    name: 'IMDB Reviews',
    repo: 'ajaykarthick/imdb-movie-reviews',
    parquetPath: 'hf://datasets/ajaykarthick/imdb-movie-reviews/data/train-00000-of-00001.parquet',
    description: 'Movie reviews with sentiment labels for NLP tasks',
    category: 'nlp',
    icon: '🎬',
    rowEstimate: '~40K rows',
    sampleQueries: [
      { name: 'Sentiment Counts', sql: "SELECT sentiment, COUNT(*) as count FROM {{TABLE}} GROUP BY sentiment" },
      { name: 'Longest Reviews', sql: "SELECT sentiment, LENGTH(review) as review_len, LEFT(review, 100) as preview FROM {{TABLE}} ORDER BY review_len DESC LIMIT 10" },
      { name: 'Short Positive', sql: "SELECT LEFT(review, 200) as review, sentiment FROM {{TABLE}} WHERE sentiment = 'Positive' AND LENGTH(review) < 300 LIMIT 10" },
    ],
  },
  {
    id: 'ag_news',
    name: 'AG News',
    repo: 'fancyzhx/ag_news',
    parquetPath: 'hf://datasets/fancyzhx/ag_news/data/train-00000-of-00008.parquet',
    description: 'News articles classified into 4 categories: World, Sports, Business, Sci/Tech',
    category: 'nlp',
    icon: '📰',
    rowEstimate: '~15K rows (shard 1/8)',
    sampleQueries: [
      { name: 'Articles per Label', sql: "SELECT label, COUNT(*) as count FROM {{TABLE}} GROUP BY label ORDER BY count DESC" },
      { name: 'Sample Articles', sql: "SELECT label, LEFT(text, 150) as preview FROM {{TABLE}} LIMIT 12" },
      { name: 'Longest Articles', sql: "SELECT label, LENGTH(text) as text_len, LEFT(text, 120) as preview FROM {{TABLE}} ORDER BY text_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'heart_failure',
    name: 'Heart Failure',
    repo: 'mstz/heart_failure',
    parquetPath: 'hf://datasets/mstz/heart_failure/data/death-train.parquet',
    description: 'Clinical records for heart failure survival prediction',
    category: 'tabular',
    icon: '❤️',
    rowEstimate: '~300 rows',
    sampleQueries: [
      { name: 'Preview', sql: "SELECT * FROM {{TABLE}} LIMIT 20" },
      { name: 'Survival Stats', sql: "SELECT is_dead, COUNT(*) as count, ROUND(AVG(age), 1) as avg_age FROM {{TABLE}} GROUP BY is_dead" },
      { name: 'High Risk', sql: "SELECT age, is_male, is_smoker, platelets, serum_creatinine, is_dead FROM {{TABLE}} WHERE serum_creatinine > 1.5 ORDER BY age DESC LIMIT 20" },
    ],
  },
]
