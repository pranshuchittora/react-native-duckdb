#include "HybridDatabase.hpp"

namespace margelo::nitro::rnduckdb {

bool HybridDatabase::getIsOpen() {
  return _isOpen;
}

void HybridDatabase::close() {
  if (!_isOpen) return;
  _con.reset();
  _db.reset();
  _isOpen = false;
}

void HybridDatabase::ensureOpen() {
  if (!_isOpen) {
    throw std::runtime_error("[DuckDB] Database is closed");
  }
}

size_t HybridDatabase::getExternalMemorySize() noexcept {
  return _isOpen ? (256 * 1024 * 1024) : 0;
}

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
  // Stub — full implementation in Plan 02
  throw std::runtime_error("[DuckDB] PreparedStatement not yet implemented");
}

} // namespace margelo::nitro::rnduckdb
