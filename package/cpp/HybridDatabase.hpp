#pragma once

#include "HybridDatabaseSpec.hpp"
#include "duckdb.hpp"
#include <memory>
#include <stdexcept>

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

private:
  void ensureOpen();

  std::unique_ptr<duckdb::DuckDB> _db;
  std::unique_ptr<duckdb::Connection> _con;
  bool _isOpen;

  static constexpr auto TAG = "Database";
};

} // namespace margelo::nitro::rnduckdb
