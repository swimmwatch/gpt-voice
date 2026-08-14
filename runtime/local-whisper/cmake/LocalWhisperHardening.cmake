include(CheckCXXSourceCompiles)

option(LOCAL_WHISPER_MSVC_ANALYZE "Run MSVC /analyze for project-owned translation units" OFF)

function(local_whisper_resolve_fortify_level output_variable)
  if(DEFINED LOCAL_WHISPER_FORTIFY_LEVEL)
    set(${output_variable} "${LOCAL_WHISPER_FORTIFY_LEVEL}" PARENT_SCOPE)
    return()
  endif()

  set(local_whisper_original_required_flags "${CMAKE_REQUIRED_FLAGS}")
  set(CMAKE_REQUIRED_FLAGS "${CMAKE_REQUIRED_FLAGS} -O2 -D_FORTIFY_SOURCE=3")
  check_cxx_source_compiles(
    "#include <features.h>
     #if !defined(__GLIBC_PREREQ) || !__GLIBC_PREREQ(2, 33)
     #error _FORTIFY_SOURCE=3 requires glibc 2.33 or newer
     #endif
     #include <cstring>
     int main() { char destination[8] = {}; return std::strcpy(destination, \"ok\")[0]; }"
    LOCAL_WHISPER_FORTIFY_3_SUPPORTED)
  if(LOCAL_WHISPER_FORTIFY_3_SUPPORTED)
    set(LOCAL_WHISPER_FORTIFY_LEVEL 3 CACHE INTERNAL "Verified Local Whisper fortify level")
  else()
    set(CMAKE_REQUIRED_FLAGS "${local_whisper_original_required_flags} -O2 -D_FORTIFY_SOURCE=2")
    check_cxx_source_compiles(
      "#include <cstring>
       int main() { char destination[8] = {}; return std::strcpy(destination, \"ok\")[0]; }"
      LOCAL_WHISPER_FORTIFY_2_SUPPORTED)
    if(NOT LOCAL_WHISPER_FORTIFY_2_SUPPORTED)
      message(FATAL_ERROR "The selected Local Whisper toolchain cannot verify a supported _FORTIFY_SOURCE level")
    endif()
    set(LOCAL_WHISPER_FORTIFY_LEVEL 2 CACHE INTERNAL "Verified Local Whisper fortify level")
  endif()
  set(CMAKE_REQUIRED_FLAGS "${local_whisper_original_required_flags}")
  set(${output_variable} "${LOCAL_WHISPER_FORTIFY_LEVEL}" PARENT_SCOPE)
endfunction()

function(local_whisper_configure_msvc_stl_debug_level)
  if(MSVC)
    # Keep every project-owned and GoogleTest translation unit on one ABI-safe STL setting.
    add_compile_definitions(_ITERATOR_DEBUG_LEVEL=0)
    if(MSVC_VERSION LESS 1940)
      add_compile_definitions(_CONTAINER_DEBUG_LEVEL=0)
    else()
      add_compile_definitions(_MSVC_STL_HARDENING=0)
    endif()
  endif()
endfunction()

function(local_whisper_configure_sanitizer_graph sanitizer_option)
  if(NOT ${sanitizer_option} AND NOT LOCAL_WHISPER_ENABLE_THREAD_SANITIZER)
    return()
  endif()

  if(MSVC)
    foreach(local_whisper_language C CXX)
      string(REPLACE "/RTC1" "" local_whisper_debug_flags "${CMAKE_${local_whisper_language}_FLAGS_DEBUG}")
      set(CMAKE_${local_whisper_language}_FLAGS_DEBUG "${local_whisper_debug_flags}" PARENT_SCOPE)
    endforeach()
    foreach(local_whisper_linker_flags
        CMAKE_EXE_LINKER_FLAGS_DEBUG
        CMAKE_MODULE_LINKER_FLAGS_DEBUG
        CMAKE_SHARED_LINKER_FLAGS_DEBUG)
      string(REPLACE "/INCREMENTAL" "" local_whisper_debug_linker_flags "${${local_whisper_linker_flags}}")
      set(${local_whisper_linker_flags} "${local_whisper_debug_linker_flags}" PARENT_SCOPE)
    endforeach()
  else()
    add_compile_definitions(_GLIBCXX_ASSERTIONS)
  endif()
endfunction()

function(local_whisper_apply_google_test_sanitizer_policy sanitizer_option)
  if(MSVC AND ${sanitizer_option})
    # MSVC's ASan STL annotations are selected per translation unit. GoogleTest
    # must therefore be compiled with ASan whenever it links a sanitized test,
    # or the linker rejects its annotation contract as inconsistent.
    foreach(local_whisper_google_test_target gtest gtest_main)
      if(NOT TARGET ${local_whisper_google_test_target})
        message(FATAL_ERROR "Verified GoogleTest target is unavailable")
      endif()
      target_compile_options(${local_whisper_google_test_target} PRIVATE /fsanitize=address)
    endforeach()
  endif()
endfunction()

function(local_whisper_apply_compile_hardening target sanitizer_option)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /EHsc /GS /guard:cf)
    if(LOCAL_WHISPER_MSVC_ANALYZE)
      # GoogleTest is a reviewed external dependency. MSVC emits C6326
      # from its headers under /analyze; keep project-owned translation units
      # analyzed while excluding only external-header diagnostics. Native
      # Ninja builds retain analyzer diagnostics on the compiler output; avoid
      # MSVC's implicit per-source XML write path.
      target_compile_options(${target} PRIVATE /analyze /analyze:external- /external:W0 /analyze:autolog-)
    endif()
    if(${sanitizer_option})
      target_compile_options(${target} PRIVATE /fsanitize=address)
      target_link_options(${target} PRIVATE /fsanitize=address)
    endif()
  else()
    local_whisper_resolve_fortify_level(local_whisper_fortify_level)
    target_compile_options(${target} PRIVATE
      -Wall
      -Wextra
      -Wpedantic
      -Werror
      -fstack-protector-strong
      -fPIE)
    target_compile_definitions(${target} PRIVATE
      "$<$<OR:$<CONFIG:Release>,$<CONFIG:RelWithDebInfo>,$<CONFIG:MinSizeRel>>:_FORTIFY_SOURCE=${local_whisper_fortify_level}>")
    if(LOCAL_WHISPER_ENABLE_THREAD_SANITIZER)
      target_compile_options(${target} PRIVATE
        -fsanitize=thread
        -fno-omit-frame-pointer)
      target_link_options(${target} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
    elseif(${sanitizer_option})
      target_compile_options(${target} PRIVATE
        -fsanitize=address,undefined
        -fno-omit-frame-pointer
        -fno-sanitize-recover=all)
      target_link_options(${target} PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
    endif()
  endif()
endfunction()

function(local_whisper_apply_test_compile_hardening target sanitizer_option)
  local_whisper_apply_compile_hardening(${target} ${sanitizer_option})
  if(MSVC AND LOCAL_WHISPER_MSVC_ANALYZE)
    # Test assertions intentionally compare fixture constants. C6326 cannot
    # distinguish those assertions from production logic, so disable it only
    # for project-owned test translation units after ordinary hardening.
    target_compile_options(${target} PRIVATE /wd6326)
  endif()
endfunction()

function(local_whisper_apply_executable_hardening target)
  if(MSVC)
    target_link_options(${target} PRIVATE /guard:cf /DYNAMICBASE /NXCOMPAT /Brepro)
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
      target_link_options(${target} PRIVATE /HIGHENTROPYVA)
    endif()
  else()
    target_link_options(${target} PRIVATE
      -pie
      -Wl,-z,relro
      -Wl,-z,now
      -Wl,-z,noexecstack
      -Wl,-z,text)
  endif()
endfunction()
