require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNDuckDB"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["repository"]["url"]
  s.license      = package["license"]
  s.authors      = "pranshu"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => package["repository"]["url"], :tag => "#{s.version}" }

  s.source_files = [
    # Objective-C++ platform init
    "ios/**/*.{h,hpp,m,mm}",
    # C++ implementation
    "cpp/**/*.{h,hpp,c,cpp}",
    # DuckDB amalgamation
    "vendor/duckdb/duckdb.cpp",
    "vendor/duckdb/duckdb.hpp",
    "vendor/duckdb/duckdb.h"
  ]

  # DuckDB headers and our C++ headers must be private — the massive DuckDB C++
  # headers break Swift/C++ interop if exposed through the umbrella header.
  # By marking ALL .hpp/.h files as private, they won't appear in the umbrella header.
  s.private_header_files = [
    "vendor/duckdb/duckdb.hpp",
    "vendor/duckdb/duckdb.h",
    "cpp/**/*.{h,hpp}"
  ]

  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++',
    :GCC_PREPROCESSOR_DEFINITIONS => '$(inherited) DUCKDB_NO_THREADS=0 DUCKDB_EXTENSION_AUTOLOAD=0 DUCKDB_EXTENSION_AUTOINSTALL=0',
    :WARNING_CFLAGS => '-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized -Wno-deprecated-declarations -Wno-unused-variable -Wno-unused-function -Wno-sign-compare -Wno-unused-parameter -Wno-missing-field-initializers',
    "HEADER_SEARCH_PATHS" => '"$(PODS_TARGET_SRCROOT)/vendor/duckdb" "$(PODS_TARGET_SRCROOT)/cpp"',
  }

  load 'nitrogen/generated/ios/RNDuckDB+autolinking.rb'
  add_nitrogen_files(s)

  # Override nitrogen's public headers: only keep the Swift-Cxx bridge as public.
  # All other C++ headers (DuckDB amalgamation, HybridDuckDBSpec, etc.) must be
  # private to prevent them from appearing in the umbrella header, where they
  # break Xcode 26's C++ module system.
  s.public_header_files = [
    "nitrogen/generated/ios/RNDuckDB-Swift-Cxx-Bridge.hpp",
  ]
  current_private = Array(s.attributes_hash['private_header_files'])
  s.private_header_files = current_private + [
    "nitrogen/generated/shared/**/*.{h,hpp}",
    "nitrogen/generated/ios/c++/**/*.{h,hpp}",
  ]

  install_modules_dependencies(s)
end
