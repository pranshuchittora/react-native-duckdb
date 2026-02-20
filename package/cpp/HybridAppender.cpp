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

void HybridAppender::loadHybridMethods() {
  // Register all typed Nitro methods first (flush, close, appendColumns, etc.)
  HybridAppenderSpec::loadHybridMethods();

  // Now shadow appendRow and appendRows with raw JSI fast paths.
  //
  // Why: Nitro's default path converts JS arrays → vector<variant<...>> before
  // calling our C++ method. For appendRow this means:
  //   1. Allocate a std::vector on the heap
  //   2. For each element: walk a sequential canConvert() chain across 6 variant
  //      alternatives (~13 JSI calls per row on Hermes)
  //   3. Copy strings into std::string variants
  //   4. Pass the vector to appendRow(), which then unpacks each variant
  //
  // The raw path reads jsi::Value directly and calls DuckDB Append<T> inline,
  // cutting heap allocations to zero and JSI calls to ~5/row.
  //
  // registerHybrids with HybridAppender's own type key creates a separate
  // Prototype from HybridAppenderSpec's, so these raw methods shadow (not
  // collide with) the typed ones on the JS prototype chain.
  registerHybrids(this, [](Prototype& prototype) {
    prototype.registerRawHybridMethod("appendRow", 1, &HybridAppender::appendRowRaw);
    prototype.registerRawHybridMethod("appendRows", 1, &HybridAppender::appendRowsRaw);
  });
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

// Type-dispatch a single jsi::Value and append it directly to DuckDB.
// Mirrors appendSingleValue() but operates on raw JSI values instead of
// std::variant, avoiding the variant construction + holds_alternative chain.
void HybridAppender::appendJSIValue(jsi::Runtime& rt, const jsi::Value& val) {
  if (val.isNull() || val.isUndefined()) {
    _appender->Append<std::nullptr_t>(nullptr);
  } else if (val.isBool()) {
    _appender->Append<bool>(val.getBool());
  } else if (val.isNumber()) {
    _appender->Append<double>(val.getNumber());
  } else if (val.isString()) {
    _appender->Append<duckdb::Value>(duckdb::Value(val.getString(rt).utf8(rt)));
  } else if (val.isBigInt()) {
    _appender->Append<int64_t>(val.getBigInt(rt).getInt64(rt));
  } else if (val.isObject()) {
    auto obj = val.getObject(rt);
    if (obj.isArrayBuffer(rt)) {
      auto buf = obj.getArrayBuffer(rt);
      _appender->Append<duckdb::Value>(
        duckdb::Value::BLOB(buf.data(rt), buf.size(rt)));
    } else {
      throw std::runtime_error("[DuckDB] Unsupported value type in appendRow");
    }
  } else {
    throw std::runtime_error("[DuckDB] Unsupported value type in appendRow");
  }
}

// Append one row from a JS array directly — wraps BeginRow/EndRow with
// per-element appendJSIValue and handles the flush-every-N bookkeeping.
void HybridAppender::appendJSIRow(jsi::Runtime& rt, const jsi::Array& row, size_t colCount) {
  _appender->BeginRow();
  for (size_t i = 0; i < colCount; i++) {
    appendJSIValue(rt, row.getValueAtIndex(rt, i));
  }
  _appender->EndRow();
  _rowCount++;

  if (_flushEvery && (_rowCount % *_flushEvery == 0)) {
    flush();
  }
}

// Raw JSI entry point for appendRow([val1, val2, ...]).
// Called directly by JSI — args[0] is the JS array, no Nitro conversion.
jsi::Value HybridAppender::appendRowRaw(jsi::Runtime& rt, const jsi::Value& /*thisVal*/,
                                        const jsi::Value* args, size_t count) {
  if (count < 1 || !args[0].isObject()) {
    throw jsi::JSError(rt, "[DuckDB] appendRow expects an array argument");
  }
  ensureOpen();

  auto arr = args[0].getObject(rt).getArray(rt);
  size_t len = arr.size(rt);

  _appender->BeginRow();
  for (size_t i = 0; i < len; i++) {
    appendJSIValue(rt, arr.getValueAtIndex(rt, i));
  }
  _appender->EndRow();
  _rowCount++;

  if (_flushEvery && (_rowCount % *_flushEvery == 0)) {
    flush();
  }

  return jsi::Value::undefined();
}

// Raw JSI entry point for appendRows([[row1], [row2], ...]).
// Reads column count from the first row and processes all rows in a tight loop.
jsi::Value HybridAppender::appendRowsRaw(jsi::Runtime& rt, const jsi::Value& /*thisVal*/,
                                         const jsi::Value* args, size_t count) {
  if (count < 1 || !args[0].isObject()) {
    throw jsi::JSError(rt, "[DuckDB] appendRows expects an array argument");
  }
  ensureOpen();

  auto rows = args[0].getObject(rt).getArray(rt);
  size_t rowCount = rows.size(rt);
  if (rowCount == 0) return jsi::Value::undefined();

  // Get column count from first row
  auto firstRow = rows.getValueAtIndex(rt, 0).getObject(rt).getArray(rt);
  size_t colCount = firstRow.size(rt);

  // Process first row
  appendJSIRow(rt, firstRow, colCount);

  // Process remaining rows
  for (size_t r = 1; r < rowCount; r++) {
    auto row = rows.getValueAtIndex(rt, r).getObject(rt).getArray(rt);
    appendJSIRow(rt, row, colCount);
  }

  return jsi::Value::undefined();
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
