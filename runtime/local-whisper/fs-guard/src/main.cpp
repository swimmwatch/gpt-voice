#include "local_whisper/common/native_logger.hpp"
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

#include <cstddef>
#include <iostream>
#include <string>
#include <string_view>

#if defined(_WIN32)
#include <io.h>
#else
#include <cerrno>
#include <unistd.h>
#endif

namespace {
void write_model_launch_failure(const std::string_view code) noexcept {
  const std::string line = "FAILED\t" + std::string(code) + "\n";
  std::size_t offset = 0;
  while (offset < line.size()) {
#if defined(_WIN32)
    const int count =
        _write(4, line.data() + offset, static_cast<unsigned int>(line.size() - offset));
#else
    const ssize_t count = write(4, line.data() + offset, line.size() - offset);
    if (count < 0 && errno == EINTR)
      continue;
#endif
    if (count <= 0)
      return;
    offset += static_cast<std::size_t>(count);
  }
}
} // namespace

int main(int argc, char** argv) {
  std::ios::sync_with_stdio(false);
  auto logger = local_whisper::common::make_native_logger_from_environment();
  const auto component = argc == 2 && std::string_view(argv[1]) == "--local-whisper-model-launch-v1"
                             ? local_whisper::common::NativeLogComponent::model_launcher
                             : local_whisper::common::NativeLogComponent::filesystem_guard;
  if (logger)
    logger->emit(component, local_whisper::common::NativeLogEvent::process_started);
  int result = local_whisper::common::kInvalidInvocationExitCode;
  if (argc == 2 && std::string_view(argv[1]) == "--local-whisper-model-launch-v1") {
    try {
#if defined(_WIN32)
      result = local_whisper::fs_guard::run_windows_model_launch(3, 4);
#else
      result = local_whisper::fs_guard::run_linux_model_launch(3, 4);
#endif
    } catch (...) {
      const auto policy =
          local_whisper::fs_guard::model_launch_exception_failure_policy(std::current_exception());
      write_model_launch_failure(policy.acknowledgment);
      result = policy.exit_code;
    }
  } else if (argc == 1) {
#if defined(_WIN32)
    local_whisper::fs_guard::WindowsBackend backend;
#else
    local_whisper::fs_guard::LinuxBackend backend;
#endif
    local_whisper::fs_guard::GuardApplication application(backend);
    result = application.run(std::cin, std::cout);
  }
  if (logger) {
    logger->emit(component,
                 result == 0 ? local_whisper::common::NativeLogEvent::process_stopped
                             : local_whisper::common::NativeLogEvent::native_failure,
                 result == 0 ? local_whisper::common::NativeLogFields{}
                             : local_whisper::common::NativeLogFields{
                                   local_whisper::common::NativeLogErrorCode::runtime_failure,
                                   std::nullopt});
    logger->shutdown();
  }
  return result;
}
