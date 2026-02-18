#include "HybridDuckDB.hpp"
#include "duckdb.h"

namespace margelo::nitro::rnduckdb {

std::string HybridDuckDB::docPath = "";

std::string HybridDuckDB::getVersion() {
  return std::string(duckdb_library_version());
}

size_t HybridDuckDB::getExternalMemorySize() noexcept {
  return 0;
}

} // namespace margelo::nitro::rnduckdb
