#pragma once

#include "local_whisper/whisper_cpp/error.hpp"

#include <cstddef>
#include <cstdint>
#include <limits>

namespace local_whisper::whisper_cpp {

[[nodiscard]] inline std::uint64_t checked_add(std::uint64_t left, std::uint64_t right) {
  if (right > std::numeric_limits<std::uint64_t>::max() - left)
    throw CoreError(FailureCode::model_load_failed, "checked addition overflow");
  return left + right;
}

[[nodiscard]] inline std::uint64_t checked_multiply(std::uint64_t left, std::uint64_t right) {
  if (left != 0U && right > std::numeric_limits<std::uint64_t>::max() / left)
    throw CoreError(FailureCode::model_load_failed, "checked multiplication overflow");
  return left * right;
}

[[nodiscard]] inline std::size_t checked_size(std::uint64_t value) {
  if (value > std::numeric_limits<std::size_t>::max())
    throw CoreError(FailureCode::model_load_failed, "checked size conversion overflow");
  return static_cast<std::size_t>(value);
}

} // namespace local_whisper::whisper_cpp
