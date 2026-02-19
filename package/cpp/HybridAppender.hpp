#pragma once

#include "HybridAppenderSpec.hpp"
#include "types.hpp"
#include "duckdb_includes.hpp"
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

private:
  void ensureOpen();
  void appendSingleValue(const DuckDBValue& val);

  std::unique_ptr<duckdb::Appender> _appender;
  bool _closed = false;
  bool _invalidated = false;
  uint64_t _rowCount = 0;
  std::optional<uint64_t> _flushEvery;

  static constexpr auto TAG = "Appender";
};

} // namespace margelo::nitro::rnduckdb
