#include "HybridQueryResult.hpp"
#include "json_serializer.hpp"
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
            auto data = duckdb::FlatVector::GetData<duckdb::hugeint_t>(vector);
            _columns[col].push_back(duckdb::Hugeint::ToString(data[row]));
            break;
          }
          case duckdb::LogicalTypeId::UHUGEINT: {
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(val.ToString());
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
            auto width = duckdb::DecimalType::GetWidth(result.types[col]);
            auto scale = duckdb::DecimalType::GetScale(result.types[col]);
            switch (result.types[col].InternalType()) {
              case duckdb::PhysicalType::INT16: {
                auto data = duckdb::FlatVector::GetData<int16_t>(vector);
                _columns[col].push_back(duckdb::Decimal::ToString(data[row], width, scale));
                break;
              }
              case duckdb::PhysicalType::INT32: {
                auto data = duckdb::FlatVector::GetData<int32_t>(vector);
                _columns[col].push_back(duckdb::Decimal::ToString(data[row], width, scale));
                break;
              }
              case duckdb::PhysicalType::INT64: {
                auto data = duckdb::FlatVector::GetData<int64_t>(vector);
                _columns[col].push_back(duckdb::Decimal::ToString(data[row], width, scale));
                break;
              }
              case duckdb::PhysicalType::INT128: {
                auto data = duckdb::FlatVector::GetData<duckdb::hugeint_t>(vector);
                _columns[col].push_back(duckdb::Decimal::ToString(data[row], width, scale));
                break;
              }
              default:
                break;
            }
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

          // Temporal types — ISO string representations
          case duckdb::LogicalTypeId::DATE:
          case duckdb::LogicalTypeId::TIME:
          case duckdb::LogicalTypeId::TIME_TZ:
          case duckdb::LogicalTypeId::TIME_NS:
          case duckdb::LogicalTypeId::INTERVAL: {
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(val.ToString());
            break;
          }
          case duckdb::LogicalTypeId::TIMESTAMP:
          case duckdb::LogicalTypeId::TIMESTAMP_SEC:
          case duckdb::LogicalTypeId::TIMESTAMP_MS:
          case duckdb::LogicalTypeId::TIMESTAMP_NS:
          case duckdb::LogicalTypeId::TIMESTAMP_TZ: {
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            auto str = val.ToString();
            auto spacePos = str.find(' ');
            if (spacePos != std::string::npos && spacePos >= 10) {
              str[spacePos] = 'T';
            }
            _columns[col].push_back(str);
            break;
          }

          // Special types — string representations
          case duckdb::LogicalTypeId::UUID:
          case duckdb::LogicalTypeId::ENUM:
          case duckdb::LogicalTypeId::BIT: {
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(val.ToString());
            break;
          }

          // Complex types — JSON string representations
          case duckdb::LogicalTypeId::LIST:
          case duckdb::LogicalTypeId::STRUCT:
          case duckdb::LogicalTypeId::MAP:
          case duckdb::LogicalTypeId::ARRAY:
          case duckdb::LogicalTypeId::UNION: {
            auto val = chunk.GetValue(static_cast<duckdb::idx_t>(col), row);
            _columns[col].push_back(valueToJson(val));
            break;
          }

          default: {
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
