include_guard(GLOBAL)

function(local_whisper_add_sha256 target common_root sanitizer_option)
  if(NOT TARGET ${target})
    message(FATAL_ERROR "Local Whisper SHA-256 target is unavailable: ${target}")
  endif()
  if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "Local Whisper SHA-256 acceleration requires the approved x64 target")
  endif()

  target_sources(${target} PRIVATE
    "${common_root}/src/sha256.cpp"
    "${common_root}/src/sha256_dispatch.cpp"
  )

  set(accelerated_target "${target}_sha256_x86")
  add_library(${accelerated_target} OBJECT "${common_root}/src/sha256_x86.cpp")
  target_include_directories(${accelerated_target} PRIVATE "${common_root}/include")
  local_whisper_apply_compile_hardening(${accelerated_target} ${sanitizer_option})
  if(MSVC)
    # MSVC exposes the SHA intrinsics without raising the x64 target-wide ISA floor.
  elseif(CMAKE_CXX_COMPILER_ID MATCHES "^(Clang|GNU)$")
    target_compile_options(${accelerated_target} PRIVATE -msha)
  else()
    message(FATAL_ERROR "Local Whisper SHA-256 acceleration requires GCC, Clang, or MSVC")
  endif()
  target_sources(${target} PRIVATE $<TARGET_OBJECTS:${accelerated_target}>)
endfunction()
