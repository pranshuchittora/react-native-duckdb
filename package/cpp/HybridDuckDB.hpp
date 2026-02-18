#pragma once

#include "HybridDuckDBSpec.hpp"
#include <string>

namespace margelo::nitro::rnduckdb {

class HybridDuckDB : public HybridDuckDBSpec {
public:
  HybridDuckDB() : HybridObject(TAG) {}

  // Platform init sets this
  static std::string docPath;

  // HybridDuckDBSpec overrides
  std::string getVersion() override;

  // Memory tracking
  size_t getExternalMemorySize() noexcept override;

private:
  static constexpr auto TAG = "DuckDB";
};

} // namespace margelo::nitro::rnduckdb
