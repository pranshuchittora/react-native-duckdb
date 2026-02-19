#pragma once

// Core DuckDB headers (the source tree's duckdb.hpp only includes 4 files)
#include "duckdb.hpp"

// Additional headers needed for our implementation that the amalgamation
// included transitively but the source tree does not.
#include "duckdb/common/types/data_chunk.hpp"
#include "duckdb/common/types/vector.hpp"
#include "duckdb/common/types/decimal.hpp"
#include "duckdb/common/types/hugeint.hpp"
#include "duckdb/common/types/column/column_data_collection.hpp"
#include "duckdb/common/types/column/column_data_scan_states.hpp"
#include "duckdb/main/materialized_query_result.hpp"
#include "duckdb/main/prepared_statement.hpp"
#include "duckdb/main/client_context.hpp"
#include "duckdb/common/types/value.hpp"
