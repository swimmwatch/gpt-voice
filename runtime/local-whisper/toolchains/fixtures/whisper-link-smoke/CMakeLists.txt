cmake_minimum_required(VERSION 3.31.8)

project(local_whisper_link_smoke LANGUAGES C CXX)

if(NOT IS_ABSOLUTE "${LOCAL_WHISPER_SOURCE_ROOT}")
  message(FATAL_ERROR "LOCAL_WHISPER_SOURCE_ROOT must be an explicit verified absolute path")
endif()
if(NOT EXISTS "${LOCAL_WHISPER_SOURCE_ROOT}/CMakeLists.txt")
  message(FATAL_ERROR "LOCAL_WHISPER_SOURCE_ROOT is incomplete")
endif()

add_subdirectory("${LOCAL_WHISPER_SOURCE_ROOT}" whisper-cpp EXCLUDE_FROM_ALL)

add_executable(local-whisper-build-smoke main.cpp)
target_compile_features(local-whisper-build-smoke PRIVATE cxx_std_20)
target_compile_options(local-whisper-build-smoke PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(local-whisper-build-smoke PRIVATE whisper)
if(TARGET ggml-cuda)
  target_compile_definitions(
    local-whisper-build-smoke
    PRIVATE LOCAL_WHISPER_CUDA_LINK_SMOKE=1
  )
  target_link_libraries(local-whisper-build-smoke PRIVATE ggml-cuda)
endif()
target_link_options(local-whisper-build-smoke PRIVATE "LINKER:-rpath,$ORIGIN/../lib")
set_target_properties(
  local-whisper-build-smoke
  PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/licenses")
file(
  COPY_FILE
  "${LOCAL_WHISPER_SOURCE_ROOT}/LICENSE"
  "${CMAKE_BINARY_DIR}/licenses/whisper-cpp.LICENSE"
  ONLY_IF_DIFFERENT
)
