#pragma once

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace local_whisper::fs_guard {

[[nodiscard]] std::vector<std::string> split(std::string_view input, char delimiter);
[[nodiscard]] bool is_safe_token(std::string_view value, std::size_t minimum,
                                 std::size_t maximum) noexcept;
[[nodiscard]] bool is_safe_path_component(std::string_view value) noexcept;
[[nodiscard]] bool is_artifact_name(std::string_view value) noexcept;
[[nodiscard]] bool is_file_name(std::string_view value) noexcept;
[[nodiscard]] bool is_positive_decimal(std::string_view value) noexcept;
[[nodiscard]] bool is_mode(std::string_view value) noexcept;

} // namespace local_whisper::fs_guard
