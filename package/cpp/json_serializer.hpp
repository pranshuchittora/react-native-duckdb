#pragma once

#include "duckdb_includes.hpp"
#include <string>
#include <sstream>

namespace margelo::nitro::rnduckdb {

inline std::string escapeJsonString(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 8);
  for (char c : s) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(c));
          out += buf;
        } else {
          out += c;
        }
    }
  }
  return out;
}

inline std::string valueToJson(const duckdb::Value& val) {
  if (val.IsNull()) return "null";

  switch (val.type().id()) {
    case duckdb::LogicalTypeId::LIST: {
      auto& children = duckdb::ListValue::GetChildren(val);
      std::string result = "[";
      for (duckdb::idx_t i = 0; i < children.size(); i++) {
        if (i > 0) result += ",";
        result += valueToJson(children[i]);
      }
      return result + "]";
    }
    case duckdb::LogicalTypeId::ARRAY: {
      auto& children = duckdb::ArrayValue::GetChildren(val);
      std::string result = "[";
      for (duckdb::idx_t i = 0; i < children.size(); i++) {
        if (i > 0) result += ",";
        result += valueToJson(children[i]);
      }
      return result + "]";
    }
    case duckdb::LogicalTypeId::STRUCT: {
      auto& children = duckdb::StructValue::GetChildren(val);
      auto& childTypes = duckdb::StructType::GetChildTypes(val.type());
      std::string result = "{";
      for (duckdb::idx_t i = 0; i < children.size(); i++) {
        if (i > 0) result += ",";
        result += "\"" + escapeJsonString(childTypes[i].first) + "\":";
        result += valueToJson(children[i]);
      }
      return result + "}";
    }
    case duckdb::LogicalTypeId::MAP: {
      auto& entries = duckdb::ListValue::GetChildren(val);
      std::string result = "[";
      for (duckdb::idx_t i = 0; i < entries.size(); i++) {
        if (i > 0) result += ",";
        auto& entryChildren = duckdb::StructValue::GetChildren(entries[i]);
        result += "{\"key\":" + valueToJson(entryChildren[0]);
        result += ",\"value\":" + valueToJson(entryChildren[1]) + "}";
      }
      return result + "]";
    }
    case duckdb::LogicalTypeId::UNION: {
      auto tag = duckdb::UnionValue::GetTag(val);
      auto& tagName = duckdb::UnionType::GetMemberName(val.type(), tag);
      auto memberVal = duckdb::UnionValue::GetValue(val);
      return "{\"tag\":\"" + escapeJsonString(tagName) +
             "\",\"value\":" + valueToJson(memberVal) + "}";
    }
    case duckdb::LogicalTypeId::VARCHAR: {
      return "\"" + escapeJsonString(duckdb::StringValue::Get(val)) + "\"";
    }
    case duckdb::LogicalTypeId::BOOLEAN: {
      return duckdb::BooleanValue::Get(val) ? "true" : "false";
    }
    case duckdb::LogicalTypeId::SQLNULL: {
      return "null";
    }
    case duckdb::LogicalTypeId::BLOB: {
      auto& blobStr = duckdb::StringValue::Get(val);
      std::string hex = "\\x";
      for (unsigned char c : blobStr) {
        char buf[4];
        snprintf(buf, sizeof(buf), "%02x", c);
        hex += buf;
      }
      return "\"" + hex + "\"";
    }
    case duckdb::LogicalTypeId::TINYINT:
    case duckdb::LogicalTypeId::SMALLINT:
    case duckdb::LogicalTypeId::INTEGER:
    case duckdb::LogicalTypeId::BIGINT:
    case duckdb::LogicalTypeId::UTINYINT:
    case duckdb::LogicalTypeId::USMALLINT:
    case duckdb::LogicalTypeId::UINTEGER:
    case duckdb::LogicalTypeId::UBIGINT:
    case duckdb::LogicalTypeId::HUGEINT:
    case duckdb::LogicalTypeId::UHUGEINT:
    case duckdb::LogicalTypeId::FLOAT:
    case duckdb::LogicalTypeId::DOUBLE:
    case duckdb::LogicalTypeId::DECIMAL: {
      return val.ToString();
    }
    default: {
      return "\"" + escapeJsonString(val.ToString()) + "\"";
    }
  }
}

} // namespace margelo::nitro::rnduckdb
