#include "local_whisper/fs_guard/validation.hpp"

#include <cctype>
#include <charconv>
#include <cstdint>
#include <limits>

namespace local_whisper::fs_guard {

std::vector<std::string> split(const std::string_view input, const char delimiter) {
  std::vector<std::string> result;
  std::size_t start = 0;
  while (start <= input.size()) {
    const std::size_t end = input.find(delimiter, start);
    result.emplace_back(
        input.substr(start, end == std::string_view::npos ? input.size() - start : end - start));
    if (end == std::string_view::npos)
      break;
    start = end + 1;
  }
  return result;
}

bool is_safe_token(const std::string_view value, const std::size_t minimum,
                   const std::size_t maximum) noexcept {
  if (value.size() < minimum || value.size() > maximum)
    return false;
  for (const unsigned char character : value) {
    if (!(std::isalnum(character) != 0 || character == '-' || character == '_' ||
          character == '.')) {
      return false;
    }
  }
  return true;
}

bool is_safe_path_component(const std::string_view value) noexcept {
  if (value.empty() || value.size() > 255 || value == "." || value == "..") {
    return false;
  }
  for (const unsigned char character : value) {
    if (character == '/' || character == '\0' || character < 0x20U || character == 0x7fU) {
      return false;
    }
  }
  return true;
}

bool is_artifact_name(const std::string_view value) noexcept {
  const std::size_t prefix = value.starts_with("model-")     ? 6
                             : value.starts_with("runtime-") ? 8
                                                             : 0;
  if (prefix == 0 || value.size() != prefix + 64)
    return false;
  for (std::size_t index = prefix; index < value.size(); ++index) {
    const auto character = static_cast<unsigned char>(value[index]);
    if (std::isxdigit(character) == 0 || std::isupper(character) != 0) {
      return false;
    }
  }
  return true;
}

bool is_file_name(const std::string_view value) noexcept {
  return value == "managed-manifest-v1" ||
         (value.starts_with("file-") && is_safe_token(value, 6, 197));
}

bool is_positive_decimal(const std::string_view value) noexcept {
  if (value.empty())
    return false;
  std::uint64_t parsed = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), parsed);
  return error == std::errc{} && end == value.data() + value.size() && parsed > 0;
}

bool is_mode(const std::string_view value) noexcept {
  if (value.empty())
    return false;
  unsigned int parsed = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), parsed);
  return error == std::errc{} && end == value.data() + value.size() && parsed <= 0777U;
}

} // namespace local_whisper::fs_guard
