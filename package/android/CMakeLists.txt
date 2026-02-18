cmake_minimum_required(VERSION 3.13)
project(RNDuckDB)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

file(GLOB_RECURSE cpp_files RELATIVE ${CMAKE_SOURCE_DIR}
  "../cpp/**.cpp"
  "cpp-adapter.cpp"
)

# DuckDB amalgamation — compiled separately for build flag control
set(DUCKDB_SOURCES "${CMAKE_SOURCE_DIR}/../vendor/duckdb/duckdb.cpp")

add_library(${CMAKE_PROJECT_NAME} SHARED ${cpp_files} ${DUCKDB_SOURCES})

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNDuckDB+autolinking.cmake)

include_directories(
  ../cpp
  ../vendor/duckdb
)

# DuckDB compile definitions
target_compile_definitions(${CMAKE_PROJECT_NAME} PRIVATE
  DUCKDB_NO_THREADS=0
  DUCKDB_EXTENSION_AUTOLOAD=0
  DUCKDB_EXTENSION_AUTOINSTALL=0
)

set_target_properties(
  ${CMAKE_PROJECT_NAME} PROPERTIES
  CXX_STANDARD ${CMAKE_CXX_STANDARD}
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
find_library(LOG_LIB log)

target_link_libraries(
  ${CMAKE_PROJECT_NAME}
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
)

if (REACTNATIVE_MERGED_SO OR ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(
    ${CMAKE_PROJECT_NAME}
    ReactAndroid::reactnative
  )
else()
  target_link_libraries(
    ${CMAKE_PROJECT_NAME}
    ReactAndroid::turbomodulejsijni
    ReactAndroid::react_nativemodule_core
  )
endif()

target_compile_options(
  ${CMAKE_PROJECT_NAME}
  PRIVATE
  -fexceptions
  -frtti
  -O2
  -DONANDROID
)

# Optimize DuckDB amalgamation specifically (massive file)
set_source_files_properties(${DUCKDB_SOURCES} PROPERTIES
  COMPILE_FLAGS "-O2 -Wno-unused-variable -Wno-unused-function -Wno-sign-compare"
)
