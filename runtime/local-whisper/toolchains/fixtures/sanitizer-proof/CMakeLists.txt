cmake_minimum_required(VERSION 3.25)

project(local_whisper_sanitizer_proof LANGUAGES CXX)

set(CMAKE_CXX_EXTENSIONS OFF)

function(local_whisper_add_sanitizer_fixture target source sanitizer)
  add_executable(${target} ${source})
  target_compile_features(${target} PRIVATE cxx_std_20)
  target_compile_options(
    ${target}
    PRIVATE
      -Wall
      -Wextra
      -Wpedantic
      -Werror
      -fno-omit-frame-pointer
      -fno-sanitize-recover=all
      -fsanitize=${sanitizer}
  )
  target_link_options(
    ${target}
    PRIVATE
      -fuse-ld=lld
      -fsanitize=${sanitizer}
      -shared-libsan
      "LINKER:-rpath,$ORIGIN/../lib"
  )
  set_target_properties(${target} PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
endfunction()

local_whisper_add_sanitizer_fixture(
  local-whisper-sanitizer-clean
  clean.cpp
  address,undefined
)
local_whisper_add_sanitizer_fixture(
  local-whisper-sanitizer-asan-trigger
  asan_heap_use_after_free.cpp
  address
)
local_whisper_add_sanitizer_fixture(
  local-whisper-sanitizer-ubsan-trigger
  ubsan_signed_overflow.cpp
  undefined
)
