#include "HybridDuckDB.hpp"
#include "HybridDatabase.hpp"
#include "utils.hpp"
#include "duckdb.hpp"
#include <cstdio>
#include <stdexcept>

namespace margelo::nitro::rnduckdb {

std::string HybridDuckDB::docPath = "";

std::string HybridDuckDB::getVersion() {
  return std::string(duckdb::DuckDB::LibraryVersion());
}

std::shared_ptr<HybridDatabaseSpec> HybridDuckDB::open(
    const std::string& path,
    const std::unordered_map<std::string, std::string>& config) {

  duckdb::DBConfig dbConfig;

  // Mobile-safe defaults via SetOptionByName (validates against compile-time capabilities)
  dbConfig.SetOptionByName("memory_limit", duckdb::Value("256MB"));
  dbConfig.options.use_temporary_directory = true;
  dbConfig.options.temporary_directory = docPath + "/.duckdb_tmp";
  // Set home_directory so duckdb_extensions(), ATTACH relative paths, and
  // extension auto-loading can find the right location on mobile.
  dbConfig.SetOptionByName("home_directory", duckdb::Value(docPath));

  // Apply user config overrides (may include threads, memory_limit, etc.)
  for (const auto& [key, value] : config) {
    dbConfig.SetOptionByName(key, duckdb::Value(value));
  }

  auto resolvedPath = resolvePath(docPath, path);

  std::shared_ptr<duckdb::DuckDB> db;
  if (resolvedPath == ":memory:") {
    db = std::make_shared<duckdb::DuckDB>(nullptr, &dbConfig);
  } else {
    db = std::make_shared<duckdb::DuckDB>(resolvedPath, &dbConfig);
  }

  auto con = std::make_unique<duckdb::Connection>(*db);

  return std::make_shared<HybridDatabase>(std::move(db), std::move(con), docPath);
}

void HybridDuckDB::deleteDatabase(const std::string& path) {
  auto resolvedPath = resolvePath(docPath, path);

  if (resolvedPath == ":memory:") {
    throw std::runtime_error("[DuckDB] Cannot delete in-memory database");
  }

  std::remove(resolvedPath.c_str());
  std::remove((resolvedPath + ".wal").c_str());
  std::remove((resolvedPath + ".tmp").c_str());
}

size_t HybridDuckDB::getExternalMemorySize() noexcept {
  return 0;
}

} // namespace margelo::nitro::rnduckdb
