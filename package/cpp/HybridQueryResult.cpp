#include "HybridQueryResult.hpp"
#include <stdexcept>

namespace margelo::nitro::rnduckdb {

HybridQueryResult::HybridQueryResult(std::unique_ptr<duckdb::QueryResult> result)
    : HybridObject(TAG), _rowCount(0), _rowsChanged(0) {
  if (result->HasError()) {
    throw std::runtime_error("[DuckDB] " + result->GetError());
  }

  // Extract metadata
  for (auto& name : result->names) {
    _columnNames.push_back(name);
  }
  for (auto& type : result->types) {
    _columnTypes.push_back(type.ToString());
  }

  // Check if this is a DML statement that returns changed rows
  bool isDML = result->properties.return_type == duckdb::StatementReturnType::CHANGED_ROWS;

  // Materialize the result
  auto& materialized = result->Cast<duckdb::MaterializedQueryResult>();
  _rowCount = materialized.RowCount();

  if (isDML && _rowCount == 1 && _columnNames.size() == 1) {
    // DML statements return a single row with the count of changed rows
    auto val = materialized.GetValue(0, 0);
    _rowsChanged = static_cast<size_t>(val.GetValue<int64_t>());
  }

  materialize(materialized);
}

void HybridQueryResult::materialize(duckdb::MaterializedQueryResult& result) {
  auto colCount = result.types.size();

  // Initialize column vectors
  _columns.resize(colCount);
  for (size_t c = 0; c < colCount; c++) {
    _columns[c].reserve(_rowCount);
  }

  if (_rowCount == 0) return;

  // Use Scan pattern to iterate DataChunks from the ColumnDataCollection
  auto& collection = result.Collection();
  duckdb::ColumnDataScanState scanState;
  collection.InitializeScan(scanState);

  duckdb::DataChunk chunk;
  collection.InitializeScanChunk(chunk);

  while (collection.Scan(scanState, chunk)) {
    auto chunkSize = chunk.size();
    if (chunkSize == 0) break;

    for (size_t col = 0; col < colCount; col++) {
      auto& vector = chunk.data[col];
      // Flatten the vector to ensure FlatVector access works
      vector.Flatten(chunkSize);

      auto& validity = duckdb::FlatVector::Validity(vector);
      auto typeId = result.types[col].id();

      for (duckdb::idx_t row = 0; row < chunkSize; row++) {
        if (!validity.RowIsValid(row)) {
          _columns[col].push_back(nitro::null);
          continue;
        }

        switch (typeId) {
          case duckdb::LogicalTypeId::BOOLEAN: {
            auto data = duckdb::FlatVector::GetData<bool>(vector);
            _columns[col].push_back(data[row]);
            break;
          }
          case duckdb::LogicalTypeId::TINYINT: {
            auto data = duckdb::FlatVector::GetData<int8_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::SMALLINT: {
            auto data = duckdb::FlatVector::GetData<int16_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::INTEGER: {
            auto data = duckdb::FlatVector::GetData<int32_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::BIGINT: {
            auto data = duckdb::FlatVector::GetData<int64_t>(vector);
            _columns[col].push_back(data[row]); // maps to JS bigint
            break;
          }
          case duckdb::LogicalTypeId::UTINYINT: {
            auto data = duckdb::FlatVector::GetData<uint8_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::USMALLINT: {
            auto data = duckdb::FlatVector::GetData<uint16_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::UINTEGER: {
            auto data = duckdb::FlatVector::GetData<uint32_t>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::UBIGINT: {
            auto data = duckdb::FlatVector::GetData<uint64_t>(vector);
            // May lose precision beyond 2^53, but uint64 can't go negative
            _columns[col].push_back(static_cast<int64_t>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::HUGEINT: {
            // Truncate to int64_t for Phase 3 — Phase 5 can add full support
            auto data = duckdb::FlatVector::GetData<duckdb::hugeint_t>(vector);
            auto val = duckdb::Hugeint::Cast<int64_t>(data[row]);
            _columns[col].push_back(val);
            break;
          }
          case duckdb::LogicalTypeId::FLOAT: {
            auto data = duckdb::FlatVector::GetData<float>(vector);
            _columns[col].push_back(static_cast<double>(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::DOUBLE: {
            auto data = duckdb::FlatVector::GetData<double>(vector);
            _columns[col].push_back(data[row]);
            break;
          }
          case duckdb::LogicalTypeId::DECIMAL: {
            // Convert to double — precision loss acceptable for Phase 3
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(val.GetValue<double>());
            break;
          }
          case duckdb::LogicalTypeId::VARCHAR: {
            auto data = duckdb::FlatVector::GetData<duckdb::string_t>(vector);
            _columns[col].push_back(data[row].GetString());
            break;
          }
          case duckdb::LogicalTypeId::BLOB: {
            auto data = duckdb::FlatVector::GetData<duckdb::string_t>(vector);
            auto& blobStr = data[row];
            auto buf = ArrayBuffer::copy(
              reinterpret_cast<const uint8_t*>(blobStr.GetData()),
              blobStr.GetSize());
            _columns[col].push_back(buf);
            break;
          }
          default: {
            // Fallback: convert to string via duckdb::Value for unknown types
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(val.ToString());
            break;
          }
        }
      }
    }
  }
}

double HybridQueryResult::getRowCount() {
  return static_cast<double>(_rowCount);
}

double HybridQueryResult::getRowsChanged() {
  return static_cast<double>(_rowsChanged);
}

double HybridQueryResult::getColumnCount() {
  return static_cast<double>(_columnNames.size());
}

std::vector<std::string> HybridQueryResult::getColumnNames() {
  return _columnNames;
}

std::vector<std::string> HybridQueryResult::getColumnTypes() {
  return _columnTypes;
}

std::vector<DuckDBValue> HybridQueryResult::getColumn(double index) {
  auto idx = static_cast<size_t>(index);
  if (idx >= _columns.size()) {
    throw std::runtime_error("[DuckDB] Column index " + std::to_string(idx) +
                             " out of bounds (have " + std::to_string(_columns.size()) + " columns)");
  }
  return _columns[idx];
}

std::vector<std::unordered_map<std::string, DuckDBValue>> HybridQueryResult::toRows() {
  std::vector<std::unordered_map<std::string, DuckDBValue>> rows;
  rows.reserve(_rowCount);

  for (size_t r = 0; r < _rowCount; r++) {
    std::unordered_map<std::string, DuckDBValue> row;
    row.reserve(_columnNames.size());
    for (size_t c = 0; c < _columnNames.size(); c++) {
      row[_columnNames[c]] = _columns[c][r];
    }
    rows.push_back(std::move(row));
  }

  return rows;
}

size_t HybridQueryResult::getExternalMemorySize() noexcept {
  // Rough estimate: each cell ~16 bytes (variant + data)
  return _rowCount * _columnNames.size() * 16;
}

} // namespace margelo::nitro::rnduckdb
