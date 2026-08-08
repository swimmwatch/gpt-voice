#pragma once

#include "local_whisper/launcher/launch_request.hpp"

#include <memory>

namespace local_whisper::launcher {

class PlatformLauncher {
public:
  virtual ~PlatformLauncher() = default;
  virtual int run(const LaunchRequest& request, int control_descriptor,
                  int acknowledgment_descriptor, int authority_descriptor) = 0;
};

[[nodiscard]] std::unique_ptr<PlatformLauncher> make_platform_launcher();

} // namespace local_whisper::launcher
