#pragma once

#include "HybridDatabaseSpec.hpp"
#include "HybridQueryResult.hpp"
#include "HybridPreparedStatementSpec.hpp"
#include "types.hpp"
#include "duckdb.hpp"
#include <memory>
#include <stdexcept>
#include <NitroModules/Promise.hpp>

namespace margelo::nitro::rnduckdb {

class HybridDatabase : public HybridDatabaseSpec {
public:
  HybridDatabase(std::unique_ptr<duckdb::DuckDB> db, std::unique_ptr<duckdb::Connection> con)
      : HybridObject(TAG), _db(std::move(db)), _con(std::move(con)), _isOpen(true) {}

  ~HybridDatabase() override {
    if (_isOpen) {
      _con.reset();
      _db.reset();
      _isOpen = false;
    }
  }

  bool getIsOpen() override;
  void close() override;
  size_t getExternalMemorySize() noexcept override;

  // Query execution
  std::shared_ptr<HybridQueryResultSpec> executeSync(
      const std::string& sql,
      const std::optional<std::vector<DuckDBValue>>& params) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridQueryResultSpec>>> execute(
      const std::string& sql,
      const std::optional<std::vector<DuckDBValue>>& params) override;

  std::shared_ptr<HybridPreparedStatementSpec> prepare(
      const std::string& sql) override;

private:
  void ensureOpen();

  std::unique_ptr<duckdb::DuckDB> _db;
  std::unique_ptr<duckdb::Connection> _con;
  bool _isOpen;

  static constexpr auto TAG = "Database";
};

} // namespace margelo::nitro::rnduckdb
