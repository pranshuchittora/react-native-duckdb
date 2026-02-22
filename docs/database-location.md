# Database Location

Control where DuckDB database files are stored on iOS and Android.

## Default Location

When you open a database with a relative path, it resolves against the app's default documents directory:

```ts
import { HybridDuckDB } from 'react-native-duckdb'

// Relative path — stored in the default documents directory
const db = HybridDuckDB.open('myapp.duckdb', {})
```

The default directory is `NSDocumentDirectory` on iOS and `getFilesDir()` on Android.

## Available Paths

Five readonly properties expose platform-specific storage directories:

| Property | iOS | Android | Backed Up |
|----------|-----|---------|-----------|
| `documentsPath` | `NSDocumentDirectory` | `getFilesDir()` | iCloud ✅ / Auto Backup ✅ |
| `libraryPath` | `NSLibraryDirectory` | `getFilesDir()` | **No** ❌ / Auto Backup ✅ |
| `databasePath` | `NSDocumentDirectory` | `getDatabasePath()` parent | iCloud ✅ / Auto Backup ✅ |
| `externalStoragePath` | `""` (N/A) | `getExternalFilesDir(null)` | No ❌ |
| `defaultPath` | Same as `documentsPath` | Same as `documentsPath` | — |

Access them directly on the `HybridDuckDB` object:

```ts
console.log(HybridDuckDB.documentsPath) // /var/mobile/.../Documents
console.log(HybridDuckDB.libraryPath)   // /var/mobile/.../Library
```

## Named Constants

For convenience, named constants are also exported from the package root:

```ts
import {
  DOCUMENTS_PATH,
  LIBRARY_PATH,
  DATABASE_PATH,
  EXTERNAL_STORAGE_PATH,
  DEFAULT_PATH,
} from 'react-native-duckdb'
```

These are evaluated at module load time and hold the same values as the `HybridDuckDB` properties.

## Usage Examples

### Default (Relative Path)

```ts
// Stored in documentsPath — simplest option
const db = HybridDuckDB.open('analytics.duckdb', {})
```

### iOS Library Directory (No iCloud Backup)

```ts
import { HybridDuckDB } from 'react-native-duckdb'

const path = `${HybridDuckDB.libraryPath}/analytics.duckdb`
const db = HybridDuckDB.open(path, {})
```

Use `libraryPath` for large databases that can be regenerated — avoids consuming the user's iCloud storage quota.

### Android External Storage with Fallback

```ts
import { HybridDuckDB } from 'react-native-duckdb'

const dir = HybridDuckDB.externalStoragePath || HybridDuckDB.documentsPath
const db = HybridDuckDB.open(`${dir}/large_dataset.duckdb`, {})
```

`externalStoragePath` returns an empty string on iOS and when external storage is unavailable on Android.

### In-Memory Database

```ts
const db = HybridDuckDB.open(':memory:', {})
// No file is created on disk
```

## iCloud Backup (iOS)

By default, files in `NSDocumentDirectory` (`documentsPath`) are included in iCloud backups. For large databases that can be regenerated, consider:

1. **Use `libraryPath`** — `NSLibraryDirectory` is excluded from iCloud backup by default. This is the recommended approach for most apps.

2. **Per-file exclusion** — If you must store in Documents, you can exclude individual files from backup using [`NSURLIsExcludedFromBackupKey`](https://developer.apple.com/documentation/foundation/nsurl/1408364-isexcludedfrombackupkey). This requires native code and is outside the scope of this library.

> **Recommendation:** Use `libraryPath` for databases that hold cached or regenerable data. Use `documentsPath` only for user-created content that should survive device restore.

## Android Auto Backup

On Android, files in `getFilesDir()` (`documentsPath` / `libraryPath`) are included in [Auto Backup](https://developer.android.com/identity/data/autobackup) by default. To exclude specific paths:

1. Set `android:allowBackup="false"` in your `AndroidManifest.xml` to disable all auto-backup.

2. Or create a `backup_rules.xml` to selectively exclude paths:

```xml
<!-- res/xml/backup_rules.xml -->
<full-backup-content>
  <exclude domain="file" path="large_cache.duckdb" />
</full-backup-content>
```

Then reference it in your manifest:

```xml
<application android:fullBackupContent="@xml/backup_rules" ...>
```

Files in `getExternalFilesDir()` (`externalStoragePath`) are **not** included in auto-backup.

## Path Evaluation Timing

All path values are resolved at app startup (during native module initialization) and remain constant for the app's lifetime. They are safe to read synchronously at any point after the module loads.
