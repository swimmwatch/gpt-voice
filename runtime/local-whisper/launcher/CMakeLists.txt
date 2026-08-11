cmake_minimum_required(VERSION 3.25)

project(local_whisper_launcher LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/LocalWhisperHardening.cmake")

option(LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS
       "Enable platform-supported sanitizers (ASan + UBSan on Linux; ASan on MSVC)" OFF)
set(LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin" CACHE PATH
    "Directory containing the production launcher executable")
set(LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/fixtures" CACHE PATH
    "Directory containing launcher-only test fixtures")
set(LOCAL_WHISPER_GOOGLETEST_SOURCE "" CACHE PATH
    "Verified GoogleTest complete source root")
local_whisper_configure_msvc_stl_debug_level()
local_whisper_configure_sanitizer_graph(LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)

add_library(local_whisper_launcher_core STATIC
  src/common/launcher_error.cpp
  src/common/launch_request.cpp
)
target_include_directories(local_whisper_launcher_core PUBLIC include ../common/include)
add_library(local_whisper_common_sha256 STATIC ../common/src/sha256.cpp)
target_include_directories(local_whisper_common_sha256 PUBLIC ../common/include)
local_whisper_apply_compile_hardening(local_whisper_common_sha256 LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
target_link_libraries(local_whisper_launcher_core PUBLIC local_whisper_common_sha256)
local_whisper_apply_compile_hardening(local_whisper_launcher_core LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)

add_library(local_whisper_authority_records STATIC
  ../common/src/model_authority.cpp
)
target_include_directories(local_whisper_authority_records PUBLIC ../common/include)
target_link_libraries(local_whisper_authority_records PUBLIC local_whisper_common_sha256)
local_whisper_apply_compile_hardening(local_whisper_authority_records LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)

if(WIN32)
  target_sources(local_whisper_authority_records PRIVATE
    ../common/src/windows_process_identity.cpp
  )
  add_library(local_whisper_launcher_platform STATIC
    src/platform/windows/windows_launcher.cpp
    src/platform/windows/windows_model_authority_client.cpp
  )
else()
  add_library(local_whisper_launcher_platform STATIC
    src/platform/linux/linux_launcher.cpp
    src/platform/linux/model_authority_client.cpp
    ../common/src/authority_bootstrap.cpp
    ../common/src/linux_process_identity.cpp
  )
endif()
target_include_directories(local_whisper_launcher_platform PUBLIC include)
target_link_libraries(local_whisper_launcher_platform
  PUBLIC local_whisper_launcher_core local_whisper_authority_records)
local_whisper_apply_compile_hardening(local_whisper_launcher_platform LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)

add_executable(local-whisper-launcher src/main.cpp)
target_link_libraries(local-whisper-launcher PRIVATE local_whisper_launcher_platform)
local_whisper_apply_compile_hardening(local-whisper-launcher LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
local_whisper_apply_executable_hardening(local-whisper-launcher)
set_target_properties(local-whisper-launcher PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
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
  local_whisper_apply_google_test_sanitizer_policy(LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)

  add_executable(local_whisper_launcher_unit_tests
    tests/unit/launcher_error_test.cpp
    tests/unit/launch_request_test.cpp
  )
  target_link_libraries(local_whisper_launcher_unit_tests
    PRIVATE local_whisper_launcher_core GTest::gtest_main)
  local_whisper_apply_test_compile_hardening(local_whisper_launcher_unit_tests LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(local_whisper_launcher_unit_tests)

  add_executable(local-whisper-launcher-fixture-worker
    tests/fixtures/process_tree_worker.cpp
  )
  local_whisper_apply_compile_hardening(local-whisper-launcher-fixture-worker LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(local-whisper-launcher-fixture-worker)
  set_target_properties(local-whisper-launcher-fixture-worker PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
  )

  add_executable(local-whisper-launcher-identity-fixture
    tests/fixtures/identity_probe.cpp
  )
  local_whisper_apply_compile_hardening(local-whisper-launcher-identity-fixture LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(local-whisper-launcher-identity-fixture)
  set_target_properties(local-whisper-launcher-identity-fixture PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
  )

  add_executable(local-whisper-authority-worker-fixture
    tests/fixtures/authority_worker.cpp
  )
  target_link_libraries(local-whisper-authority-worker-fixture
    PRIVATE local_whisper_launcher_platform)
  local_whisper_apply_compile_hardening(local-whisper-authority-worker-fixture LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
  local_whisper_apply_executable_hardening(local-whisper-authority-worker-fixture)
  set_target_properties(local-whisper-authority-worker-fixture PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
  )

  if(CMAKE_SYSTEM_NAME STREQUAL "Linux")

    add_executable(local_whisper_launcher_integration_tests
      tests/integration/model_authority_handoff_test.cpp
      ../fs-guard/src/platform/linux/model_authority_server.cpp
    )
    target_include_directories(local_whisper_launcher_integration_tests
      PRIVATE ../fs-guard/include)
    target_compile_definitions(local_whisper_launcher_integration_tests PRIVATE
      LOCAL_WHISPER_AUTHORITY_WORKER_FIXTURE="$<TARGET_FILE:local-whisper-authority-worker-fixture>")
    target_link_libraries(local_whisper_launcher_integration_tests
      PRIVATE local_whisper_launcher_platform GTest::gtest_main)
    local_whisper_apply_test_compile_hardening(local_whisper_launcher_integration_tests LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
    local_whisper_apply_executable_hardening(local_whisper_launcher_integration_tests)
  endif()

  include(GoogleTest)
  gtest_discover_tests(local_whisper_launcher_unit_tests
    PROPERTIES LABELS unit
    DISCOVERY_TIMEOUT 30
  )
  if(TARGET local_whisper_launcher_integration_tests)
    gtest_discover_tests(local_whisper_launcher_integration_tests
      PROPERTIES LABELS integration
      DISCOVERY_TIMEOUT 30
    )
  endif()
endif()
