#include "HybridStreamingResult.hpp"

namespace margelo::nitro::rnduckdb {

HybridStreamingResult::HybridStreamingResult(
    std::unique_ptr<duckdb::QueryResult> result,
    std::unique_ptr<duckdb::Connection> ownedConnection)
    : HybridObject(TAG),
      _stream(std::move(result)),
      _ownedConnection(std::move(ownedConnection)) {

  for (auto& name : _stream->names) {
    _columnNames.push_back(name);
  }
  for (auto& type : _stream->types) {
    _columnTypes.push_back(type.ToString());
    _logicalTypes.push_back(type);
  }
}

bool HybridStreamingResult::getIsDone() {
  return _isDone;
}

double HybridStreamingResult::getColumnCount() {
  return static_cast<double>(_columnNames.size());
}

std::vector<std::string> HybridStreamingResult::getColumnNames() {
  return _columnNames;
}

std::vector<std::string> HybridStreamingResult::getColumnTypes() {
  return _columnTypes;
}

std::shared_ptr<HybridQueryResultSpec> HybridStreamingResult::fetchNextChunk() {
  std::lock_guard<std::mutex> lock(_mutex);
  if (_isDone || _closed) return nullptr;

  auto dataChunk = _stream->FetchRaw();
  if (!dataChunk || dataChunk->size() == 0) {
    _isDone = true;
    // Auto-close on exhaustion (release resources but don't lock again)
    _closed = true;
    _stream.reset();
    _ownedConnection.reset();
    return nullptr;
  }

  auto chunkSize = dataChunk->size();
  auto colCount = _logicalTypes.size();

  std::vector<std::vector<DuckDBValue>> columns(colCount);
  for (size_t c = 0; c < colCount; c++) {
    columns[c].reserve(chunkSize);
  }

  HybridQueryResult::materializeChunk(*dataChunk, _logicalTypes, columns);

  return std::make_shared<HybridQueryResult>(
    chunkSize, _columnNames, _columnTypes, std::move(columns));
}

std::shared_ptr<Promise<std::optional<std::shared_ptr<HybridQueryResultSpec>>>>
HybridStreamingResult::fetchChunk() {
  return Promise<std::optional<std::shared_ptr<HybridQueryResultSpec>>>::async(
    [this]() -> std::optional<std::shared_ptr<HybridQueryResultSpec>> {
      auto chunk = fetchNextChunk();
      if (!chunk) return std::nullopt;
      return chunk;
    });
}

void HybridStreamingResult::onChunk(
    const std::function<void(const std::shared_ptr<HybridQueryResultSpec>&)>& callback) {
  _onChunkCallback = callback;
}

std::shared_ptr<Promise<void>> HybridStreamingResult::start() {
  if (!_onChunkCallback) {
    throw std::runtime_error("[DuckDB] Must call onChunk() before start()");
  }

  auto callback = _onChunkCallback;

  return Promise<void>::async([this, callback]() {
    while (true) {
      auto chunk = fetchNextChunk();
      if (!chunk) break;
      callback(chunk);
    }
  });
}

void HybridStreamingResult::close() {
  std::lock_guard<std::mutex> lock(_mutex);
  if (_closed) return;
  _closed = true;
  _isDone = true;
  _stream.reset();
  _ownedConnection.reset();
}

size_t HybridStreamingResult::getExternalMemorySize() noexcept {
  return _closed ? 0 : (1024 * 1024);
}

} // namespace margelo::nitro::rnduckdb
