#include "local_whisper/common/process_exit_codes.hpp"
#include "local_whisper/fs_guard/guard_application.hpp"
#include "local_whisper/fs_guard/model_launch_error.hpp"

#if defined(_WIN32)
#include "platform/windows/windows_backend.hpp"
#include "platform/windows/windows_model_launch_application.hpp"
#else
#include "platform/linux/linux_backend.hpp"
#include "platform/linux/model_launch_application.hpp"
#endif

#include <iostream>
#include <string>
#include <string_view>

#if defined(_WIN32)
#include <io.h>

namespace {
void write_model_launch_failure(const std::string_view code) noexcept {
  const std::string line = "FAILED\t" + std::string(code) + "\n";
  static_cast<void>(_write(4, line.data(), static_cast<unsigned int>(line.size())));
}
} // namespace
#endif

int main(int argc, char** argv) {
  std::ios::sync_with_stdio(false);
  if (argc == 2 && std::string_view(argv[1]) == "--local-whisper-model-launch-v1") {
    try {
#if defined(_WIN32)
      return local_whisper::fs_guard::run_windows_model_launch(3, 4);
#else
      return local_whisper::fs_guard::run_linux_model_launch(3, 4);
#endif
    } catch (...) {
      const auto policy =
          local_whisper::fs_guard::model_launch_exception_failure_policy(std::current_exception());
#if defined(_WIN32)
      write_model_launch_failure(policy.acknowledgment);
#endif
      return policy.exit_code;
    }
  }
  if (argc != 1)
    return local_whisper::common::kInvalidInvocationExitCode;
#if defined(_WIN32)
  local_whisper::fs_guard::WindowsBackend backend;
#else
  local_whisper::fs_guard::LinuxBackend backend;
#endif
  local_whisper::fs_guard::GuardApplication application(backend);
  return application.run(std::cin, std::cout);
}
