cmake_minimum_required(VERSION 3.13)
project(RNDuckDB)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Path to DuckDB source (submodule at react-native-duckdb/duckdb/)
set(DUCKDB_SOURCE_DIR "${CMAKE_SOURCE_DIR}/../../duckdb")

# Run extension configuration script to generate extension_config_local.cmake.
# APP_ROOT_DIR is passed from build.gradle (rootProject.projectDir.parentFile).
# DUCKDB_EXTENSIONS is set from gradle.properties when Expo config plugin is used.
find_program(NODE_EXECUTABLE node REQUIRED)

set(CONFIGURE_ARGS
  ${NODE_EXECUTABLE} ${CMAKE_SOURCE_DIR}/../../scripts/configure-extensions.js
  --duckdb-path ${DUCKDB_SOURCE_DIR}
  --app-root ${APP_ROOT_DIR}
)

# When extensions are provided via gradle.properties (Expo managed workflow),
# pass them directly — this overrides package.json discovery.
if(NOT "${DUCKDB_EXTENSIONS}" STREQUAL "")
  list(APPEND CONFIGURE_ARGS --extensions "${DUCKDB_EXTENSIONS}")
endif()

execute_process(
  COMMAND ${CONFIGURE_ARGS}
  RESULT_VARIABLE CONFIGURE_RESULT
)
if(NOT CONFIGURE_RESULT EQUAL 0)
  message(FATAL_ERROR "react-native-duckdb: Extension configuration failed (exit ${CONFIGURE_RESULT})")
endif()

# DuckDB build options — disable everything we don't need on mobile
set(BUILD_SHELL OFF CACHE BOOL "" FORCE)
set(BUILD_UNITTESTS OFF CACHE BOOL "" FORCE)
set(BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
set(ENABLE_SANITIZER OFF CACHE BOOL "" FORCE)
set(ENABLE_UBSAN OFF CACHE BOOL "" FORCE)
set(EXTENSION_STATIC_BUILD OFF CACHE BOOL "" FORCE)
set(BUILD_EXTENSIONS_ONLY OFF CACHE BOOL "" FORCE)
set(DUCKDB_EXPLICIT_PLATFORM "android_${ANDROID_ABI}" CACHE STRING "" FORCE)

# Check if httpfs is in the extension config (needs OpenSSL + libcurl)
set(EXT_CONFIG_PATH "${DUCKDB_SOURCE_DIR}/extension/extension_config_local.cmake")
if(EXISTS "${EXT_CONFIG_PATH}")
  file(READ "${EXT_CONFIG_PATH}" _ext_config_content)
  if(_ext_config_content MATCHES "httpfs")
    message(STATUS "react-native-duckdb: httpfs detected, building OpenSSL + libcurl for ${ANDROID_ABI}")

    # Pass NDK path from build.gradle so the cross-compilation script can find the toolchain
    if(ANDROID_NDK_FOR_HTTPFS)
      set(ENV{ANDROID_NDK_ROOT} "${ANDROID_NDK_FOR_HTTPFS}")
    endif()

    set(VENDOR_DIR "${CMAKE_SOURCE_DIR}/../../vendor")
    execute_process(
      COMMAND bash "${CMAKE_SOURCE_DIR}/../../scripts/build-openssl-curl.sh" android "${ANDROID_ABI}"
      RESULT_VARIABLE _httpfs_deps_result
    )
    if(NOT _httpfs_deps_result EQUAL 0)
      message(FATAL_ERROR "react-native-duckdb: Failed to build OpenSSL/curl for httpfs (${ANDROID_ABI})")
    endif()

    set(OPENSSL_ROOT_DIR "${VENDOR_DIR}/openssl/android-${ANDROID_ABI}" CACHE PATH "" FORCE)
    set(OPENSSL_USE_STATIC_LIBS TRUE CACHE BOOL "" FORCE)
    set(CURL_ROOT "${VENDOR_DIR}/curl/android-${ANDROID_ABI}" CACHE PATH "" FORCE)
  endif()
endif()

# Build DuckDB from source
add_subdirectory(${DUCKDB_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/duckdb EXCLUDE_FROM_ALL)

# Our library source files
file(GLOB_RECURSE cpp_files RELATIVE ${CMAKE_SOURCE_DIR}
  "../cpp/**.cpp"
  "cpp-adapter.cpp"
)

add_library(${CMAKE_PROJECT_NAME} SHARED ${cpp_files})

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNDuckDB+autolinking.cmake)

# Include paths: DuckDB source headers + our C++ code
target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
  ${DUCKDB_SOURCE_DIR}/src/include
  ${CMAKE_SOURCE_DIR}/../cpp
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

# Link DuckDB static library + extension libraries (same pattern as DuckDB shell)
target_link_libraries(
  ${CMAKE_PROJECT_NAME}
  duckdb_static
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
)
link_extension_libraries(${CMAKE_PROJECT_NAME} PRIVATE)

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
