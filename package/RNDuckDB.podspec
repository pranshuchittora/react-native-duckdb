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

  # Build DuckDB from source at pod-install time.
  # Creates DuckDB.xcframework with all configured extensions statically linked.
  s.prepare_command = <<-CMD
    bash scripts/build-duckdb-ios.sh #{min_ios_version_supported}
  CMD

  s.source_files = [
    # Objective-C++ platform init
    "ios/**/*.{h,hpp,m,mm}",
    # C++ implementation
    "cpp/**/*.{h,hpp,c,cpp}",
  ]

  # Vendor the pre-built DuckDB xcframework
  s.vendored_frameworks = "duckdb/build-ios/DuckDB.xcframework"

  # DuckDB headers and our C++ headers must be private — the massive DuckDB C++
  # headers break Swift/C++ interop if exposed through the umbrella header.
  s.private_header_files = [
    "cpp/**/*.{h,hpp}"
  ]

  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++',
    :WARNING_CFLAGS => '-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized -Wno-deprecated-declarations -Wno-unused-variable -Wno-unused-function -Wno-sign-compare -Wno-unused-parameter -Wno-missing-field-initializers',
    "HEADER_SEARCH_PATHS" => '"$(PODS_TARGET_SRCROOT)/duckdb/src/include" "$(PODS_TARGET_SRCROOT)/cpp"',
  }

  load 'nitrogen/generated/ios/RNDuckDB+autolinking.rb'
  add_nitrogen_files(s)

  # Override nitrogen's public headers: only keep the Swift-Cxx bridge as public.
  # All other C++ headers (DuckDB, HybridDuckDBSpec, etc.) must be private to
  # prevent them from appearing in the umbrella header, where they break
  # Xcode 26's C++ module system.
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
