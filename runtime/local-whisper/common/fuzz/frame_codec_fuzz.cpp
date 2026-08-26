#include "local_whisper/common/frame_codec.hpp"

#include <cstddef>
#include <cstdint>
#include <exception>
#include <span>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  try {
    static_cast<void>(
        local_whisper::common::decode_frame(std::span<const std::uint8_t>(data, size)));
  } catch (const std::exception&) {
  }
  return 0;
}
