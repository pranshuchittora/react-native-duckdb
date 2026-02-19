#!/bin/bash
set -euo pipefail

# Build DuckDB static libraries for iOS (device + simulator)
# and create a combined xcframework.
# Called from RNDuckDB.podspec prepare_command.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DUCKDB_DIR="${REPO_DIR}/duckdb"
BUILD_DIR="${DUCKDB_DIR}/build-ios"
JOBS="$(sysctl -n hw.ncpu)"
MIN_IOS="${1:-15.1}"

echo "=== react-native-duckdb: Building DuckDB for iOS (min=${MIN_IOS}, jobs=${JOBS}) ==="

# Step 1: Configure extensions
echo "--- Configuring extensions ---"
node "${SCRIPT_DIR}/configure-extensions.js" --duckdb-path "${DUCKDB_DIR}"

# Shared cmake flags
CMAKE_COMMON=(
  -DBUILD_SHELL=OFF
  -DBUILD_UNITTESTS=OFF
  -DBUILD_BENCHMARKS=OFF
  -DENABLE_SANITIZER=OFF
  -DENABLE_UBSAN=OFF
  -DBUILD_HTTPFS_EXTENSION=OFF
  -DEXTENSION_STATIC_BUILD=OFF
  -DBUILD_EXTENSIONS_ONLY=OFF
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_CXX_STANDARD=20
)

build_arch() {
  local PLATFORM="$1"   # iphoneos | iphonesimulator
  local ARCH="$2"       # arm64 | x86_64
  local BUILD_SUBDIR="build-ios-${PLATFORM}-${ARCH}"
  local FULL_BUILD_DIR="${DUCKDB_DIR}/${BUILD_SUBDIR}"

  echo "--- Building DuckDB for ${PLATFORM} (${ARCH}) ---"

  local SDK_PATH
  SDK_PATH="$(xcrun --sdk "${PLATFORM}" --show-sdk-path)"

  cmake -S "${DUCKDB_DIR}" -B "${FULL_BUILD_DIR}" -G "Unix Makefiles" \
    "${CMAKE_COMMON[@]}" \
    -DCMAKE_SYSTEM_NAME=iOS \
    -DCMAKE_OSX_SYSROOT="${SDK_PATH}" \
    -DCMAKE_OSX_ARCHITECTURES="${ARCH}" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET="${MIN_IOS}" \
    -DDUCKDB_EXPLICIT_PLATFORM="ios_${ARCH}" \
    2>&1 | tail -5

  cmake --build "${FULL_BUILD_DIR}" --config Release -j"${JOBS}" 2>&1 | tail -3

  # Combine all .a files into one per architecture
  local COMBINED="${FULL_BUILD_DIR}/libduckdb_combined.a"
  local ALL_LIBS=()

  # Find all .a files produced by the build
  while IFS= read -r -d '' lib; do
    ALL_LIBS+=("${lib}")
  done < <(find "${FULL_BUILD_DIR}" -name "*.a" -print0)

  if [ ${#ALL_LIBS[@]} -eq 0 ]; then
    echo "ERROR: No .a files found in ${FULL_BUILD_DIR}"
    exit 1
  fi

  echo "   Combining ${#ALL_LIBS[@]} static libraries..."
  libtool -static -o "${COMBINED}" "${ALL_LIBS[@]}" 2>/dev/null
  echo "   Combined: ${COMBINED} ($(du -h "${COMBINED}" | cut -f1))"
}

# Step 2: Build for device and simulator
build_arch "iphoneos" "arm64"
build_arch "iphonesimulator" "arm64"

# Step 3: Create xcframework
echo "--- Creating DuckDB.xcframework ---"
rm -rf "${BUILD_DIR}/DuckDB.xcframework"
mkdir -p "${BUILD_DIR}"

xcodebuild -create-xcframework \
  -library "${DUCKDB_DIR}/build-ios-iphoneos-arm64/libduckdb_combined.a" \
  -headers "${DUCKDB_DIR}/src/include" \
  -library "${DUCKDB_DIR}/build-ios-iphonesimulator-arm64/libduckdb_combined.a" \
  -headers "${DUCKDB_DIR}/src/include" \
  -output "${BUILD_DIR}/DuckDB.xcframework" \
  2>&1 | tail -3

# Step 4: Copy xcframework into package/ so CocoaPods can find it
# vendored_frameworks paths must be within the pod source tree
PACKAGE_DIR="${REPO_DIR}/package"
rm -rf "${PACKAGE_DIR}/DuckDB.xcframework"
cp -R "${BUILD_DIR}/DuckDB.xcframework" "${PACKAGE_DIR}/DuckDB.xcframework"

echo "=== DuckDB.xcframework created at ${PACKAGE_DIR}/DuckDB.xcframework ==="
