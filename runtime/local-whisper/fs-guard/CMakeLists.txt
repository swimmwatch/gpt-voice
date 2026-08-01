cmake_minimum_required(VERSION 3.25)

project(local_whisper_fs_guard LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(FS_GUARD_ENABLE_SANITIZERS "Enable AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
set(FS_GUARD_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin" CACHE PATH
    "Directory containing the production fs-guard executable")

function(fs_guard_apply_quality target)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /EHsc)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Werror)
    if(FS_GUARD_ENABLE_SANITIZERS)
      target_compile_options(${target} PRIVATE -fsanitize=address,undefined
                             -fno-omit-frame-pointer)
      target_link_options(${target} PRIVATE -fsanitize=address,undefined
                          -fno-omit-frame-pointer)
    endif()
  endif()
endfunction()

add_library(fs_guard_core STATIC
  src/common/command.cpp
  src/common/error.cpp
  src/common/guard_application.cpp
  src/common/protocol.cpp
  src/common/validation.cpp
)
target_include_directories(fs_guard_core PUBLIC include)
fs_guard_apply_quality(fs_guard_core)

if(WIN32)
  add_library(fs_guard_platform STATIC
    src/platform/windows/windows_backend.cpp
  )
  target_link_libraries(fs_guard_platform PUBLIC fs_guard_core advapi32 bcrypt)
else()
  add_library(fs_guard_platform STATIC
    src/platform/linux/linux_backend.cpp
  )
  target_link_libraries(fs_guard_platform PUBLIC fs_guard_core)
endif()
target_include_directories(fs_guard_platform PUBLIC include PRIVATE src)
fs_guard_apply_quality(fs_guard_platform)

add_executable(fs-guard src/main.cpp)
target_include_directories(fs-guard PRIVATE src)
target_link_libraries(fs-guard PRIVATE fs_guard_platform)
fs_guard_apply_quality(fs-guard)
set_target_properties(fs-guard PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${FS_GUARD_OUTPUT_DIRECTORY}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${FS_GUARD_OUTPUT_DIRECTORY}"
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

  add_executable(fs_guard_unit_tests
    tests/unit/command_test.cpp
    tests/unit/dispatch_test.cpp
    tests/unit/protocol_test.cpp
    tests/unit/raii_test.cpp
  )
  target_include_directories(fs_guard_unit_tests PRIVATE src)
  target_link_libraries(fs_guard_unit_tests PRIVATE fs_guard_core GTest::gtest_main)
  fs_guard_apply_quality(fs_guard_unit_tests)

  add_executable(fs_guard_integration_tests
    tests/integration/backend_integration_test.cpp
  )
  target_include_directories(fs_guard_integration_tests PRIVATE src)
  target_include_directories(fs_guard_integration_tests PRIVATE src)
  target_link_libraries(fs_guard_integration_tests PRIVATE fs_guard_platform
                                                            GTest::gtest_main)
  fs_guard_apply_quality(fs_guard_integration_tests)

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
