#include "HybridAppender.hpp"

namespace margelo::nitro::rnduckdb {

HybridAppender::HybridAppender(duckdb::Connection& con, const std::string& table,
                               std::optional<double> flushEvery)
    : HybridObject(TAG) {
  _appender = std::make_unique<duckdb::Appender>(con, table);
  if (flushEvery && *flushEvery > 0) {
    _flushEvery = static_cast<uint64_t>(*flushEvery);
  }
}

void HybridAppender::ensureOpen() {
  if (_closed) {
    throw std::runtime_error("[DuckDB] Appender is closed");
  }
  if (_invalidated) {
    throw std::runtime_error(
      "[DuckDB] Appender is invalidated after a failed flush. Create a new appender.");
  }
}

void HybridAppender::appendSingleValue(const DuckDBValue& val) {
  if (std::holds_alternative<NullType>(val)) {
    _appender->Append<std::nullptr_t>(nullptr);
  } else if (std::holds_alternative<bool>(val)) {
    _appender->Append<bool>(std::get<bool>(val));
  } else if (std::holds_alternative<double>(val)) {
    _appender->Append<double>(std::get<double>(val));
  } else if (std::holds_alternative<int64_t>(val)) {
    _appender->Append<int64_t>(std::get<int64_t>(val));
  } else if (std::holds_alternative<std::string>(val)) {
    _appender->Append<duckdb::Value>(duckdb::Value(std::get<std::string>(val)));
  } else if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(val)) {
    const auto& buf = std::get<std::shared_ptr<ArrayBuffer>>(val);
    _appender->Append<duckdb::Value>(
      duckdb::Value::BLOB(reinterpret_cast<const uint8_t*>(buf->data()), buf->size()));
  }
}

void HybridAppender::appendRow(const std::vector<DuckDBValue>& values) {
  ensureOpen();
  _appender->BeginRow();
  for (const auto& val : values) {
    appendSingleValue(val);
  }
  _appender->EndRow();
  _rowCount++;

  if (_flushEvery && (_rowCount % *_flushEvery == 0)) {
    flush();
  }
}

void HybridAppender::appendRows(const std::vector<std::vector<DuckDBValue>>& rows) {
  for (const auto& row : rows) {
    appendRow(row);
  }
}

void HybridAppender::appendColumns(const std::vector<std::vector<DuckDBValue>>& columns) {
  if (columns.empty()) return;

  auto rowCount = columns[0].size();
  for (size_t c = 1; c < columns.size(); c++) {
    if (columns[c].size() != rowCount) {
      throw std::runtime_error(
        "[DuckDB] All column arrays must have the same length. Column 0 has " +
        std::to_string(rowCount) + " rows, but column " + std::to_string(c) +
        " has " + std::to_string(columns[c].size()) + " rows.");
    }
  }

  ensureOpen();
  for (size_t r = 0; r < rowCount; r++) {
    _appender->BeginRow();
    for (size_t c = 0; c < columns.size(); c++) {
      appendSingleValue(columns[c][r]);
    }
    _appender->EndRow();
    _rowCount++;

    if (_flushEvery && (_rowCount % *_flushEvery == 0)) {
      flush();
    }
  }
}

void HybridAppender::flush() {
  ensureOpen();
  try {
    _appender->Flush();
  } catch (const std::exception& e) {
    _invalidated = true;
    throw std::runtime_error(
      std::string("[DuckDB] Appender flush failed — appender is now invalid, create a new one: ") +
      e.what());
  }
}

void HybridAppender::close() {
  if (_closed) return;

  if (!_invalidated && _appender) {
    try {
      _appender->Close();
    } catch (...) {
      // close auto-flushes, but if that fails we still release
    }
  }

  _appender.reset();
  _closed = true;
}

size_t HybridAppender::getExternalMemorySize() noexcept {
  return _closed ? 0 : (64 * 1024);
}

} // namespace margelo::nitro::rnduckdb
