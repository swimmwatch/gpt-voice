cmake_minimum_required(VERSION 3.25)

project(local_whisper_fs_guard LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/LocalWhisperHardening.cmake")
include("${CMAKE_CURRENT_LIST_DIR}/../cmake/LocalWhisperFuzzing.cmake")

option(FS_GUARD_ENABLE_SANITIZERS "Enable platform-supported sanitizers (ASan + UBSan on Linux; ASan on MSVC)" OFF)
option(FS_GUARD_ENABLE_FUZZING "Build Linux-only libFuzzer request parsing targets" OFF)
set(FS_GUARD_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin" CACHE PATH
    "Directory containing the production fs-guard executable")
set(LOCAL_WHISPER_GOOGLETEST_SOURCE "" CACHE PATH
    "Verified GoogleTest complete source root")
local_whisper_configure_msvc_stl_debug_level()
local_whisper_configure_sanitizer_graph(FS_GUARD_ENABLE_SANITIZERS)

add_library(fs_guard_core STATIC
  src/common/bounded_line_reader.cpp
  src/common/command.cpp
  src/common/error.cpp
  src/common/guard_application.cpp
  src/common/model_launch_error.cpp
  src/common/model_launch_request.cpp
  src/common/protocol.cpp
  src/common/validation.cpp
)
target_include_directories(fs_guard_core PUBLIC include ../common/include)
local_whisper_apply_compile_hardening(fs_guard_core FS_GUARD_ENABLE_SANITIZERS)

if(FS_GUARD_ENABLE_FUZZING)
  local_whisper_configure_linux_libfuzzer(FS_GUARD_ENABLE_SANITIZERS)
  add_executable(fs_guard_fuzz_contracts fuzz/fuzz_contracts.cpp)
  target_link_libraries(fs_guard_fuzz_contracts PRIVATE fs_guard_core)
  local_whisper_apply_compile_hardening(fs_guard_fuzz_contracts FS_GUARD_ENABLE_SANITIZERS)
  add_executable(fs_guard_request_fuzz fuzz/request_fuzz.cpp)
  target_link_libraries(fs_guard_request_fuzz PRIVATE fs_guard_core)
  local_whisper_add_linux_libfuzzer_target(fs_guard_request_fuzz FS_GUARD_ENABLE_SANITIZERS)
endif()

add_library(local_whisper_common_sha256 STATIC ../common/src/sha256.cpp)
target_include_directories(local_whisper_common_sha256 PUBLIC ../common/include)
local_whisper_apply_compile_hardening(local_whisper_common_sha256 FS_GUARD_ENABLE_SANITIZERS)

add_library(local_whisper_authority_records STATIC
  ../common/src/model_authority.cpp
)
target_include_directories(local_whisper_authority_records PUBLIC ../common/include)
target_link_libraries(local_whisper_authority_records PUBLIC local_whisper_common_sha256)
local_whisper_apply_compile_hardening(local_whisper_authority_records FS_GUARD_ENABLE_SANITIZERS)

if(WIN32)
  target_sources(local_whisper_authority_records PRIVATE
    ../common/src/windows_process_identity.cpp
  )
  add_library(fs_guard_platform STATIC
    src/platform/windows/cng_sha256.cpp
    src/platform/windows/windows_backend.cpp
    src/platform/windows/windows_model_authority_server.cpp
    src/platform/windows/windows_model_launch_application.cpp
  )
  target_link_libraries(fs_guard_platform
    PUBLIC fs_guard_core local_whisper_authority_records advapi32 bcrypt)
else()
  add_library(fs_guard_platform STATIC
    src/platform/linux/linux_backend.cpp
    src/platform/linux/model_launch_application.cpp
    src/platform/linux/model_authority_server.cpp
    ../common/src/linux_process_identity.cpp
  )
  target_link_libraries(fs_guard_platform PUBLIC fs_guard_core local_whisper_authority_records)
endif()
target_include_directories(fs_guard_platform PUBLIC include PRIVATE src)
local_whisper_apply_compile_hardening(fs_guard_platform FS_GUARD_ENABLE_SANITIZERS)

add_executable(fs-guard src/main.cpp)
target_include_directories(fs-guard PRIVATE src)
target_link_libraries(fs-guard PRIVATE fs_guard_platform)
local_whisper_apply_compile_hardening(fs-guard FS_GUARD_ENABLE_SANITIZERS)
local_whisper_apply_executable_hardening(fs-guard)
set_target_properties(fs-guard PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${FS_GUARD_OUTPUT_DIRECTORY}"
)

include(CTest)
if(BUILD_TESTING)
  if(NOT EXISTS "${LOCAL_WHISPER_GOOGLETEST_SOURCE}/CMakeLists.txt")
    message(FATAL_ERROR "LOCAL_WHISPER_GOOGLETEST_SOURCE must be the verified source root")
  endif()
  set(BUILD_GMOCK OFF CACHE BOOL "" FORCE)
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  set(GTEST_HAS_ABSL OFF CACHE BOOL "" FORCE)
  add_subdirectory("${LOCAL_WHISPER_GOOGLETEST_SOURCE}"
                   "${CMAKE_BINARY_DIR}/verified-googletest" EXCLUDE_FROM_ALL)
  local_whisper_apply_google_test_sanitizer_policy(FS_GUARD_ENABLE_SANITIZERS)

  add_executable(fs_guard_unit_tests
    tests/unit/command_test.cpp
    tests/unit/dispatch_test.cpp
    tests/unit/model_launch_error_test.cpp
    tests/unit/model_launch_request_test.cpp
    tests/unit/protocol_test.cpp
    tests/unit/raii_test.cpp
  )
  target_include_directories(fs_guard_unit_tests PRIVATE src)
  target_link_libraries(fs_guard_unit_tests PRIVATE fs_guard_core GTest::gtest_main)
  local_whisper_apply_test_compile_hardening(fs_guard_unit_tests FS_GUARD_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(fs_guard_unit_tests)

  add_executable(fs_guard_integration_tests
    tests/integration/backend_integration_test.cpp
  )
  target_include_directories(fs_guard_integration_tests PRIVATE src)
  target_include_directories(fs_guard_integration_tests PRIVATE ../common/tests)
  target_link_libraries(fs_guard_integration_tests PRIVATE fs_guard_platform
                                                            GTest::gtest_main)
  local_whisper_apply_test_compile_hardening(fs_guard_integration_tests FS_GUARD_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(fs_guard_integration_tests)

  include(GoogleTest)
  gtest_discover_tests(fs_guard_unit_tests
    PROPERTIES LABELS unit
    DISCOVERY_TIMEOUT 30
  )
  gtest_discover_tests(fs_guard_integration_tests
    PROPERTIES LABELS integration
    DISCOVERY_TIMEOUT 30
  )
endif()
