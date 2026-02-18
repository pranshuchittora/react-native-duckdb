#include "HybridDatabase.hpp"

namespace margelo::nitro::rnduckdb {

bool HybridDatabase::getIsOpen() {
  return _isOpen;
}

void HybridDatabase::close() {
  if (!_isOpen) return;
  _con.reset();
  _db.reset();
  _isOpen = false;
}

void HybridDatabase::ensureOpen() {
  if (!_isOpen) {
    throw std::runtime_error("[DuckDB] Database is closed");
  }
}

size_t HybridDatabase::getExternalMemorySize() noexcept {
  return _isOpen ? (256 * 1024 * 1024) : 0;
}

} // namespace margelo::nitro::rnduckdb
