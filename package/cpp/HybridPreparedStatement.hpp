#pragma once

#include "HybridPreparedStatementSpec.hpp"
#include "HybridQueryResult.hpp"
#include "types.hpp"
#include "duckdb.hpp"
#include <memory>
#include <NitroModules/Promise.hpp>

namespace margelo::nitro::rnduckdb {

class HybridPreparedStatement : public HybridPreparedStatementSpec {
public:
  HybridPreparedStatement(
      std::shared_ptr<duckdb::PreparedStatement> stmt,
      duckdb::Connection& con)
      : HybridObject(TAG), _stmt(std::move(stmt)), _con(con), _finalized(false) {}

  ~HybridPreparedStatement() override {
    finalize();
  }

  std::shared_ptr<HybridQueryResultSpec> executeSync(
      const std::optional<std::vector<DuckDBValue>>& params) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> execute(
      const std::optional<std::vector<DuckDBValue>>& params) override;

  void finalize() override;

  size_t getExternalMemorySize() noexcept override;

private:
  void ensureNotFinalized();

  std::shared_ptr<duckdb::PreparedStatement> _stmt;
  duckdb::Connection& _con;
  bool _finalized;

  static constexpr auto TAG = "PreparedStatement";
};

} // namespace margelo::nitro::rnduckdb
