#pragma once

#include "HybridStreamingResultSpec.hpp"
#include "HybridQueryResult.hpp"
#include "types.hpp"
#include "duckdb.hpp"
#include <memory>
#include <vector>
#include <string>
#include <mutex>
#include <functional>
#include <NitroModules/Promise.hpp>

namespace margelo::nitro::rnduckdb {

class HybridStreamingResult : public HybridStreamingResultSpec {
public:
  HybridStreamingResult(std::unique_ptr<duckdb::QueryResult> result,
                        std::unique_ptr<duckdb::Connection> ownedConnection);

  ~HybridStreamingResult() override {
    close();
  }

  // Properties
  bool getIsDone() override;
  double getColumnCount() override;
  std::vector<std::string> getColumnNames() override;
  std::vector<std::string> getColumnTypes() override;

  // Methods
  std::shared_ptr<Promise<std::optional<std::shared_ptr<HybridQueryResultSpec>>>> fetchChunk() override;
  void onChunk(const std::function<void(const std::shared_ptr<HybridQueryResultSpec>&)>& callback) override;
  std::shared_ptr<Promise<void>> start() override;
  void close() override;

  size_t getExternalMemorySize() noexcept override;

private:
  std::shared_ptr<HybridQueryResultSpec> fetchNextChunk();

  std::unique_ptr<duckdb::QueryResult> _stream;
  std::unique_ptr<duckdb::Connection> _ownedConnection;
  std::function<void(const std::shared_ptr<HybridQueryResultSpec>&)> _onChunkCallback;
  bool _closed = false;
  bool _isDone = false;
  std::mutex _mutex;

  std::vector<std::string> _columnNames;
  std::vector<std::string> _columnTypes;
  std::vector<duckdb::LogicalType> _logicalTypes;

  static constexpr auto TAG = "StreamingResult";
};

} // namespace margelo::nitro::rnduckdb
