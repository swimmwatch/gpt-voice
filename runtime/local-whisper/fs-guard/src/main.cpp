#include "local_whisper/fs_guard/guard_application.hpp"

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
std::string_view model_launch_failure_code(const std::string_view message) noexcept {
  if (message.starts_with("model launch path "))
    return "MODEL_PATH_INVALID";
  if (message == "model launch directory open failed")
    return "MODEL_DIRECTORY_OPEN_FAILED";
  if (message == "model launch file open failed")
    return "MODEL_FILE_OPEN_FAILED";
  if (message.find("identity") != std::string_view::npos ||
      message.find("alternate stream") != std::string_view::npos)
    return "MODEL_IDENTITY_REJECTED";
  if (message.find("digest") != std::string_view::npos ||
      message.find("hash") != std::string_view::npos || message == "model launch seek failed")
    return "MODEL_DIGEST_REJECTED";
  if (message == "model launch launcher creation failed")
    return "MODEL_LAUNCHER_CREATION_FAILED";
  if (message.starts_with("model launch job "))
    return "MODEL_JOB_OWNERSHIP_FAILED";
  if (message.starts_with("model launch attribute ") ||
      message.starts_with("model launch descriptor "))
    return "MODEL_HANDLE_POLICY_FAILED";
  if (message.starts_with("model launch pipe ") || message == "model launch write failed")
    return "MODEL_PIPE_IO_FAILED";
  if (message == "model launch launcher resume failed")
    return "MODEL_LAUNCHER_RESUME_FAILED";
  return "MODEL_BOOTSTRAP_REJECTED";
}

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
    } catch (const std::exception& error) {
#if defined(_WIN32)
      write_model_launch_failure(model_launch_failure_code(error.what()));
#endif
      return 20;
    }
  }
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
