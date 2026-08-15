#include "local_whisper/fs_guard/protocol.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/validation.hpp"

#include <array>
#include <cstdint>
#include <limits>
#include <sstream>
#include <utility>

namespace local_whisper::fs_guard {
namespace {

constexpr std::string_view kBase64UrlAlphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

constexpr std::array<std::int8_t, 256> make_base64url_inverse() noexcept {
  std::array<std::int8_t, 256> inverse{};
  inverse.fill(-1);
  std::int8_t alphabet_value = 0;
  for (const unsigned char character : kBase64UrlAlphabet) {
    inverse[character] = alphabet_value;
    ++alphabet_value;
  }
  return inverse;
}

inline constexpr auto kBase64UrlInverse = make_base64url_inverse();

[[noreturn]] void invalid_input() { throw GuardError(ErrorCode::kInvalidInput); }

} // namespace

std::string base64url_encode(const std::string_view input) {
  std::string result;
  result.reserve(base64url_encoded_size(input.size()));
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const unsigned char character : input) {
    accumulator = (accumulator << 8U) | character;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result.push_back(kBase64UrlAlphabet[(accumulator >> bits) & 0x3fU]);
    }
  }
  if (bits > 0) {
    result.push_back(kBase64UrlAlphabet[(accumulator << (6 - bits)) & 0x3fU]);
  }
  return result;
}

std::string base64url_decode(const std::string_view input, const std::size_t maximum_output_bytes) {
  const std::size_t remainder = input.size() % 4U;
  if (remainder == 1U)
    invalid_input();
  const std::size_t tail_bytes = remainder == 0U ? 0U : remainder - 1U;
  const std::size_t quartets = input.size() / 4U;
  if (quartets > (std::numeric_limits<std::size_t>::max() - tail_bytes) / 3U)
    invalid_input();
  const std::size_t output_bytes = quartets * 3U + tail_bytes;
  if (output_bytes > maximum_output_bytes)
    invalid_input();

  for (const unsigned char character : input) {
    if (kBase64UrlInverse[character] < 0)
      invalid_input();
  }
  if (remainder == 2U && (kBase64UrlInverse[static_cast<unsigned char>(input.back())] & 0x0f) != 0)
    invalid_input();
  if (remainder == 3U && (kBase64UrlInverse[static_cast<unsigned char>(input.back())] & 0x03) != 0)
    invalid_input();

  std::string result(output_bytes, '\0');
  std::size_t input_offset = 0;
  std::size_t output_offset = 0;
  while (input.size() - input_offset >= 4U) {
    const auto first = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset])]);
    const auto second = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset + 1U])]);
    const auto third = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset + 2U])]);
    const auto fourth = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset + 3U])]);
    const std::uint32_t packed = (first << 18U) | (second << 12U) | (third << 6U) | fourth;
    result[output_offset] = static_cast<char>((packed >> 16U) & 0xffU);
    result[output_offset + 1U] = static_cast<char>((packed >> 8U) & 0xffU);
    result[output_offset + 2U] = static_cast<char>(packed & 0xffU);
    input_offset += 4U;
    output_offset += 3U;
  }
  if (remainder >= 2U) {
    const auto first = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset])]);
    const auto second = static_cast<std::uint32_t>(
        kBase64UrlInverse[static_cast<unsigned char>(input[input_offset + 1U])]);
    result[output_offset] = static_cast<char>((first << 2U) | (second >> 4U));
    if (remainder == 3U) {
      const auto third = static_cast<std::uint32_t>(
          kBase64UrlInverse[static_cast<unsigned char>(input[input_offset + 2U])]);
      result[output_offset + 1U] = static_cast<char>(((second & 0x0fU) << 4U) | (third >> 2U));
    }
  }
  return result;
}

Request parse_request(const std::string_view line, std::string& request_id) {
  if (line.size() > kMaxRequestPayloadBytes)
    invalid_input();
  const auto fields = split(line, '\t');
  if (fields.size() < 3 || fields[1] != kProtocolVersion || !is_safe_token(fields[0], 1, 20) ||
      !is_safe_token(fields[2], 1, 32)) {
    invalid_input();
  }
  request_id = fields[0];
  std::vector<std::string> arguments;
  arguments.reserve(fields.size() - 3);
  if (fields[2] == kWriteFileCommandName) {
    if (fields.size() != 5U)
      invalid_input();
    arguments.push_back(base64url_decode(fields[3], kMaxFileTokenBytes));
    arguments.push_back(base64url_decode(fields[4], kMaxWriteFileChunkBytes));
    return Request{request_id, parse_command(fields[2], std::move(arguments))};
  }
  for (std::size_t index = 3; index < fields.size(); ++index) {
    arguments.push_back(base64url_decode(fields[index]));
  }
  return Request{request_id, parse_command(fields[2], std::move(arguments))};
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
