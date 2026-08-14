cmake_minimum_required(VERSION 3.25)

project(local_whisper_common LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/LocalWhisperHardening.cmake")
include("${CMAKE_CURRENT_LIST_DIR}/../cmake/LocalWhisperFuzzing.cmake")

option(LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS
       "Enable platform-supported sanitizers (ASan + UBSan on Linux; ASan on MSVC)" OFF)
option(LOCAL_WHISPER_COMMON_ENABLE_FUZZING
       "Build Linux-only libFuzzer targets for attacker-influenced common parsers" OFF)
set(FETCHCONTENT_FULLY_DISCONNECTED ON CACHE BOOL
    "Require a disconnected dependency graph")
if(NOT FETCHCONTENT_FULLY_DISCONNECTED)
  message(FATAL_ERROR "Local Whisper common builds must remain disconnected")
endif()
set(LOCAL_WHISPER_NLOHMANN_SOURCE "" CACHE PATH
    "Verified nlohmann/json explicit-subset source root")
set(LOCAL_WHISPER_GOOGLETEST_SOURCE "" CACHE PATH
    "Verified GoogleTest complete source root")
set(LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT "" CACHE PATH
    "Checked-in Local Whisper protocol fixture root")
local_whisper_configure_msvc_stl_debug_level()
local_whisper_configure_sanitizer_graph(LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)

if(NOT EXISTS "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include/nlohmann/json.hpp")
  message(FATAL_ERROR "LOCAL_WHISPER_NLOHMANN_SOURCE must be the verified subset root")
endif()

add_library(local_whisper_common STATIC
  src/bounded_json.cpp
  src/canonical_wav.cpp
  src/device_proof.cpp
  src/frame_codec.cpp
  src/model_authority.cpp
  src/native_logger.cpp
  src/sha256.cpp
)
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_sources(local_whisper_common PRIVATE
    src/authority_bootstrap.cpp
    src/linux_process_identity.cpp
  )
endif()
target_include_directories(local_whisper_common PUBLIC include)
target_include_directories(local_whisper_common SYSTEM PRIVATE "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include")
local_whisper_apply_compile_hardening(local_whisper_common LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)

if(LOCAL_WHISPER_COMMON_ENABLE_FUZZING)
  local_whisper_configure_linux_libfuzzer(LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)
  add_executable(local_whisper_common_fuzz_contracts fuzz/fuzz_contracts.cpp)
  target_link_libraries(local_whisper_common_fuzz_contracts PRIVATE local_whisper_common)
  local_whisper_apply_compile_hardening(
    local_whisper_common_fuzz_contracts LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)
  foreach(local_whisper_common_fuzz_target
      frame_codec
      bounded_json
      canonical_wav
      model_authority
      device_proof)
    add_executable(local_whisper_common_fuzz_${local_whisper_common_fuzz_target}
      fuzz/${local_whisper_common_fuzz_target}_fuzz.cpp)
    target_link_libraries(local_whisper_common_fuzz_${local_whisper_common_fuzz_target}
      PRIVATE local_whisper_common)
    local_whisper_add_linux_libfuzzer_target(
      local_whisper_common_fuzz_${local_whisper_common_fuzz_target}
      LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)
  endforeach()

  add_executable(local_whisper_common_fuzz_proof fuzz/fuzz_proof.cpp)
  local_whisper_add_linux_libfuzzer_target(
    local_whisper_common_fuzz_proof LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)
endif()

include(CTest)
if(BUILD_TESTING)
  if(NOT EXISTS "${LOCAL_WHISPER_GOOGLETEST_SOURCE}/CMakeLists.txt")
    message(FATAL_ERROR "LOCAL_WHISPER_GOOGLETEST_SOURCE must be the verified source root")
  endif()
  if(NOT EXISTS "${LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT}/manifest.json")
    message(FATAL_ERROR "LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT is required")
  endif()
  set(BUILD_GMOCK OFF CACHE BOOL "" FORCE)
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  set(GTEST_HAS_ABSL OFF CACHE BOOL "" FORCE)
  add_subdirectory("${LOCAL_WHISPER_GOOGLETEST_SOURCE}"
                   "${CMAKE_BINARY_DIR}/verified-googletest" EXCLUDE_FROM_ALL)
  local_whisper_apply_google_test_sanitizer_policy(LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)

  add_executable(local_whisper_common_tests
    tests/bounded_json_test.cpp
    tests/canonical_wav_test.cpp
    tests/device_proof_test.cpp
    tests/frame_codec_test.cpp
    tests/model_authority_test.cpp
    tests/native_logger_test.cpp
    tests/sha256_test.cpp
  )
target_include_directories(local_whisper_common_tests
  SYSTEM PRIVATE "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include")
  target_compile_definitions(local_whisper_common_tests PRIVATE
    LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT="${LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT}")
  target_link_libraries(local_whisper_common_tests
    PRIVATE local_whisper_common GTest::gtest_main)
  local_whisper_apply_test_compile_hardening(local_whisper_common_tests LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(local_whisper_common_tests)

  include(GoogleTest)
  gtest_discover_tests(local_whisper_common_tests DISCOVERY_TIMEOUT 30)
endif()
