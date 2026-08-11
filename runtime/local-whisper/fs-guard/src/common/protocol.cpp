#include "local_whisper/fs_guard/protocol.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/validation.hpp"

#include <array>
#include <cstdint>
#include <sstream>
#include <utility>

namespace local_whisper::fs_guard {

std::string base64url_encode(const std::string_view input) {
  static constexpr std::string_view table =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string result;
  result.reserve((input.size() * 4 + 2) / 3);
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const unsigned char character : input) {
    accumulator = (accumulator << 8U) | character;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result.push_back(table[(accumulator >> bits) & 0x3fU]);
    }
  }
  if (bits > 0) {
    result.push_back(table[(accumulator << (6 - bits)) & 0x3fU]);
  }
  return result;
}

std::string base64url_decode(const std::string_view input) {
  std::array<int, 256> inverse{};
  inverse.fill(-1);
  constexpr std::string_view table =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (std::size_t index = 0; index < table.size(); ++index) {
    inverse[static_cast<unsigned char>(table[index])] = static_cast<int>(index);
  }
  std::string result;
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const unsigned char character : input) {
    const int value = inverse[character];
    if (value < 0)
      throw GuardError(ErrorCode::kInvalidInput);
    accumulator = (accumulator << 6U) | static_cast<unsigned int>(value);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result.push_back(static_cast<char>((accumulator >> bits) & 0xffU));
    }
  }
  if (bits > 0 && (accumulator & ((1U << bits) - 1U)) != 0) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
  if (base64url_encode(result) != input) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
  return result;
}

Request parse_request(const std::string_view line, std::string& request_id) {
  if (line.size() > kMaxLineBytes)
    throw GuardError(ErrorCode::kInvalidInput);
  const auto fields = split(line, '\t');
  if (fields.size() < 3 || fields[1] != kProtocolVersion || !is_safe_token(fields[0], 1, 20) ||
      !is_safe_token(fields[2], 1, 32)) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
  request_id = fields[0];
  std::vector<std::string> arguments;
  arguments.reserve(fields.size() - 3);
  for (std::size_t index = 3; index < fields.size(); ++index) {
    arguments.push_back(base64url_decode(fields[index]));
  }
  return Request{request_id, parse_command(fields[2], arguments)};
}

std::string serialize_response(const std::string_view request_id, const bool success,
                               const std::vector<std::string>& fields) {
  std::ostringstream response;
  response << request_id << '\t' << kProtocolVersion << '\t' << (success ? "OK" : "ERR");
  for (const auto& field : fields) {
    response << '\t' << base64url_encode(field);
  }
  response << '\n';
  return response.str();
}

} // namespace local_whisper::fs_guard
