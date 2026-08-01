cmake_minimum_required(VERSION 3.25)

project(local_whisper_launcher LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS
       "Enable AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
set(LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin" CACHE PATH
    "Directory containing the production launcher executable")
set(LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/fixtures" CACHE PATH
    "Directory containing launcher-only test fixtures")

function(local_whisper_launcher_apply_quality target)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /EHsc)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Werror)
    if(LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS)
      target_compile_options(${target} PRIVATE -fsanitize=address,undefined
                             -fno-omit-frame-pointer)
      target_link_options(${target} PRIVATE -fsanitize=address,undefined
                          -fno-omit-frame-pointer)
    endif()
  endif()
endfunction()

add_library(local_whisper_launcher_core STATIC
  src/common/launch_request.cpp
  src/common/sha256.cpp
)
target_include_directories(local_whisper_launcher_core PUBLIC include)
local_whisper_launcher_apply_quality(local_whisper_launcher_core)

if(WIN32)
  add_library(local_whisper_launcher_platform STATIC
    src/platform/windows/windows_launcher.cpp
  )
else()
  add_library(local_whisper_launcher_platform STATIC
    src/platform/linux/linux_launcher.cpp
  )
endif()
target_include_directories(local_whisper_launcher_platform PUBLIC include)
target_link_libraries(local_whisper_launcher_platform PUBLIC local_whisper_launcher_core)
local_whisper_launcher_apply_quality(local_whisper_launcher_platform)

add_executable(local-whisper-launcher src/main.cpp)
target_link_libraries(local-whisper-launcher PRIVATE local_whisper_launcher_platform)
local_whisper_launcher_apply_quality(local-whisper-launcher)
set_target_properties(local-whisper-launcher PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${LOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY}"
)

include(CTest)
if(BUILD_TESTING)
  include(FetchContent)
  FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG 52eb8108c5bdec04579160ae17225d66034bd723
    GIT_SHALLOW FALSE
  )
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)

  add_executable(local_whisper_launcher_unit_tests
    tests/unit/launch_request_test.cpp
    tests/unit/sha256_test.cpp
  )
  target_link_libraries(local_whisper_launcher_unit_tests
    PRIVATE local_whisper_launcher_core GTest::gtest_main)
  local_whisper_launcher_apply_quality(local_whisper_launcher_unit_tests)

  add_executable(local-whisper-launcher-fixture-worker
    tests/fixtures/process_tree_worker.cpp
  )
  local_whisper_launcher_apply_quality(local-whisper-launcher-fixture-worker)
  set_target_properties(local-whisper-launcher-fixture-worker PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
  )

  add_executable(local-whisper-launcher-identity-fixture
    tests/fixtures/identity_probe.cpp
  )
  local_whisper_launcher_apply_quality(local-whisper-launcher-identity-fixture)
  set_target_properties(local-whisper-launcher-identity-fixture PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY}"
  )

  include(GoogleTest)
  gtest_discover_tests(local_whisper_launcher_unit_tests
    PROPERTIES LABELS unit
    DISCOVERY_TIMEOUT 30
  )
endif()
