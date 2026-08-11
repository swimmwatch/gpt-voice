#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <string>

namespace local_whisper::common {

constexpr std::size_t kBoundedJsonMaxRawBytes = 1'048'576;

struct JsonValidationResult {
  bool valid;
  std::size_t event_count;
  std::string error;
};

[[nodiscard]] JsonValidationResult validate_bounded_json(std::span<const std::uint8_t> bytes);

} // namespace local_whisper::common
