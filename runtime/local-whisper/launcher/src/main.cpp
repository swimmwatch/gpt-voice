#include "local_whisper/common/native_logger.hpp"
#include "local_whisper/common/process_exit_codes.hpp"
#include "local_whisper/launcher/launch_request.hpp"
#include "local_whisper/launcher/launcher_error.hpp"
#include "local_whisper/launcher/platform_launcher.hpp"

#include <string>
#include <string_view>

#ifdef _WIN32
#include <charconv>
#include <cstdint>
#include <fcntl.h>
#include <io.h>
#include <stdexcept>
#include <string>
#endif

namespace {
constexpr int kControlDescriptor = 3;
constexpr int kAcknowledgmentDescriptor = 4;
constexpr int kAuthorityDescriptor = 5;

#ifdef _WIN32
int inherited_descriptor(const char* argument, const std::string_view prefix) {
  const std::string_view value(argument);
  if (!value.starts_with(prefix))
    throw local_whisper::launcher::LauncherError(
        local_whisper::launcher::LauncherErrorCode::kInheritedHandleRejected,
        "invalid inherited handle argument");
  std::uintptr_t handle_value = 0;
  const std::string_view digits = value.substr(prefix.size());
  const auto parsed = std::from_chars(digits.data(), digits.data() + digits.size(), handle_value);
  if (digits.empty() || parsed.ec != std::errc{} || parsed.ptr != digits.data() + digits.size() ||
      handle_value == 0U) {
    throw local_whisper::launcher::LauncherError(
        local_whisper::launcher::LauncherErrorCode::kInheritedHandleRejected,
        "invalid inherited handle value");
  }
  const int descriptor =
      _open_osfhandle(static_cast<intptr_t>(handle_value), _O_BINARY | _O_NOINHERIT);
  if (descriptor < 0)
    throw local_whisper::launcher::LauncherError(
        local_whisper::launcher::LauncherErrorCode::kInheritedHandleRejected,
        "inherited handle conversion failed");
  return descriptor;
}

void write_failure_acknowledgment(const int descriptor, const std::string_view code) noexcept {
  const std::string line = "FAILED\t" + std::string(code) + "\n";
  static_cast<void>(_write(descriptor, line.data(), static_cast<unsigned int>(line.size())));
}
#endif
} // namespace

int main(int argc, char** argv) {
  auto logger = local_whisper::common::make_native_logger_from_environment();
  if (logger)
    logger->emit(local_whisper::common::NativeLogComponent::launcher,
                 local_whisper::common::NativeLogEvent::process_started);
  int result = local_whisper::common::kInvalidInvocationExitCode;
  if ((argc != 2 && argc != 5) || std::string_view(argv[1]) != "--local-whisper-launcher-v2") {
    if (logger) {
      logger->emit(local_whisper::common::NativeLogComponent::launcher,
                   local_whisper::common::NativeLogEvent::protocol_rejected,
                   {local_whisper::common::NativeLogErrorCode::invalid_input, std::nullopt});
      logger->shutdown();
    }
    return result;
  }
#ifdef _WIN32
  int acknowledgment_descriptor = kAcknowledgmentDescriptor;
#endif
  try {
#ifdef _WIN32
    const int control_descriptor =
        argc == 5 ? inherited_descriptor(argv[2], "--control-handle=") : kControlDescriptor;
    acknowledgment_descriptor =
        argc == 5 ? inherited_descriptor(argv[3], "--ack-handle=") : kAcknowledgmentDescriptor;
    const int authority_descriptor =
        argc == 5 ? inherited_descriptor(argv[4], "--authority-handle=") : kAuthorityDescriptor;
#else
    if (argc != 2)
      return local_whisper::common::kInvalidInvocationExitCode;
    constexpr int control_descriptor = kControlDescriptor;
    constexpr int acknowledgment_descriptor = kAcknowledgmentDescriptor;
    constexpr int authority_descriptor = kAuthorityDescriptor;
#endif
    const local_whisper::launcher::LaunchRequest request =
        local_whisper::launcher::LaunchRequestParser{}.parse(
            local_whisper::launcher::read_bootstrap_line(control_descriptor));
    result = local_whisper::launcher::make_platform_launcher()->run(
        request, control_descriptor, acknowledgment_descriptor, authority_descriptor);
  } catch (...) {
    const auto policy =
        local_whisper::launcher::launcher_exception_failure_policy(std::current_exception());
#ifdef _WIN32
    write_failure_acknowledgment(acknowledgment_descriptor, policy.acknowledgment);
#endif
    result = policy.exit_code;
  }
  if (logger) {
    logger->emit(local_whisper::common::NativeLogComponent::launcher,
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
