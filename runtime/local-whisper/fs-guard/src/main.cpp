#include "local_whisper/fs_guard/guard_application.hpp"

#if defined(_WIN32)
#include "platform/windows/windows_backend.hpp"
#else
#include "platform/linux/linux_backend.hpp"
#include "platform/linux/model_launch_application.hpp"
#endif

#include <iostream>
#include <string_view>

int main(int argc, char** argv) {
  std::ios::sync_with_stdio(false);
#if !defined(_WIN32)
  if (argc == 2 && std::string_view(argv[1]) == "--local-whisper-model-launch-v1") {
    try {
      return local_whisper::fs_guard::run_linux_model_launch(3, 4);
    } catch (...) {
      return 20;
    }
  }
#endif
  if (argc != 1)
    return 2;
#if defined(_WIN32)
  local_whisper::fs_guard::WindowsBackend backend;
#else
  local_whisper::fs_guard::LinuxBackend backend;
#endif
  local_whisper::fs_guard::GuardApplication application(backend);
  return application.run(std::cin, std::cout);
}
