include(CheckCXXSourceCompiles)

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

function(local_whisper_apply_compile_hardening target sanitizer_option)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /EHsc /GS /guard:cf)
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
    if(${sanitizer_option})
      target_compile_options(${target} PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
      target_link_options(${target} PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
    endif()
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
