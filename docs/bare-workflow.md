# Bare Workflow Setup

This guide covers setup for bare React Native projects (no Expo managed workflow). For Expo projects, see [expo.md](expo.md).

## Installation

```bash
# npm
npm install react-native-duckdb react-native-nitro-modules

# yarn
yarn add react-native-duckdb react-native-nitro-modules

# bun
bun add react-native-duckdb react-native-nitro-modules
```

Then install iOS pods:

```bash
cd ios && pod install
```

## Configure extensions

Extensions are configured in your app's `package.json` under the `react-native-duckdb` key:

```json
{
  "name": "my-app",
  "dependencies": { ... },
  "react-native-duckdb": {
    "build": {
      "extensions": ["core_functions", "parquet", "json"]
    }
  }
}
```

The default is **no extensions**. You must explicitly list every extension you need. Invalid names cause a build error with a clear message.

> `core_functions` is strongly recommended. Without it, common SQL functions like `sum()`, `avg()`, `list_value()`, and `uuid()` are unavailable.

### Available extensions

| Extension | Description |
|-----------|-------------|
| `core_functions` | Essential SQL functions -- **strongly recommended** |
| `parquet` | Apache Parquet file format |
| `json` | JSON file format |
| `icu` | Unicode collation and locale-aware text |
| `sqlite_scanner` | Read/write SQLite databases via ATTACH |
| `httpfs` | Remote file access over HTTPS ([details](remote-data.md)) |
| `fts` | BM25 full-text search ([details](fts.md)) |
| `vss` | HNSW vector similarity search ([details](vss.md)) |
| `autocomplete` | SQL autocomplete suggestions |
| `tpch` | TPC-H benchmark data generator |
| `tpcds` | TPC-DS benchmark data generator |
| `delta` | Delta Lake table format |

## iOS build

### What happens during `pod install`

1. CocoaPods runs the `prepare_command` in `RNDuckDB.podspec`
2. The prepare command executes `scripts/build-duckdb-ios.sh`
3. The build script reads extensions from your `package.json` (via `scripts/configure-extensions.js`)
4. `configure-extensions.js` generates `duckdb/extension/extension_config_local.cmake`
5. CMake compiles DuckDB from source with selected extensions statically linked
6. The script builds for both device (`arm64`) and simulator (`arm64`), then creates a combined `DuckDB.xcframework`
7. The xcframework is vendored into the pod as a static library

The first build takes several minutes due to DuckDB compilation. Subsequent builds are cached unless the extension config changes.

### iOS-specific notes

- DuckDB is compiled with `-DCMAKE_BUILD_TYPE=Release` regardless of your app's debug/release scheme
- iOS prohibits dynamic loading (`dlopen`) -- all extensions are statically linked
- If `httpfs` is included, OpenSSL and libcurl are also compiled from source and linked into the xcframework. The podspec automatically adds `Security.framework`, `SystemConfiguration.framework`, and `libz` linker flags.

## Android build

### What happens during Gradle build

1. Gradle reads the `RNDuckDB` library's `build.gradle`, which includes the CMake external native build
2. CMake runs `scripts/configure-extensions.js` with `--app-root` pointing to your project root
3. The script reads extensions from your `package.json` and generates `extension_config_local.cmake`
4. DuckDB is compiled from source via CMake with the NDK toolchain
5. Extensions are statically linked into the final `.so` library
6. The build runs for each ABI target (typically `arm64-v8a` and `x86_64`)

DuckDB is always compiled with `-O3 -DNDEBUG` (Release optimizations) even for debug app builds, via a CMake wrapper subdirectory. Without this, debug builds would be ~30x slower.

### Android-specific notes

- Default ABI targets: `armeabi-v7a`, `x86`, `x86_64`, `arm64-v8a`. Override with `reactNativeArchitectures` in `gradle.properties`.
- If `httpfs` is enabled, 32-bit ABIs (`armeabi-v7a`, `x86`) are automatically skipped for the httpfs extension. The rest of DuckDB still builds for all ABIs.
- If `vss` is enabled, an `aligned_alloc` workaround is applied for Android API levels below 28.

## Changing extensions

After changing the `extensions` array in `package.json`, you must do a clean rebuild:

### iOS

```bash
# Remove cached DuckDB builds
rm -rf node_modules/react-native-duckdb/duckdb/build-ios*

# Remove the cached xcframework
rm -rf node_modules/react-native-duckdb/package/DuckDB.xcframework

# Reinstall pods (triggers rebuild)
cd ios && pod install
```

### Android

```bash
# Remove CMake build cache
rm -rf android/.cxx

# Rebuild
npx react-native run-android
```

### Both platforms (nuclear option)

```bash
rm -rf node_modules/react-native-duckdb/duckdb/build-ios*
rm -rf node_modules/react-native-duckdb/package/DuckDB.xcframework
rm -rf android/.cxx
cd ios && pod install
```

## Verify extensions

After building, verify which extensions are available at runtime:

```sql
SELECT extension_name, loaded, installed FROM duckdb_extensions();
```

Extensions in your build config will show `installed = true`. Use `LOAD 'extension_name'` as a no-op to confirm availability (it succeeds silently for statically-linked extensions, throws for missing ones).

## Troubleshooting

### "DuckDB source not found"

The DuckDB source is a git submodule. Initialize it:

```bash
cd node_modules/react-native-duckdb
git submodule update --init
```

### "Unknown extension" build error

Check for typos in your `package.json` extension list. Run `configure-extensions.js --help` to see valid names.

### iOS build takes too long

The first build compiles DuckDB from C++ source (~2-5 minutes depending on hardware). Builds are cached automatically. Only changing extensions triggers a recompilation.

### Android build fails with 32-bit errors

If you see httpfs-related errors on 32-bit ABIs, this is expected. Either:
- Remove `httpfs` from your extensions, or
- Limit ABIs to 64-bit in `android/gradle.properties`: `reactNativeArchitectures=arm64-v8a,x86_64`

---

*Part of [react-native-duckdb](../README.md) -- see [expo.md](expo.md) for Expo managed workflow setup.*
