cmake_minimum_required(VERSION 3.25)

project(local_whisper_whisper_cpp LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(FETCHCONTENT_FULLY_DISCONNECTED ON CACHE BOOL "Require disconnected native builds")
if(NOT FETCHCONTENT_FULLY_DISCONNECTED)
  message(FATAL_ERROR "Local Whisper native builds must remain disconnected")
endif()

option(LOCAL_WHISPER_ENABLE_SANITIZERS "Enable ASan and UBSan" OFF)
option(LOCAL_WHISPER_BUILD_ENGINE "Build the production Whisper.cpp worker" OFF)
option(LOCAL_WHISPER_BUILD_DIRECT_ENGINE "Build the qualification-only direct engine" OFF)
option(LOCAL_WHISPER_BUILD_TESTS "Build project-owned GoogleTest suites" ON)
set(LOCAL_WHISPER_SOURCE_ROOT "" CACHE PATH "Strictly patched Whisper.cpp source root")
set(LOCAL_WHISPER_GENERATED_INCLUDE_DIR "" CACHE PATH "Generated reviewed loader limits")
set(LOCAL_WHISPER_NLOHMANN_SOURCE "" CACHE PATH "Verified nlohmann/json subset")
set(LOCAL_WHISPER_GOOGLETEST_SOURCE "" CACHE PATH "Verified GoogleTest source")
set(LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT "" CACHE PATH "Checked-in worker protocol fixtures")
set(LOCAL_WHISPER_WORKER_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin" CACHE PATH
    "Production worker output directory")
set(LOCAL_WHISPER_DIRECT_ENGINE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qualification-bin" CACHE PATH
    "Qualification-only direct engine output directory")
set(LOCAL_WHISPER_RUNTIME_BUILD_DIGEST "" CACHE STRING "Authenticated worker build digest")
set(LOCAL_WHISPER_BACKEND_ID "cpu" CACHE STRING "Locked worker backend")
set_property(CACHE LOCAL_WHISPER_BACKEND_ID PROPERTY STRINGS cpu cuda hip vulkan)
if(NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "cpu" AND
   NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "cuda" AND
   NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "hip" AND
   NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "vulkan")
  message(FATAL_ERROR "LOCAL_WHISPER_BACKEND_ID must be cpu, cuda, hip, or vulkan")
endif()
if(CMAKE_SYSTEM_NAME STREQUAL "Windows" AND LOCAL_WHISPER_BACKEND_ID STREQUAL "hip")
  message(FATAL_ERROR "Windows HIP is unsupported")
elseif(LOCAL_WHISPER_BACKEND_ID STREQUAL "hip")
  message(FATAL_ERROR "Linux HIP is unavailable because no exact pre-signing row is approved")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows" AND LOCAL_WHISPER_BACKEND_ID STREQUAL "vulkan")
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-windows-x64-vulkan-preview-v1")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows" AND LOCAL_WHISPER_BACKEND_ID STREQUAL "cuda")
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows")
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-windows-x64-cpu-v1")
elseif(LOCAL_WHISPER_BACKEND_ID STREQUAL "vulkan")
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-linux-x64-vulkan-preview-v1")
elseif(LOCAL_WHISPER_BACKEND_ID STREQUAL "cuda")
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1")
else()
  set(LOCAL_WHISPER_RUNTIME_REVISION "whisper-cpp-linux-x64-cpu-baseline-v1")
endif()
string(LENGTH "${LOCAL_WHISPER_RUNTIME_BUILD_DIGEST}" LOCAL_WHISPER_RUNTIME_BUILD_DIGEST_LENGTH)
if(NOT LOCAL_WHISPER_RUNTIME_BUILD_DIGEST MATCHES "^[a-f0-9]+$" OR
   NOT LOCAL_WHISPER_RUNTIME_BUILD_DIGEST_LENGTH EQUAL 64)
  message(FATAL_ERROR "LOCAL_WHISPER_RUNTIME_BUILD_DIGEST must be an exact SHA-256")
endif()

foreach(required_file
        "${LOCAL_WHISPER_GENERATED_INCLUDE_DIR}/local_whisper_loader_limits.hpp"
        "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include/nlohmann/json.hpp")
  if(NOT EXISTS "${required_file}")
    message(FATAL_ERROR "Missing verified Local Whisper native input: ${required_file}")
  endif()
endforeach()

function(local_whisper_apply_quality target)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /EHsc)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Werror)
    if(LOCAL_WHISPER_ENABLE_SANITIZERS)
      target_compile_options(${target} PRIVATE -fsanitize=address,undefined
                             -fno-omit-frame-pointer)
      target_link_options(${target} PRIVATE -fsanitize=address,undefined
                          -fno-omit-frame-pointer)
    endif()
  endif()
endfunction()

add_library(local_whisper_worker_common STATIC
  ../common/src/bounded_json.cpp
  ../common/src/canonical_wav.cpp
  ../common/src/device_proof.cpp
  ../common/src/frame_codec.cpp
  ../common/src/model_authority.cpp
  ../common/src/sha256.cpp
)
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_sources(local_whisper_worker_common PRIVATE
    ../common/src/authority_bootstrap.cpp
    ../common/src/linux_process_identity.cpp
  )
endif()
target_include_directories(local_whisper_worker_common
  PUBLIC ../common/include
  PRIVATE "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include")
local_whisper_apply_quality(local_whisper_worker_common)

add_library(local_whisper_whisper_cpp_core STATIC
  amd/amd_preview.cpp
  core/cancellation.cpp
  core/cpu_probe.cpp
  core/error.cpp
  core/exact_model_reader.cpp
  core/loader_limits.cpp
  core/model_format_preflight.cpp
  core/pcm_audio.cpp
  core/worker_application.cpp
  device/device_authority.cpp
  device/device_registry.cpp
)
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  target_sources(local_whisper_whisper_cpp_core PRIVATE
    core/model_authority_linux.cpp
    core/worker_protocol_posix.cpp
    device/device_authority_posix.cpp
  )
elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows")
  target_sources(local_whisper_whisper_cpp_core PRIVATE
    platform/windows/model_authority_windows.cpp
    platform/windows/device_authority_windows.cpp
    platform/windows/worker_protocol_windows.cpp
  )
endif()
target_include_directories(local_whisper_whisper_cpp_core
  PUBLIC include
  PUBLIC "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include"
  PRIVATE "${LOCAL_WHISPER_GENERATED_INCLUDE_DIR}")
target_compile_definitions(local_whisper_whisper_cpp_core PUBLIC
  LOCAL_WHISPER_RUNTIME_BUILD_DIGEST="${LOCAL_WHISPER_RUNTIME_BUILD_DIGEST}"
  LOCAL_WHISPER_RUNTIME_REVISION="${LOCAL_WHISPER_RUNTIME_REVISION}"
  LOCAL_WHISPER_BACKEND_ID="${LOCAL_WHISPER_BACKEND_ID}")
target_link_libraries(local_whisper_whisper_cpp_core PUBLIC local_whisper_worker_common)
local_whisper_apply_quality(local_whisper_whisper_cpp_core)

if(LOCAL_WHISPER_BUILD_ENGINE OR LOCAL_WHISPER_BUILD_DIRECT_ENGINE)
  if(NOT EXISTS "${LOCAL_WHISPER_SOURCE_ROOT}/include/whisper.h")
    message(FATAL_ERROR "LOCAL_WHISPER_SOURCE_ROOT must be the strictly patched source tree")
  endif()
  if(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND LOCAL_WHISPER_BACKEND_ID STREQUAL "cuda")
    # NVCC otherwise embeds a process-derived tmpxft source name in every CUDA
    # object. Keeping intermediates beside each object gives them a stable name
    # without retaining the intermediates or changing generated device code.
    add_compile_options("$<$<COMPILE_LANGUAGE:CUDA>:--objdir-as-tempdir>")
  endif()
  add_subdirectory("${LOCAL_WHISPER_SOURCE_ROOT}" "${CMAKE_BINARY_DIR}/whisper-cpp" EXCLUDE_FROM_ALL)

  add_library(local_whisper_whisper_cpp_adapter STATIC adapter/whisper_engine.cpp)
  target_include_directories(local_whisper_whisper_cpp_adapter PRIVATE
    include
    "${LOCAL_WHISPER_SOURCE_ROOT}/include"
    "${LOCAL_WHISPER_SOURCE_ROOT}/ggml/include")
  target_link_libraries(local_whisper_whisper_cpp_adapter
    PUBLIC local_whisper_whisper_cpp_core
    PRIVATE whisper ggml)
  local_whisper_apply_quality(local_whisper_whisper_cpp_adapter)

  if(LOCAL_WHISPER_BUILD_ENGINE)
    add_executable(local-whisper-whisper-cpp-worker core/main.cpp)
    target_link_libraries(local-whisper-whisper-cpp-worker
      PRIVATE local_whisper_whisper_cpp_adapter)
    local_whisper_apply_quality(local-whisper-whisper-cpp-worker)
    set_target_properties(local-whisper-whisper-cpp-worker PROPERTIES
      RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_WORKER_OUTPUT_DIRECTORY}"
      RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_WORKER_OUTPUT_DIRECTORY}"
      RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_WORKER_OUTPUT_DIRECTORY}")
    if(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "cpu")
      target_link_options(local-whisper-whisper-cpp-worker PRIVATE
        "LINKER:--disable-new-dtags,-rpath,$ORIGIN:$ORIGIN/../lib")
    endif()
  endif()

  if(LOCAL_WHISPER_BUILD_DIRECT_ENGINE)
    if(NOT CMAKE_SYSTEM_NAME STREQUAL "Linux")
  message(FATAL_ERROR "Representative direct-engine execution is Linux-only")
    endif()
    add_library(local_whisper_qualification_protocol STATIC
      qualification/qualification_protocol.cpp)
    target_include_directories(local_whisper_qualification_protocol
      PUBLIC include
      PRIVATE "${LOCAL_WHISPER_NLOHMANN_SOURCE}/single_include")
    target_link_libraries(local_whisper_qualification_protocol
      PUBLIC local_whisper_whisper_cpp_core)
    local_whisper_apply_quality(local_whisper_qualification_protocol)

    add_executable(local-whisper-whisper-cpp-direct-engine
      qualification/direct_engine_main.cpp)
    target_link_libraries(local-whisper-whisper-cpp-direct-engine
      PRIVATE local_whisper_whisper_cpp_adapter local_whisper_qualification_protocol)
    local_whisper_apply_quality(local-whisper-whisper-cpp-direct-engine)
    set_target_properties(local-whisper-whisper-cpp-direct-engine PROPERTIES
      RUNTIME_OUTPUT_DIRECTORY "${LOCAL_WHISPER_DIRECT_ENGINE_OUTPUT_DIRECTORY}"
      RUNTIME_OUTPUT_DIRECTORY_DEBUG "${LOCAL_WHISPER_DIRECT_ENGINE_OUTPUT_DIRECTORY}"
      RUNTIME_OUTPUT_DIRECTORY_RELEASE "${LOCAL_WHISPER_DIRECT_ENGINE_OUTPUT_DIRECTORY}")
    if(NOT LOCAL_WHISPER_BACKEND_ID STREQUAL "cpu")
      target_link_options(local-whisper-whisper-cpp-direct-engine PRIVATE
        "LINKER:--disable-new-dtags,-rpath,$ORIGIN/../lib")
    endif()
  endif()
endif()

if(LOCAL_WHISPER_BUILD_TESTS)
  if(NOT EXISTS "${LOCAL_WHISPER_GOOGLETEST_SOURCE}/CMakeLists.txt")
    message(FATAL_ERROR "LOCAL_WHISPER_GOOGLETEST_SOURCE must be verified")
  endif()
  set(BUILD_GMOCK OFF CACHE BOOL "" FORCE)
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  set(GTEST_HAS_ABSL OFF CACHE BOOL "" FORCE)
  add_subdirectory("${LOCAL_WHISPER_GOOGLETEST_SOURCE}"
                   "${CMAKE_BINARY_DIR}/verified-googletest" EXCLUDE_FROM_ALL)

  add_executable(local_whisper_whisper_cpp_core_tests
    tests/exact_model_reader_test.cpp
    tests/pcm_cpu_test.cpp
    tests/worker_application_test.cpp
  )
  target_include_directories(local_whisper_whisper_cpp_core_tests PRIVATE tests)
  target_link_libraries(local_whisper_whisper_cpp_core_tests
    PRIVATE local_whisper_whisper_cpp_core GTest::gtest_main)
  local_whisper_apply_quality(local_whisper_whisper_cpp_core_tests)

  add_executable(local_whisper_whisper_cpp_loader_tests
    tests/loader_limits_test.cpp
    tests/model_format_preflight_test.cpp
  )
  target_include_directories(local_whisper_whisper_cpp_loader_tests PRIVATE tests)
  target_link_libraries(local_whisper_whisper_cpp_loader_tests
    PRIVATE local_whisper_whisper_cpp_core GTest::gtest_main)
  local_whisper_apply_quality(local_whisper_whisper_cpp_loader_tests)

  add_executable(local_whisper_whisper_cpp_device_tests
    tests/amd_preview_test.cpp
    tests/device_authority_test.cpp
    tests/device_registry_test.cpp
  )
  target_link_libraries(local_whisper_whisper_cpp_device_tests
    PRIVATE local_whisper_whisper_cpp_core GTest::gtest_main)
  local_whisper_apply_quality(local_whisper_whisper_cpp_device_tests)

  add_executable(local_whisper_whisper_cpp_cancellation_tests
    tests/cancellation_test.cpp
  )
  target_link_libraries(local_whisper_whisper_cpp_cancellation_tests
    PRIVATE local_whisper_whisper_cpp_core GTest::gtest_main)
  local_whisper_apply_quality(local_whisper_whisper_cpp_cancellation_tests)

  if(LOCAL_WHISPER_BUILD_DIRECT_ENGINE)
    add_executable(local_whisper_whisper_cpp_qualification_tests
      tests/qualification_protocol_test.cpp)
    target_link_libraries(local_whisper_whisper_cpp_qualification_tests
      PRIVATE local_whisper_qualification_protocol GTest::gtest_main)
    local_whisper_apply_quality(local_whisper_whisper_cpp_qualification_tests)
  endif()

  include(CTest)
  include(GoogleTest)
  gtest_discover_tests(local_whisper_whisper_cpp_core_tests
    PROPERTIES LABELS core DISCOVERY_TIMEOUT 30)
  gtest_discover_tests(local_whisper_whisper_cpp_loader_tests
    PROPERTIES LABELS loader DISCOVERY_TIMEOUT 30)
  gtest_discover_tests(local_whisper_whisper_cpp_device_tests
    PROPERTIES LABELS device-proof DISCOVERY_TIMEOUT 30)
  gtest_discover_tests(local_whisper_whisper_cpp_cancellation_tests
    PROPERTIES LABELS cancellation DISCOVERY_TIMEOUT 30)
  if(LOCAL_WHISPER_BUILD_DIRECT_ENGINE)
    gtest_discover_tests(local_whisper_whisper_cpp_qualification_tests
      PROPERTIES LABELS direct-engine DISCOVERY_TIMEOUT 30)
  endif()
endif()
