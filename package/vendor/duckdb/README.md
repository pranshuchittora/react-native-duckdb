# DuckDB Amalgamation

This directory contains the DuckDB amalgamation files (duckdb.cpp, duckdb.hpp, duckdb.h).

**These files are gitignored** because they are 30-50MB uncompressed.

To download/update the amalgamation:

```bash
./scripts/download-duckdb.sh          # defaults to v1.4.4
./scripts/download-duckdb.sh v1.5.0   # specific version
```

The VERSION file tracks the currently downloaded version.
