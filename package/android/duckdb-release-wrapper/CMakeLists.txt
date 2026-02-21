# Wrapper that forces Release-level optimizations for DuckDB, even in debug builds.
#
# Problem: Android Gradle Plugin maps debug app builds → CMAKE_BUILD_TYPE=Debug,
# which makes DuckDB compile at -O0 -g -DDEBUG. This causes ~30x slower queries
# compared to iOS (where DuckDB.xcframework is always pre-built at -O3).
#
# Solution: add_compile_options is directory-scoped in CMake — it applies to all
# targets defined in this directory and its subdirectories (i.e. DuckDB) but NOT
# to targets in the parent directory (i.e. RNDuckDB). Compilers use the last -O
# flag on the command line, so our -O3 overrides the -O0 from CMAKE_CXX_FLAGS_DEBUG.
# NDEBUG disables assert() calls inside DuckDB.
add_compile_options(-O3 -DNDEBUG)

# VSS extension workaround: usearch library calls aligned_alloc() which requires
# Android API 28+. We target API 24. Force-include a shim header that provides
# aligned_alloc via posix_memalign (available since API 16).
# Directory-scoped: only affects DuckDB + extensions, not RNDuckDB.
if(_VSS_ENABLED)
  add_compile_options(-include "${CMAKE_CURRENT_SOURCE_DIR}/aligned_alloc_shim.h")
endif()

set(DUCKDB_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../duckdb")
add_subdirectory(${DUCKDB_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/duckdb)
