#include "local_whisper/launcher/launch_request.hpp"
#include "local_whisper/launcher/platform_launcher.hpp"

#include <exception>
#include <string_view>

namespace {
constexpr int kControlDescriptor = 3;
constexpr int kAcknowledgmentDescriptor = 4;
} // namespace

int main(int argc, char** argv) {
  if (argc != 2 || std::string_view(argv[1]) != "--local-whisper-launcher-v1")
    return 2;
  try {
    const local_whisper::launcher::LaunchRequest request =
        local_whisper::launcher::LaunchRequestParser{}.parse(
            local_whisper::launcher::read_bootstrap_line(kControlDescriptor));
    return local_whisper::launcher::make_platform_launcher()->run(request, kControlDescriptor,
                                                                  kAcknowledgmentDescriptor);
  } catch (const std::exception&) {
    return 10;
  }
}
