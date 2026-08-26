#include "local_whisper/launcher/launch_request.hpp"

#include <cstddef>
#include <cstdint>
#include <exception>
#include <string>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  try {
    static_cast<void>(local_whisper::launcher::LaunchRequestParser{}.parse(
        std::string(reinterpret_cast<const char*>(data), size)));
  } catch (const std::exception&) {
  }
  return 0;
}
