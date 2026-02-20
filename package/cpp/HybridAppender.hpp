#pragma once

#include "HybridAppenderSpec.hpp"
#include "types.hpp"
#include "duckdb_includes.hpp"
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <optional>

namespace margelo::nitro::rnduckdb {

class HybridAppender : public HybridAppenderSpec {
public:
  HybridAppender(duckdb::Connection& con, const std::string& table,
                 std::optional<double> flushEvery);

  ~HybridAppender() override {
    try {
      close();
    } catch (...) {
      // safety net — don't throw from destructor
    }
  }

  void appendRow(const std::vector<DuckDBValue>& values) override;
  void appendRows(const std::vector<std::vector<DuckDBValue>>& rows) override;
  void appendColumns(const std::vector<std::vector<DuckDBValue>>& columns) override;
  void flush() override;
  void close() override;

  size_t getExternalMemorySize() noexcept override;

protected:
  // Override to register raw JSI methods that shadow the typed Nitro methods
  // for appendRow/appendRows — see HybridAppender.cpp for details.
  void loadHybridMethods() override;

private:
  void ensureOpen();

  // Typed path: receives values already converted by Nitro's JSIConverter<variant>
  void appendSingleValue(const DuckDBValue& val);

  // Raw JSI path: reads jsi::Value directly, skipping variant allocation.
  // appendJSIValue handles the type dispatch (null/bool/number/string/bigint/blob).
  // appendJSIRow wraps a single row with BeginRow/EndRow + flush bookkeeping.
  void appendJSIValue(jsi::Runtime& rt, const jsi::Value& val);
  void appendJSIRow(jsi::Runtime& rt, const jsi::Array& row, size_t colCount);

  // Raw JSI entry points registered via registerRawHybridMethod. These receive
  // (runtime, thisVal, args*, count) directly from JSI — no Nitro conversion step.
  jsi::Value appendRowRaw(jsi::Runtime& rt, const jsi::Value& thisVal,
                          const jsi::Value* args, size_t count);
  jsi::Value appendRowsRaw(jsi::Runtime& rt, const jsi::Value& thisVal,
                           const jsi::Value* args, size_t count);

  std::unique_ptr<duckdb::Appender> _appender;
  bool _closed = false;
  bool _invalidated = false;
  uint64_t _rowCount = 0;
  std::optional<uint64_t> _flushEvery;

  static constexpr auto TAG = "Appender";
};

} // namespace margelo::nitro::rnduckdb
