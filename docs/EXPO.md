# Expo Config Plugin Guide

This guide covers the react-native-duckdb Expo config plugin — how it works internally, how to configure it, and how to troubleshoot common issues.

## Quick Start

Add the plugin to your `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "plugins": [
      ["react-native-duckdb", { "extensions": ["core_functions", "parquet"] }]
    ]
  }
}
```

Then run:

```bash
npx expo prebuild --clean
```

That's it. The plugin writes extension configuration into native property files, and the build pipeline picks them up automatically.

## How It Works

The plugin bridges Expo's JavaScript config with the native DuckDB build pipeline. Here's the full flow:

1. **User configures** extensions in `app.json` (or `app.config.js`)
2. **Plugin runs** during `expo prebuild`, writing extension names to platform-specific property files
3. **Build scripts read** the property files and pass extensions to `configure-extensions.js`
4. **`configure-extensions.js` generates** `extension_config_local.cmake` for DuckDB's build system
5. **DuckDB compiles** with selected extensions statically linked into the native binary

The plugin uses only safe Expo mods (`withGradleProperties` and `createBuildPodfilePropsConfigPlugin`) — no dangerous modifications to native files.

## Configuration

### `DuckDBPluginProps`

```ts
type DuckDBPluginProps = {
  extensions?: string[];
};
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `extensions` | `string[]` | `undefined` | Extensions to statically link into the DuckDB binary |

### Available Extensions

| Extension | Description |
|-----------|-------------|
| `core_functions` | Essential SQL functions (sum, avg, list_value, uuid, etc.) — **strongly recommended** |
| `parquet` | Apache Parquet file format support |
| `json` | JSON file format support |
| `icu` | Unicode collation and locale-aware text functions |
| `sqlite_scanner` | Read and write SQLite databases via ATTACH |
| `autocomplete` | SQL autocomplete suggestions |
| `tpch` | TPC-H benchmark data generator |
| `tpcds` | TPC-DS benchmark data generator |
| `delta` | Delta Lake table format |
| `httpfs` | Remote file access over HTTPS (requires 64-bit Android ABIs) |

### Example Configurations

**No extensions** (valid, but you'll lose common SQL functions):

```json
["react-native-duckdb"]
```

**Recommended minimum:**

```json
["react-native-duckdb", { "extensions": ["core_functions"] }]
```

**Common setup** (analytics + file queries):

```json
["react-native-duckdb", { "extensions": ["core_functions", "parquet", "json"] }]
```

**Full setup** (analytics + files + SQLite interop + locale):

```json
["react-native-duckdb", { "extensions": ["core_functions", "parquet", "json", "icu", "sqlite_scanner"] }]
```

## Extension Flow — Android

```
app.json
  └─ plugins: [["react-native-duckdb", { extensions: ["core_functions", "parquet"] }]]
       │
       ▼
Expo plugin (withAndroid.ts)
  └─ withGradleProperties → writes RNDuckDB_extensions=core_functions,parquet
       │
       ▼
android/gradle.properties
  └─ RNDuckDB_extensions=core_functions,parquet
       │
       ▼
android/build.gradle
  └─ Reads RNDuckDB_extensions → passes -DDUCKDB_EXTENSIONS=core_functions,parquet to CMake
       │
       ▼
android/CMakeLists.txt
  └─ If DUCKDB_EXTENSIONS is set → passes --extensions "core_functions,parquet" to configure-extensions.js
       │
       ▼
scripts/configure-extensions.js
  └─ Generates duckdb/extension/extension_config_local.cmake with duckdb_extension_load() calls
       │
       ▼
DuckDB CMake build
  └─ Reads extension_config_local.cmake → statically links selected extensions
```

## Extension Flow — iOS

```
app.json
  └─ plugins: [["react-native-duckdb", { extensions: ["core_functions", "parquet"] }]]
       │
       ▼
Expo plugin (withIos.ts)
  └─ createBuildPodfilePropsConfigPlugin → writes react-native-duckdb.extensions=core_functions,parquet
       │
       ▼
ios/Podfile.properties.json
  └─ { "react-native-duckdb.extensions": "core_functions,parquet" }
       │
       ▼
scripts/build-duckdb-ios.sh (runs during pod install)
  └─ Reads Podfile.properties.json → extracts react-native-duckdb.extensions value
       │
       ▼
scripts/configure-extensions.js --extensions "core_functions,parquet"
  └─ Generates duckdb/extension/extension_config_local.cmake
       │
       ▼
DuckDB CMake + xcframework build
  └─ Statically links selected extensions into the iOS binary
```

## Migration Guide

Moving from bare workflow `package.json` config to Expo `app.json` config.

### Step 1: Add the plugin to app.json

```json
{
  "expo": {
    "plugins": [
      ["react-native-duckdb", { "extensions": ["core_functions", "parquet"] }]
    ]
  }
}
```

Use the same extensions you had in `package.json`.

### Step 2: Remove package.json config (optional)

You can remove the `react-native-duckdb` key from your app's `package.json`:

```diff
-  "react-native-duckdb": {
-    "build": {
-      "extensions": ["core_functions", "parquet"]
-    }
-  }
```

This is optional — when both exist, the `app.json` config takes priority via the `--extensions` flag, which overrides `package.json` discovery in `configure-extensions.js`.

### Step 3: Regenerate native projects

```bash
npx expo prebuild --clean
```

Verify the extensions appear in the generated files:

- **Android:** `grep RNDuckDB_extensions android/gradle.properties`
- **iOS:** `cat ios/Podfile.properties.json | grep react-native-duckdb`

## Bare Workflow Compatibility

The Expo config plugin **only runs during `expo prebuild`**. It has no effect on bare React Native projects.

- **Expo managed workflow:** Extensions configured in `app.json` → plugin writes property files → build scripts read them
- **Bare workflow:** Extensions configured in `package.json` → `configure-extensions.js` reads `package.json` directly (unchanged from before)
- **Both configured:** `app.json` takes priority (the `--extensions` flag overrides `package.json` discovery)

If you eject from Expo, the property files written by the plugin remain in your native directories and continue to work. You can also switch to `package.json` config after ejecting.

## Troubleshooting

### "Unknown extension" error

The extension name is not in the valid list. Check for typos:

```
Valid: core_functions, parquet, json, icu, sqlite_scanner, autocomplete, tpch, tpcds, delta
```

### Extensions not building after prebuild

1. Verify `expo prebuild` ran successfully (no errors)
2. Check `android/gradle.properties` contains `RNDuckDB_extensions=...`
3. Check `ios/Podfile.properties.json` contains `"react-native-duckdb.extensions": "..."`
4. If missing, ensure the plugin is listed in `app.json` plugins array

### Build cache issues

DuckDB caches build artifacts. If extensions seem stale after changing config:

```bash
# Clean iOS build cache
rm -rf duckdb/build-ios*

# Clean Android build cache
rm -rf android/.cxx

# Regenerate native projects
npx expo prebuild --clean
```

### Monorepo issues

The plugin resolves from the app's `node_modules`. Ensure `react-native-duckdb` is in your app's direct dependencies (not just hoisted to the workspace root):

```bash
# In your app directory
npm install react-native-duckdb
```

### Plugin not found / ERR_PACKAGE_PATH_NOT_EXPORTED

The package exports `./app.plugin.js` explicitly. If you see resolution errors:

1. Delete `node_modules` and reinstall
2. Verify `react-native-duckdb` version includes the plugin (check `node_modules/react-native-duckdb/app.plugin.js` exists)

## For Contributors

### Plugin Source

```
package/plugin/
  src/
    index.ts        — Main plugin entry, composes Android + iOS, wraps with createRunOncePlugin
    withAndroid.ts  — Writes RNDuckDB_extensions to gradle.properties
    withIos.ts      — Writes react-native-duckdb.extensions to Podfile.properties.json
    types.ts        — DuckDBPluginProps type definition
  build/            — Compiled CommonJS output (committed for npm publish)
  tsconfig.json     — Separate CommonJS config targeting Node.js
```

The entry point is `package/app.plugin.js` which requires `./plugin/build`.

### Building the Plugin

```bash
bun run build:plugin
# or
npx tsc --project plugin/tsconfig.json
```

The compiled output in `plugin/build/` is committed to git (despite the `build/` gitignore pattern) because it's needed for npm publish — consumers don't have TypeScript at prebuild time.

### Testing

Scaffold a temporary Expo app and run prebuild:

```bash
npx create-expo-app /tmp/test-app --template blank-typescript
cd /tmp/test-app
npm install /path/to/react-native-duckdb/package

# Edit app.json to add the plugin with extensions
npx expo prebuild --clean --no-install

# Verify output
grep RNDuckDB_extensions android/gradle.properties
cat ios/Podfile.properties.json

# Clean up
rm -rf /tmp/test-app
```

### Architecture Notes

- Uses only **safe Expo mods** — `withGradleProperties` (Android) and `createBuildPodfilePropsConfigPlugin` (iOS). No dangerous mods that modify Podfiles, AppDelegates, or build.gradle directly.
- `createRunOncePlugin` wrapper ensures idempotent execution (safe if user accidentally lists plugin twice).
- The `propValueGetter` API on `createBuildPodfilePropsConfigPlugin` returns `undefined` to omit the property (not an empty string), so no extensions = no property file entry.

---

*Part of [react-native-duckdb](../README.md) — see [API Reference](API.md) for the full API.*
