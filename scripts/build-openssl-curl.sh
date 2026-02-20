#!/bin/bash
set -euo pipefail

# Cross-compile OpenSSL and libcurl for iOS and Android targets.
# Usage: build-openssl-curl.sh <platform> <arch>
#   platform: ios | android
#   arch: arm64, simulator-arm64 (iOS), arm64-v8a, x86_64 (Android)
#
# Output: vendor/openssl/{platform}-{arch}/ and vendor/curl/{platform}-{arch}/
# Cached: skip rebuild if output exists with matching version marker.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENDOR_DIR="${REPO_DIR}/vendor"
SRC_DIR="${VENDOR_DIR}/src"

OPENSSL_VERSION="3.4.1"
CURL_VERSION="8.12.1"

OPENSSL_URL="https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL_VERSION}/openssl-${OPENSSL_VERSION}.tar.gz"
CURL_URL="https://curl.se/download/curl-${CURL_VERSION}.tar.gz"

usage() {
  echo "Usage: $0 <platform> <arch>"
  echo ""
  echo "Cross-compile OpenSSL ${OPENSSL_VERSION} + libcurl ${CURL_VERSION} for mobile targets."
  echo ""
  echo "Platforms and architectures:"
  echo "  ios     arm64            (iPhone device)"
  echo "  ios     simulator-arm64  (iPhone Simulator on Apple Silicon)"
  echo "  android arm64-v8a        (Android 64-bit ARM)"
  echo "  android x86_64           (Android 64-bit x86, emulator)"
  echo ""
  echo "Output: vendor/openssl/{platform}-{arch}/ and vendor/curl/{platform}-{arch}/"
  echo ""
  echo "Environment variables (Android only):"
  echo "  ANDROID_NDK_ROOT   Path to Android NDK"
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

PLATFORM="$1"
ARCH="$2"
TARGET="${PLATFORM}-${ARCH}"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"

OPENSSL_OUT="${VENDOR_DIR}/openssl/${TARGET}"
CURL_OUT="${VENDOR_DIR}/curl/${TARGET}"

# Check cache: skip if already built with same version
check_cache() {
  local out_dir="$1"
  local version="$2"
  local marker="${out_dir}/.version"
  if [ -f "$marker" ] && [ "$(cat "$marker")" = "$version" ]; then
    return 0
  fi
  return 1
}

write_version_marker() {
  local out_dir="$1"
  local version="$2"
  echo "$version" > "${out_dir}/.version"
}

# Download source tarball if not cached
download_source() {
  local url="$1"
  local filename="$2"
  local dest="${SRC_DIR}/${filename}"

  mkdir -p "${SRC_DIR}"
  if [ -f "$dest" ]; then
    echo "   Using cached ${filename}"
    return
  fi
  echo "   Downloading ${filename}..."
  curl -fSL "$url" -o "$dest"
}

# Extract source to a build directory
extract_source() {
  local tarball="${SRC_DIR}/$1"
  local dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  tar xzf "$tarball" -C "$dest" --strip-components=1
}

###############################################################################
# OpenSSL cross-compilation
###############################################################################

build_openssl() {
  if check_cache "$OPENSSL_OUT" "$OPENSSL_VERSION"; then
    echo "--- OpenSSL ${OPENSSL_VERSION} for ${TARGET}: cached, skipping ---"
    return
  fi

  echo "--- Building OpenSSL ${OPENSSL_VERSION} for ${TARGET} ---"
  download_source "$OPENSSL_URL" "openssl-${OPENSSL_VERSION}.tar.gz"

  local BUILD_TMP="${VENDOR_DIR}/_build/openssl-${TARGET}"
  extract_source "openssl-${OPENSSL_VERSION}.tar.gz" "$BUILD_TMP"

  local CONFIGURE_TARGET=""
  local EXTRA_FLAGS=()

  case "$TARGET" in
    ios-arm64)
      CONFIGURE_TARGET="ios64-xcrun"
      EXTRA_FLAGS=("-miphoneos-version-min=15.1")
      ;;
    ios-simulator-arm64)
      CONFIGURE_TARGET="iossimulator-xcrun"
      EXTRA_FLAGS=("-miphonesimulator-version-min=15.1")
      ;;
    android-arm64-v8a)
      [ -z "${ANDROID_NDK_ROOT:-}" ] && { echo "ERROR: ANDROID_NDK_ROOT not set"; exit 1; }
      CONFIGURE_TARGET="android-arm64"
      EXTRA_FLAGS=("-D__ANDROID_API__=24")
      export PATH="${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin:${PATH}"
      ;;
    android-x86_64)
      [ -z "${ANDROID_NDK_ROOT:-}" ] && { echo "ERROR: ANDROID_NDK_ROOT not set"; exit 1; }
      CONFIGURE_TARGET="android-x86_64"
      EXTRA_FLAGS=("-D__ANDROID_API__=24")
      export PATH="${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)/bin:${PATH}"
      ;;
    *)
      echo "ERROR: Unsupported target ${TARGET} for OpenSSL"
      exit 1
      ;;
  esac

  pushd "$BUILD_TMP" > /dev/null

  ./Configure "$CONFIGURE_TARGET" \
    no-asm no-shared no-tests no-ui-console \
    --prefix="${OPENSSL_OUT}" \
    -fvisibility=hidden \
    "${EXTRA_FLAGS[@]}" \
    2>&1 | tail -5

  make -j"$JOBS" 2>&1 | tail -3
  make install_sw 2>&1 | tail -3

  popd > /dev/null

  write_version_marker "$OPENSSL_OUT" "$OPENSSL_VERSION"
  rm -rf "$BUILD_TMP"
  echo "   OpenSSL installed to ${OPENSSL_OUT}"
}

###############################################################################
# libcurl cross-compilation (CMake-based)
###############################################################################

build_curl() {
  if check_cache "$CURL_OUT" "$CURL_VERSION"; then
    echo "--- libcurl ${CURL_VERSION} for ${TARGET}: cached, skipping ---"
    return
  fi

  echo "--- Building libcurl ${CURL_VERSION} for ${TARGET} ---"
  download_source "$CURL_URL" "curl-${CURL_VERSION}.tar.gz"

  local BUILD_TMP="${VENDOR_DIR}/_build/curl-${TARGET}"
  local BUILD_BIN="${BUILD_TMP}/_cmake_build"
  extract_source "curl-${CURL_VERSION}.tar.gz" "$BUILD_TMP"
  mkdir -p "$BUILD_BIN"

  local CMAKE_ARGS=(
    -DBUILD_SHARED_LIBS=OFF
    -DBUILD_CURL_EXE=OFF
    -DBUILD_TESTING=OFF
    -DCURL_USE_OPENSSL=ON
    -DOPENSSL_ROOT_DIR="${OPENSSL_OUT}"
    -DOPENSSL_USE_STATIC_LIBS=TRUE
    -DCURL_DISABLE_LDAP=ON
    -DCURL_DISABLE_LDAPS=ON
    -DHTTP_ONLY=ON
    -DCMAKE_INSTALL_PREFIX="${CURL_OUT}"
    -DCMAKE_BUILD_TYPE=Release
    -DCMAKE_C_FLAGS="-fvisibility=hidden"
  )

  case "$TARGET" in
    ios-arm64)
      CMAKE_ARGS+=(
        -DCMAKE_SYSTEM_NAME=iOS
        -DCMAKE_OSX_SYSROOT="$(xcrun --sdk iphoneos --show-sdk-path)"
        -DCMAKE_OSX_ARCHITECTURES=arm64
        -DCMAKE_OSX_DEPLOYMENT_TARGET=15.1
      )
      ;;
    ios-simulator-arm64)
      CMAKE_ARGS+=(
        -DCMAKE_SYSTEM_NAME=iOS
        -DCMAKE_OSX_SYSROOT="$(xcrun --sdk iphonesimulator --show-sdk-path)"
        -DCMAKE_OSX_ARCHITECTURES=arm64
        -DCMAKE_OSX_DEPLOYMENT_TARGET=15.1
      )
      ;;
    android-arm64-v8a)
      CMAKE_ARGS+=(
        -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK_ROOT}/build/cmake/android.toolchain.cmake"
        -DANDROID_ABI=arm64-v8a
        -DANDROID_PLATFORM=android-24
      )
      ;;
    android-x86_64)
      CMAKE_ARGS+=(
        -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK_ROOT}/build/cmake/android.toolchain.cmake"
        -DANDROID_ABI=x86_64
        -DANDROID_PLATFORM=android-24
      )
      ;;
    *)
      echo "ERROR: Unsupported target ${TARGET} for libcurl"
      exit 1
      ;;
  esac

  cmake -S "$BUILD_TMP" -B "$BUILD_BIN" "${CMAKE_ARGS[@]}" 2>&1 | tail -5
  cmake --build "$BUILD_BIN" --config Release -j"$JOBS" 2>&1 | tail -3
  cmake --install "$BUILD_BIN" 2>&1 | tail -3

  write_version_marker "$CURL_OUT" "$CURL_VERSION"
  rm -rf "$BUILD_TMP"
  echo "   libcurl installed to ${CURL_OUT}"
}

###############################################################################
# Main
###############################################################################

echo "=== react-native-duckdb: Building OpenSSL + libcurl for ${TARGET} ==="
build_openssl
build_curl
echo "=== Done: OpenSSL + libcurl for ${TARGET} ==="
