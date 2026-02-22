#pragma once

#include "HybridDuckDBSpec.hpp"
#include "HybridDatabase.hpp"
#include <string>
#include <memory>
#include <unordered_map>

namespace margelo::nitro::rnduckdb {

class HybridDuckDB : public HybridDuckDBSpec {
public:
  HybridDuckDB() : HybridObject(TAG) {}

  static std::string docPath;
  static std::string documentsDir;
  static std::string libraryDir;
  static std::string databaseDir;
  static std::string externalDir;

  // HybridDuckDBSpec overrides
  std::string getVersion() override;
  std::string getDocumentsPath() override;
  std::string getLibraryPath() override;
  std::string getDatabasePath() override;
  std::string getExternalStoragePath() override;
  std::string getDefaultPath() override;
  std::shared_ptr<HybridDatabaseSpec> open(const std::string& path, const std::unordered_map<std::string, std::string>& config) override;
  void deleteDatabase(const std::string& path) override;

  size_t getExternalMemorySize() noexcept override;

private:
  static constexpr auto TAG = "DuckDB";
};

} // namespace margelo::nitro::rnduckdb
