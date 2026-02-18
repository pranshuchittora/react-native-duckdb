#pragma once
#include <string>

namespace margelo::nitro::rnduckdb {

inline std::string resolvePath(const std::string& docPath, const std::string& path) {
  if (path == ":memory:" || path.empty()) return ":memory:";
  if (path[0] == '/') return path;
  return docPath + "/" + path;
}

} // namespace margelo::nitro::rnduckdb
