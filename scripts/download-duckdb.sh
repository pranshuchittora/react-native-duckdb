#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-v1.4.4}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$ROOT_DIR/package/vendor/duckdb"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading DuckDB $VERSION amalgamation..."

URL="https://github.com/duckdb/duckdb/releases/download/${VERSION}/libduckdb-src.zip"
curl -fsSL -o "$TMP_DIR/libduckdb-src.zip" "$URL"

echo "Extracting..."
unzip -qo "$TMP_DIR/libduckdb-src.zip" -d "$TMP_DIR/src"

mkdir -p "$VENDOR_DIR"

cp "$TMP_DIR/src/duckdb.cpp" "$VENDOR_DIR/duckdb.cpp"
cp "$TMP_DIR/src/duckdb.hpp" "$VENDOR_DIR/duckdb.hpp"
cp "$TMP_DIR/src/duckdb.h" "$VENDOR_DIR/duckdb.h"

echo "$VERSION" > "$VENDOR_DIR/DUCKDB_VERSION"

echo ""
echo "DuckDB $VERSION amalgamation downloaded to $VENDOR_DIR"
echo "File sizes:"
ls -lh "$VENDOR_DIR/duckdb.cpp" "$VENDOR_DIR/duckdb.hpp" "$VENDOR_DIR/duckdb.h"
