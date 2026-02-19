#include "HybridPreparedStatement.hpp"

namespace margelo::nitro::rnduckdb {

void HybridPreparedStatement::ensureNotFinalized() {
  if (_finalized) {
    throw std::runtime_error("[DuckDB] PreparedStatement is finalized");
  }
}

std::shared_ptr<HybridQueryResultSpec> HybridPreparedStatement::executeSync(
    const std::optional<std::vector<DuckDBValue>>& params) {
  ensureNotFinalized();

  if (params && !params->empty()) {
    auto values = toValues(*params);
    auto result = _stmt->Execute(values, false);
    if (result->HasError()) {
      throw std::runtime_error("[DuckDB] " + result->GetError());
    }
    return std::make_shared<HybridQueryResult>(std::move(result));
  }

  // No params — execute with empty values
  duckdb::vector<duckdb::Value> empty;
  auto result = _stmt->Execute(empty, false);
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }
  return std::make_shared<HybridQueryResult>(std::move(result));
}

std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> HybridPreparedStatement::execute(
    const std::optional<std::vector<DuckDBValue>>& params) {
  ensureNotFinalized();
  auto copiedParams = copyParamsForBackground(params);
  return Promise<std::shared_ptr<HybridQueryResultSpec>>::async(
    [this, copiedParams]() -> std::shared_ptr<HybridQueryResultSpec> {
      return this->executeSync(copiedParams);
    });
}

std::shared_ptr<HybridQueryResultSpec> HybridPreparedStatement::executeSyncNamed(
    const std::unordered_map<std::string, DuckDBValue>& params) {
  ensureNotFinalized();
  auto namedValues = toNamedValues(params);
  auto result = _stmt->Execute(namedValues);
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }
  return std::make_shared<HybridQueryResult>(std::move(result));
}

std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> HybridPreparedStatement::executeNamed(
    const std::unordered_map<std::string, DuckDBValue>& params) {
  ensureNotFinalized();
  auto copiedParams = copyNamedParamsForBackground(params);
  return Promise<std::shared_ptr<HybridQueryResultSpec>>::async(
    [this, copiedParams = std::move(copiedParams)]() -> std::shared_ptr<HybridQueryResultSpec> {
      return this->executeSyncNamed(copiedParams);
    });
}

void HybridPreparedStatement::finalize() {
  if (_finalized) return;
  _stmt.reset();
  _finalized = true;
}

size_t HybridPreparedStatement::getExternalMemorySize() noexcept {
  return _finalized ? 0 : 4096;
}

} // namespace margelo::nitro::rnduckdb
