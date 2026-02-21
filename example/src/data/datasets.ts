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
    id: 'cities',
    name: 'World Cities',
    repo: 'citydb/cities',
    parquetPath: 'hf://datasets/citydb/cities/train.parquet',
    description: 'Global cities with population, coordinates, and country data',
    category: 'tabular',
    icon: '🏙️',
    rowEstimate: '~47K rows',
    sampleQueries: [
      { name: 'Top 20 by Population', sql: "SELECT name, country, population FROM {{TABLE}} ORDER BY population DESC LIMIT 20" },
      { name: 'Cities per Country', sql: "SELECT country, COUNT(*) as city_count FROM {{TABLE}} GROUP BY country ORDER BY city_count DESC LIMIT 20" },
      { name: 'Avg Latitude by Country', sql: "SELECT country, ROUND(AVG(lat), 2) as avg_lat, COUNT(*) as cities FROM {{TABLE}} GROUP BY country HAVING COUNT(*) > 10 ORDER BY avg_lat DESC LIMIT 20" },
    ],
  },
  {
    id: 'countries',
    name: 'Countries',
    repo: 'lukebarousse/Countries',
    parquetPath: 'hf://datasets/lukebarousse/Countries/data/train-00000-of-00001.parquet',
    description: 'Country statistics: GDP, population, area, and more',
    category: 'tabular',
    icon: '🌍',
    rowEstimate: '~250 rows',
    sampleQueries: [
      { name: 'Top 10 GDP', sql: "SELECT country_name, gdp FROM {{TABLE}} WHERE gdp IS NOT NULL ORDER BY gdp DESC LIMIT 10" },
      { name: 'Largest by Area', sql: "SELECT country_name, area FROM {{TABLE}} WHERE area IS NOT NULL ORDER BY area DESC LIMIT 15" },
      { name: 'Population Density', sql: "SELECT country_name, population, area, ROUND(population / NULLIF(area, 0), 1) as density FROM {{TABLE}} WHERE area > 0 ORDER BY density DESC LIMIT 20" },
    ],
  },
  {
    id: 'iris',
    name: 'Iris Dataset',
    repo: 'scikit-learn/iris',
    parquetPath: 'hf://datasets/scikit-learn/iris/iris.parquet',
    description: 'Classic ML dataset — flower measurements by species',
    category: 'tabular',
    icon: '🌸',
    rowEstimate: '150 rows',
    sampleQueries: [
      { name: 'Avg by Species', sql: "SELECT species, ROUND(AVG(\"PetalLengthCm\"), 2) as avg_petal_len, ROUND(AVG(\"PetalWidthCm\"), 2) as avg_petal_width FROM {{TABLE}} GROUP BY species" },
      { name: 'Species Distribution', sql: "SELECT species, COUNT(*) as count FROM {{TABLE}} GROUP BY species ORDER BY count DESC" },
      { name: 'Wide Petals', sql: "SELECT * FROM {{TABLE}} WHERE \"PetalWidthCm\" > 2.0 ORDER BY \"PetalWidthCm\" DESC LIMIT 20" },
    ],
  },
  {
    id: 'wine',
    name: 'Wine Quality',
    repo: 'codesignal/wine-quality',
    parquetPath: 'hf://datasets/codesignal/wine-quality/data/train-00000-of-00001.parquet',
    description: 'Red and white wine samples with chemical properties and quality ratings',
    category: 'tabular',
    icon: '🍷',
    rowEstimate: '~6.5K rows',
    sampleQueries: [
      { name: 'Avg Quality by Alcohol', sql: "SELECT ROUND(alcohol) as alcohol_range, ROUND(AVG(quality), 2) as avg_quality, COUNT(*) as wines FROM {{TABLE}} GROUP BY alcohol_range ORDER BY alcohol_range" },
      { name: 'Best Wines', sql: "SELECT * FROM {{TABLE}} WHERE quality >= 8 ORDER BY quality DESC, alcohol DESC LIMIT 20" },
      { name: 'Chemical Ranges', sql: "SELECT ROUND(MIN(pH), 2) as min_ph, ROUND(MAX(pH), 2) as max_ph, ROUND(AVG(alcohol), 2) as avg_alcohol, ROUND(AVG(quality), 2) as avg_quality FROM {{TABLE}}" },
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
    rowEstimate: '~50K rows',
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
    rowEstimate: '~120K rows',
    sampleQueries: [
      { name: 'Articles per Category', sql: "SELECT label, COUNT(*) as count FROM {{TABLE}} GROUP BY label ORDER BY count DESC" },
      { name: 'Sample per Category', sql: "SELECT label, LEFT(text, 150) as preview FROM {{TABLE}} GROUP BY label, text LIMIT 8" },
      { name: 'Longest Articles', sql: "SELECT label, LENGTH(text) as text_len, LEFT(text, 120) as preview FROM {{TABLE}} ORDER BY text_len DESC LIMIT 10" },
    ],
  },
  {
    id: 'us_airports',
    name: 'US Airports',
    repo: 'crazywolf132/us-airports',
    parquetPath: 'hf://datasets/crazywolf132/us-airports/data/train-00000-of-00001.parquet',
    description: 'US airport locations with names, codes, elevation, and coordinates',
    category: 'geospatial',
    icon: '✈️',
    rowEstimate: '~20K rows',
    sampleQueries: [
      { name: 'Airports per State', sql: "SELECT iso_region, COUNT(*) as airport_count FROM {{TABLE}} GROUP BY iso_region ORDER BY airport_count DESC LIMIT 20" },
      { name: 'Highest Elevation', sql: "SELECT name, municipality, iso_region, elevation_ft FROM {{TABLE}} WHERE elevation_ft IS NOT NULL ORDER BY elevation_ft DESC LIMIT 15" },
      { name: 'Large Airports', sql: "SELECT name, municipality, iso_region, type FROM {{TABLE}} WHERE type = 'large_airport' ORDER BY name LIMIT 20" },
    ],
  },
  {
    id: 'earthquakes',
    name: 'Global Earthquakes',
    repo: 'SudhanshuBlaze/Global-Earthquake-Data',
    parquetPath: 'hf://datasets/SudhanshuBlaze/Global-Earthquake-Data/data/train-00000-of-00001.parquet',
    description: 'Historical earthquake records with magnitude, depth, and location data',
    category: 'geospatial',
    icon: '🌋',
    rowEstimate: '~3.4K rows',
    sampleQueries: [
      { name: 'By Magnitude Range', sql: "SELECT FLOOR(magnitude) as mag_floor, COUNT(*) as quake_count FROM {{TABLE}} WHERE magnitude IS NOT NULL GROUP BY mag_floor ORDER BY mag_floor DESC" },
      { name: 'Strongest Quakes', sql: "SELECT title, magnitude, date_time, depth FROM {{TABLE}} ORDER BY magnitude DESC LIMIT 15" },
      { name: 'Depth Distribution', sql: "SELECT CASE WHEN depth < 10 THEN 'Shallow (<10km)' WHEN depth < 70 THEN 'Medium (10-70km)' ELSE 'Deep (>70km)' END as depth_cat, COUNT(*) as count FROM {{TABLE}} WHERE depth IS NOT NULL GROUP BY depth_cat ORDER BY count DESC" },
    ],
  },
]
