import type { Dataset } from '../data/datasets'

export type RootTabParamList = {
  Tests: undefined
  Explorer: undefined
  Query: undefined
  Datasets: undefined
}

export type ExplorerStackParamList = {
  ExplorerHome: undefined
  FTSExplorer: undefined
  VSSExplorer: undefined
  RemoteFiles: undefined
  FileQueries: undefined
  StreamingDemo: undefined
  AppenderBenchmark: undefined
  TypeInspector: undefined
  AttachDatabase: undefined
}

export type QueryStackParamList = {
  QueryRunner: { prefillSql?: string } | undefined
  QueryHistory: undefined
}

export type DatasetStackParamList = {
  DatasetExplorer: undefined
  DatasetDetail: { dataset: Dataset }
}
