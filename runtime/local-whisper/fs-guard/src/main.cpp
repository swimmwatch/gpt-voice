#include "local_whisper/fs_guard/guard_application.hpp"

#if defined(_WIN32)
#include "platform/windows/windows_backend.hpp"
#else
#include "platform/linux/linux_backend.hpp"
#endif

#include <iostream>

int main() {
  std::ios::sync_with_stdio(false);
#if defined(_WIN32)
  local_whisper::fs_guard::WindowsBackend backend;
#else
  local_whisper::fs_guard::LinuxBackend backend;
#endif
  local_whisper::fs_guard::GuardApplication application(backend);
  return application.run(std::cin, std::cout);
}
