# DuckDB

DuckDB is now built from source via git submodule at `react-native-duckdb/duckdb/`.
The amalgamation files have been removed.

The submodule is pinned to the version specified in `DUCKDB_VERSION`.

To update:
```bash
cd duckdb
git fetch --tags
git checkout <new-tag>
cd ..
git add duckdb
```
