#pragma once

#include "HybridDatabaseSpec.hpp"
#include "HybridQueryResult.hpp"
#include "HybridPreparedStatementSpec.hpp"
#include "HybridStreamingResultSpec.hpp"
#include "HybridAppenderSpec.hpp"
#include "ExecuteOptions.hpp"
#include "types.hpp"
#include "duckdb_includes.hpp"
#include <memory>
#include <stdexcept>
#include <mutex>
#include <unordered_map>
#include <unordered_set>
#include <atomic>
#include <functional>
#include <NitroModules/Promise.hpp>

namespace margelo::nitro::rnduckdb {

class HybridDatabase;

struct ConnectionTracker {
  std::mutex mtx;
  std::unordered_map<std::string, HybridDatabase*> connections;

  void add(const std::string& id, HybridDatabase* conn) {
    std::lock_guard<std::mutex> lk(mtx);
    connections[id] = conn;
  }

  void remove(const std::string& id) {
    std::lock_guard<std::mutex> lk(mtx);
    connections.erase(id);
  }

  size_t count() {
    std::lock_guard<std::mutex> lk(mtx);
    return connections.size();
  }

  std::vector<std::string> list() {
    std::lock_guard<std::mutex> lk(mtx);
    std::vector<std::string> ids;
    ids.reserve(connections.size());
    for (const auto& [id, _] : connections) {
      ids.push_back(id);
    }
    return ids;
  }

  // Declared here, defined in .cpp to avoid circular dependency
  void closeAll();
};

class HybridDatabase : public HybridDatabaseSpec {
public:
  // Primary constructor — owns the DuckDB instance (shared)
  HybridDatabase(std::shared_ptr<duckdb::DuckDB> db, std::unique_ptr<duckdb::Connection> con,
                 std::string docPath)
      : HybridObject(TAG), _db(std::move(db)), _con(std::move(con)),
        _isOpen(true), _isPrimary(true),
        _id("primary"), _docPath(std::move(docPath)),
        _tracker(std::make_shared<ConnectionTracker>()) {}

  // Secondary constructor — connection created via connect()
  HybridDatabase(std::shared_ptr<duckdb::DuckDB> db, std::unique_ptr<duckdb::Connection> con,
                 std::string id, std::shared_ptr<ConnectionTracker> tracker,
                 std::string docPath)
      : HybridObject(TAG), _db(std::move(db)), _con(std::move(con)),
        _isOpen(true), _isPrimary(false),
        _id(std::move(id)), _docPath(std::move(docPath)),
        _tracker(std::move(tracker)) {}

  ~HybridDatabase() override {
    if (_isOpen) {
      if (!_isPrimary && _tracker) {
        _tracker->remove(_id);
      }
      _con.reset();
      if (_isPrimary) {
        _db.reset();
      }
      _isOpen = false;
    }
  }

  bool getIsOpen() override;
  void close(const std::optional<CloseOptions>& options) override;
  size_t getExternalMemorySize() noexcept override;

  // Query execution
  std::shared_ptr<HybridQueryResultSpec> executeSync(
      const std::string& sql,
      const std::optional<std::vector<DuckDBValue>>& params) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> execute(
      const std::string& sql,
      const std::optional<std::vector<DuckDBValue>>& params,
      const std::optional<ExecuteOptions>& options) override;

  std::shared_ptr<HybridPreparedStatementSpec> prepare(
      const std::string& sql) override;

  // Query cancellation
  void cancel() override;

  // Named parameter execution
  std::shared_ptr<HybridQueryResultSpec> executeSyncNamed(
      const std::string& sql,
      const std::unordered_map<std::string, DuckDBValue>& params) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> executeNamed(
      const std::string& sql,
      const std::unordered_map<std::string, DuckDBValue>& params,
      const std::optional<ExecuteOptions>& options) override;

  // Streaming
  std::shared_ptr<Promise<std::shared_ptr<HybridStreamingResultSpec>>> stream(
      const std::string& sql,
      const std::optional<std::vector<DuckDBValue>>& params,
      const std::optional<ExecuteOptions>& options) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridStreamingResultSpec>>> streamNamed(
      const std::string& sql,
      const std::unordered_map<std::string, DuckDBValue>& params,
      const std::optional<ExecuteOptions>& options) override;

  // Profiling
  std::string getProfilingInfo() override;

  // Progress callbacks
  void setProgressCallback(const std::function<void(double)>& callback) override;
  void removeProgressCallback() override;

  // Appender
  std::shared_ptr<HybridAppenderSpec> createAppender(
      const std::string& table,
      const std::optional<AppenderOptions>& options) override;

  // Connection management
  std::shared_ptr<HybridDatabaseSpec> connect() override;
  ConnectionInfo connections() override;
  void closeConnections() override;

  // ATTACH/DETACH
  void attach(const std::string& path, const std::string& alias,
              const std::optional<AttachOptions>& options) override;
  void detach(const std::string& alias) override;

  // Batch execution
  BatchResult executeBatchSync(const std::vector<BatchCommand>& commands) override;
  std::shared_ptr<Promise<BatchResult>> executeBatch(
      const std::vector<BatchCommand>& commands) override;

private:
  void ensureOpen();
  void ensurePrimary(const char* method);

  std::unique_ptr<duckdb::QueryResult> executeWithProgress(
      const std::string& sql,
      const std::optional<DuckDBParams>& params,
      const std::optional<std::function<void(double)>>& onProgress);

  std::unique_ptr<duckdb::QueryResult> executeNamedWithProgress(
      const std::string& sql,
      const DuckDBNamedParams& params,
      const std::optional<std::function<void(double)>>& onProgress);

  std::shared_ptr<duckdb::DuckDB> _db;
  std::unique_ptr<duckdb::Connection> _con;
  bool _isOpen;
  bool _isPrimary;
  std::string _id;
  std::string _docPath;
  std::shared_ptr<ConnectionTracker> _tracker;
  std::optional<std::function<void(double)>> _progressCallback;

  static std::atomic<uint64_t> _connectionIdCounter;
  static constexpr auto TAG = "Database";
};

} // namespace margelo::nitro::rnduckdb
