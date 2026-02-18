#include "HybridDatabase.hpp"
#include "HybridPreparedStatement.hpp"
#include "utils.hpp"

namespace margelo::nitro::rnduckdb {

std::atomic<uint64_t> HybridDatabase::_connectionIdCounter{0};

bool HybridDatabase::getIsOpen() {
  return _isOpen;
}

void HybridDatabase::close(const std::optional<CloseOptions>& options) {
  if (!_isOpen) return;

  bool force = options && options->force && *options->force;

  if (_isPrimary) {
    auto openCount = _tracker->count();
    if (openCount > 0 && !force) {
      throw std::runtime_error(
        "[DuckDB] Cannot close database: " + std::to_string(openCount) +
        " connection(s) still open. Use close({ force: true }) to force.");
    }
    if (openCount > 0 && force) {
      _tracker->closeAll();
    }
  }

  if (!_isPrimary && _tracker) {
    _tracker->remove(_id);
  }

  _con.reset();
  if (_isPrimary) {
    _db.reset();
  }
  _isOpen = false;
}

void HybridDatabase::ensureOpen() {
  if (!_isOpen) {
    throw std::runtime_error("[DuckDB] Database is closed");
  }
}

void HybridDatabase::ensurePrimary(const char* method) {
  if (!_isPrimary) {
    throw std::runtime_error(
      std::string("[DuckDB] ") + method + " can only be called on the primary database, not on a connection");
  }
}

size_t HybridDatabase::getExternalMemorySize() noexcept {
  return _isOpen ? (256 * 1024 * 1024) : 0;
}

// --- Query execution (unchanged) ---

std::shared_ptr<HybridQueryResultSpec> HybridDatabase::executeSync(
    const std::string& sql,
    const std::optional<std::vector<DuckDBValue>>& params) {
  ensureOpen();

  if (params && !params->empty()) {
    auto prepared = _con->Prepare(sql);
    if (prepared->HasError()) {
      throw std::runtime_error("[DuckDB] " + prepared->GetError());
    }
    auto values = toValues(*params);
    auto result = prepared->Execute(values, false);
    if (result->HasError()) {
      throw std::runtime_error("[DuckDB] " + result->GetError());
    }
    return std::make_shared<HybridQueryResult>(std::move(result));
  }

  auto result = _con->Query(sql);
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }
  return std::make_shared<HybridQueryResult>(std::move(result));
}

std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> HybridDatabase::execute(
    const std::string& sql,
    const std::optional<std::vector<DuckDBValue>>& params) {
  ensureOpen();
  auto copiedParams = copyParamsForBackground(params);
  return Promise<std::shared_ptr<HybridQueryResultSpec>>::async(
    [this, sql, copiedParams]() -> std::shared_ptr<HybridQueryResultSpec> {
      return this->executeSync(sql, copiedParams);
    });
}

std::shared_ptr<HybridPreparedStatementSpec> HybridDatabase::prepare(
    const std::string& sql) {
  ensureOpen();
  auto stmt = _con->Prepare(sql);
  if (stmt->HasError()) {
    throw std::runtime_error("[DuckDB] " + stmt->GetError());
  }
  return std::make_shared<HybridPreparedStatement>(std::move(stmt), *_con);
}

// --- Connection management ---

std::shared_ptr<HybridDatabaseSpec> HybridDatabase::connect() {
  ensureOpen();
  ensurePrimary("connect()");

  auto id = "conn_" + std::to_string(_connectionIdCounter.fetch_add(1));
  auto con = std::make_unique<duckdb::Connection>(*_db);

  auto child = std::make_shared<HybridDatabase>(_db, std::move(con), id, _tracker);
  _tracker->add(id, child.get());

  return child;
}

ConnectionInfo HybridDatabase::connections() {
  ensureOpen();
  ensurePrimary("connections()");

  auto ids = _tracker->list();
  return ConnectionInfo(static_cast<double>(ids.size()), std::move(ids));
}

void HybridDatabase::closeConnections() {
  ensureOpen();
  ensurePrimary("closeConnections()");

  _tracker->closeAll();
}

// ConnectionTracker::closeAll — closes all tracked connections
void ConnectionTracker::closeAll() {
  // Collect pointers under lock, then close outside lock
  // (close() calls tracker->remove() which also locks)
  std::vector<HybridDatabase*> toClose;
  {
    std::lock_guard<std::mutex> lk(mtx);
    toClose.reserve(connections.size());
    for (const auto& [_, conn] : connections) {
      toClose.push_back(conn);
    }
  }
  for (auto* conn : toClose) {
    conn->close(std::nullopt);
  }
}

// --- ATTACH/DETACH ---

void HybridDatabase::attach(const std::string& path, const std::string& alias,
                             const std::optional<AttachOptions>& options) {
  ensureOpen();

  auto resolvedPath = resolvePath("", path);

  std::string sql = "ATTACH '" + resolvedPath + "' AS " + alias;

  // Build options list
  std::vector<std::string> opts;
  if (options) {
    if (options->readOnly && *options->readOnly) {
      opts.push_back("READ_ONLY");
    }
    if (options->type && !options->type->empty()) {
      opts.push_back("TYPE " + *options->type);
    }
  }

  if (!opts.empty()) {
    sql += " (";
    for (size_t i = 0; i < opts.size(); i++) {
      if (i > 0) sql += ", ";
      sql += opts[i];
    }
    sql += ")";
  }

  auto result = _con->Query(sql);
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }
}

void HybridDatabase::detach(const std::string& alias) {
  ensureOpen();

  auto result = _con->Query("DETACH " + alias);
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }
}

// --- Batch execution ---

BatchResult HybridDatabase::executeBatchSync(const std::vector<BatchCommand>& commands) {
  ensureOpen();

  auto beginResult = _con->Query("BEGIN TRANSACTION");
  if (beginResult->HasError()) {
    throw std::runtime_error("[DuckDB] " + beginResult->GetError());
  }

  double totalRowsAffected = 0;

  for (const auto& cmd : commands) {
    if (cmd.params && !cmd.params->empty()) {
      auto prepared = _con->Prepare(cmd.query);
      if (prepared->HasError()) {
        _con->Query("ROLLBACK");
        throw std::runtime_error("[DuckDB] " + prepared->GetError());
      }
      auto values = toValues(*cmd.params);
      auto queryResult = prepared->Execute(values, false);
      if (queryResult->HasError()) {
        _con->Query("ROLLBACK");
        throw std::runtime_error("[DuckDB] " + queryResult->GetError());
      }
      auto& result = queryResult->Cast<duckdb::MaterializedQueryResult>();
      if (result.ColumnCount() == 1 && result.names[0] == "Count") {
        totalRowsAffected += result.GetValue(0, 0).GetValue<int64_t>();
      }
    } else {
      auto result = _con->Query(cmd.query);
      if (result->HasError()) {
        _con->Query("ROLLBACK");
        throw std::runtime_error("[DuckDB] " + result->GetError());
      }
      if (result->ColumnCount() == 1 && result->names[0] == "Count") {
        totalRowsAffected += result->GetValue(0, 0).GetValue<int64_t>();
      }
    }
  }

  auto commitResult = _con->Query("COMMIT");
  if (commitResult->HasError()) {
    _con->Query("ROLLBACK");
    throw std::runtime_error("[DuckDB] " + commitResult->GetError());
  }

  return BatchResult(totalRowsAffected);
}

std::shared_ptr<Promise<BatchResult>> HybridDatabase::executeBatch(
    const std::vector<BatchCommand>& commands) {
  ensureOpen();

  // Deep-copy commands for background thread safety
  std::vector<BatchCommand> copiedCommands;
  copiedCommands.reserve(commands.size());
  for (const auto& cmd : commands) {
    auto copiedParams = copyParamsForBackground(cmd.params);
    copiedCommands.push_back(BatchCommand(cmd.query, std::move(copiedParams)));
  }

  return Promise<BatchResult>::async(
    [this, copiedCommands = std::move(copiedCommands)]() -> BatchResult {
      return this->executeBatchSync(copiedCommands);
    });
}

} // namespace margelo::nitro::rnduckdb
