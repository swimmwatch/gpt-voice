#include "local_whisper/launcher/launch_request.hpp"
#include "local_whisper/launcher/platform_launcher.hpp"

#include <exception>
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
    throw std::runtime_error("invalid inherited handle argument");
  std::uintptr_t handle_value = 0;
  const std::string_view digits = value.substr(prefix.size());
  const auto parsed = std::from_chars(digits.data(), digits.data() + digits.size(), handle_value);
  if (digits.empty() || parsed.ec != std::errc{} || parsed.ptr != digits.data() + digits.size() ||
      handle_value == 0U) {
    throw std::runtime_error("invalid inherited handle value");
  }
  const int descriptor =
      _open_osfhandle(static_cast<intptr_t>(handle_value), _O_BINARY | _O_NOINHERIT);
  if (descriptor < 0)
    throw std::runtime_error("inherited handle conversion failed");
  return descriptor;
}

std::string_view launcher_failure_code(const std::string_view message) noexcept {
  if (message == "launcher path invalid" || message == "launcher path empty" ||
      message == "launcher path encoding invalid" || message == "launcher path component invalid")
    return "PATH_INVALID";
  if (message == "launcher worker path invalid")
    return "WORKER_PATH_INVALID";
  if (message == "launcher volume open failed")
    return "VOLUME_OPEN_FAILED";
  if (message == "launcher directory open failed" ||
      message == "launcher directory parent unavailable")
    return "DIRECTORY_OPEN_FAILED";
  if (message == "launcher identity changed" || message == "launcher unsafe identity" ||
      message == "launcher stream identity failed" ||
      message == "launcher stream identity invalid" ||
      message == "launcher alternate stream rejected")
    return "IDENTITY_REJECTED";
  if (message == "launcher worker open failed")
    return "WORKER_OPEN_FAILED";
  if (message == "launcher digest changed" || message == "launcher read failed" ||
      message == "launcher seek failed")
    return "DIGEST_REJECTED";
  if (message == "launcher worker creation failed")
    return "WORKER_CREATION_FAILED";
  if (message.starts_with("launcher job "))
    return "JOB_OWNERSHIP_FAILED";
  if (message.starts_with("launcher worker authority") ||
      message.starts_with("launcher model authority") ||
      message == "invalid Windows launcher model authority" ||
      message == "Windows worker model authority duplication failed" ||
      message == "invalid Windows worker authority acknowledgment")
    return "MODEL_AUTHORITY_REJECTED";
  if (message == "launcher worker process identity changed")
    return "WORKER_PROCESS_IDENTITY_REJECTED";
  if (message.starts_with("launcher inherited") || message.starts_with("invalid inherited"))
    return "INHERITED_HANDLE_REJECTED";
  if (message.starts_with("launcher worker pipe") || message.starts_with("launcher pipe") ||
      message.starts_with("launcher proxy") || message.starts_with("launcher exact"))
    return "PIPE_IO_FAILED";
  if (message == "launcher worker resume failed")
    return "WORKER_RESUME_FAILED";
  if (message.starts_with("launcher attribute "))
    return "HANDLE_POLICY_FAILED";
  if (message == "launcher acknowledgment failed")
    return "ACKNOWLEDGMENT_FAILED";
  return "BOOTSTRAP_REJECTED";
}

void write_failure_acknowledgment(const int descriptor, const std::string_view code) noexcept {
  const std::string line = "FAILED\t" + std::string(code) + "\n";
  static_cast<void>(_write(descriptor, line.data(), static_cast<unsigned int>(line.size())));
}
#endif
} // namespace

int main(int argc, char** argv) {
  if ((argc != 2 && argc != 5) || std::string_view(argv[1]) != "--local-whisper-launcher-v2")
    return 2;
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
      return 2;
    constexpr int control_descriptor = kControlDescriptor;
    constexpr int acknowledgment_descriptor = kAcknowledgmentDescriptor;
    constexpr int authority_descriptor = kAuthorityDescriptor;
#endif
    const local_whisper::launcher::LaunchRequest request =
        local_whisper::launcher::LaunchRequestParser{}.parse(
            local_whisper::launcher::read_bootstrap_line(control_descriptor));
    return local_whisper::launcher::make_platform_launcher()->run(
        request, control_descriptor, acknowledgment_descriptor, authority_descriptor);
  } catch (const std::exception& error) {
#ifdef _WIN32
    write_failure_acknowledgment(acknowledgment_descriptor, launcher_failure_code(error.what()));
#endif
    return 10;
  }
}
