#pragma once

#include "local_whisper/fs_guard/command.hpp"

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace local_whisper::fs_guard {

inline constexpr std::string_view kProtocolVersion = "1";
inline constexpr std::size_t kMaxLineBytes = 256U * 1024U;

struct Request {
  std::string id;
  Command command;
};

[[nodiscard]] std::string base64url_encode(std::string_view input);
[[nodiscard]] std::string base64url_decode(std::string_view input);
[[nodiscard]] Request parse_request(std::string_view line, std::string& request_id);
[[nodiscard]] std::string serialize_response(std::string_view request_id, bool success,
                                             const std::vector<std::string>& fields);

} // namespace local_whisper::fs_guard
