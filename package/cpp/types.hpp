#pragma once

#include <vector>
#include <string>
#include <variant>
#include <memory>
#include <optional>
#include "duckdb.hpp"
#include <NitroModules/Null.hpp>
#include <NitroModules/ArrayBuffer.hpp>
#include "NumericColumn.hpp"

namespace margelo::nitro::rnduckdb {

using namespace margelo::nitro;

// Matches the Nitrogen-generated variant for DuckDBValue:
// TS: null | boolean | number | Int64 | string | ArrayBuffer
using DuckDBValue = std::variant<NullType, bool, int64_t, std::shared_ptr<ArrayBuffer>, std::string, double>;
using DuckDBParams = std::vector<DuckDBValue>;

// Matches the Nitrogen-generated variant for ColumnData:
// TS: NumericColumn | (string | null)[]
using ColumnData = std::variant<NumericColumn, std::vector<std::variant<NullType, std::string>>>;

// Convert JS param values to DuckDB Values for PreparedStatement::Execute()
inline duckdb::vector<duckdb::Value> toValues(const DuckDBParams& params) {
  duckdb::vector<duckdb::Value> values;
  values.reserve(params.size());

  for (const auto& val : params) {
    if (std::holds_alternative<NullType>(val)) {
      values.push_back(duckdb::Value());
    } else if (std::holds_alternative<bool>(val)) {
      values.push_back(duckdb::Value::BOOLEAN(std::get<bool>(val)));
    } else if (std::holds_alternative<double>(val)) {
      values.push_back(duckdb::Value(std::get<double>(val)));
    } else if (std::holds_alternative<int64_t>(val)) {
      values.push_back(duckdb::Value::BIGINT(std::get<int64_t>(val)));
    } else if (std::holds_alternative<std::string>(val)) {
      values.push_back(duckdb::Value(std::get<std::string>(val)));
    } else if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(val)) {
      const auto& buf = std::get<std::shared_ptr<ArrayBuffer>>(val);
      values.push_back(duckdb::Value::BLOB(
        reinterpret_cast<const uint8_t*>(buf->data()), buf->size()));
    }
  }

  return values;
}

// Deep-copy ArrayBuffer params for safe background thread access.
// JS ArrayBuffers are only valid during the synchronous call.
inline std::optional<DuckDBParams> copyParamsForBackground(
    const std::optional<DuckDBParams>& params) {
  if (!params) return std::nullopt;
  DuckDBParams copied;
  copied.reserve(params->size());
  for (const auto& value : *params) {
    if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
      const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(value);
      copied.push_back(ArrayBuffer::copy(buffer));
    } else {
      copied.push_back(value);
    }
  }
  return copied;
}

} // namespace margelo::nitro::rnduckdb
