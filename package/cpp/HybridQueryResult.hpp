#pragma once

#include "HybridQueryResultSpec.hpp"
#include "types.hpp"
#include "duckdb.hpp"
#include <memory>
#include <vector>
#include <string>
#include <unordered_map>

namespace margelo::nitro::rnduckdb {

class HybridQueryResult : public HybridQueryResultSpec {
public:
  explicit HybridQueryResult(std::unique_ptr<duckdb::QueryResult> result);

  // Properties
  double getRowCount() override;
  double getRowsChanged() override;
  double getColumnCount() override;
  std::vector<std::string> getColumnNames() override;
  std::vector<std::string> getColumnTypes() override;

  // Methods
  std::vector<DuckDBValue> getColumn(double index) override;
  std::vector<std::unordered_map<std::string, DuckDBValue>> toRows() override;

  size_t getExternalMemorySize() noexcept override;

private:
  void materialize(duckdb::MaterializedQueryResult& result);

  // Cached metadata
  size_t _rowCount;
  size_t _rowsChanged;
  std::vector<std::string> _columnNames;
  std::vector<std::string> _columnTypes;

  // Columnar data storage — one vector per column
  std::vector<std::vector<DuckDBValue>> _columns;

  static constexpr auto TAG = "QueryResult";
};

} // namespace margelo::nitro::rnduckdb
