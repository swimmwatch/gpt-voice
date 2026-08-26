#include "local_whisper/common/bounded_json.hpp"

#include <cstddef>
#include <cstdint>
#include <span>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  static_cast<void>(
      local_whisper::common::validate_bounded_json(std::span<const std::uint8_t>(data, size)));
  return 0;
}
