#include "local_whisper/common/model_authority.hpp"

#include <cstddef>
#include <cstdint>
#include <exception>
#include <span>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  try {
    static_cast<void>(
        local_whisper::common::decode_authority_record(std::span<const std::uint8_t>(data, size)));
  } catch (const std::exception&) {
  }
  return 0;
}
