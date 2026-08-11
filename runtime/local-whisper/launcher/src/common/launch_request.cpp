#include "local_whisper/launcher/launch_request.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <charconv>
#include <stdexcept>
#include <string_view>
#include <vector>

#ifdef _WIN32
#include <io.h>
#else
#include <unistd.h>
#endif

namespace local_whisper::launcher {
namespace {

constexpr std::size_t kBaseFieldCount = 20;
constexpr std::size_t kFullLoadFieldCount = 22;
constexpr std::size_t kAuthorityRequestBytes = 234;
std::vector<std::string> split_fields(const std::string& line) {
  std::vector<std::string> fields;
  std::size_t start = 0;
  while (start <= line.size()) {
    const std::size_t separator = line.find('\t', start);
    fields.emplace_back(line.substr(start, separator - start));
    if (separator == std::string::npos)
      break;
    start = separator + 1;
  }
  if (fields.size() != kBaseFieldCount && fields.size() != kFullLoadFieldCount)
    throw std::runtime_error("invalid launch field count");
  return fields;
}

unsigned char decode_character(char value) {
  if (value >= 'A' && value <= 'Z')
    return static_cast<unsigned char>(value - 'A');
  if (value >= 'a' && value <= 'z')
    return static_cast<unsigned char>(value - 'a' + 26);
  if (value >= '0' && value <= '9')
    return static_cast<unsigned char>(value - '0' + 52);
  if (value == '-')
    return 62;
  if (value == '_')
    return 63;
  throw std::runtime_error("invalid base64url character");
}

std::string decode_base64url(const std::string& value) {
  if (value.empty() || value.size() > 48 * 1024 || value.size() % 4 == 1)
    throw std::runtime_error("invalid base64url length");
  std::string decoded;
  decoded.reserve(value.size() * 3 / 4);
  std::uint32_t accumulator = 0;
  unsigned int bits = 0;
  for (const char character : value) {
    accumulator = (accumulator << 6U) | decode_character(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      decoded.push_back(static_cast<char>((accumulator >> bits) & 0xffU));
    }
  }
  if (bits != 0 && (accumulator & ((1U << bits) - 1U)) != 0)
    throw std::runtime_error("non-canonical base64url");
  if (decoded.find('\0') != std::string::npos ||
      std::any_of(decoded.begin(), decoded.end(), [](unsigned char character) {
        return character < 0x20U || character == 0x7fU;
      })) {
    throw std::runtime_error("unsafe decoded field");
  }
  return decoded;
}

std::vector<std::uint8_t> decode_base64url_bytes(const std::string& value) {
  if (value.empty() || value.size() > 4096U || value.size() % 4U == 1U)
    throw std::runtime_error("invalid binary base64url length");
  std::vector<std::uint8_t> decoded;
  decoded.reserve(value.size() * 3U / 4U);
  std::uint32_t accumulator = 0;
  unsigned int bits = 0;
  for (const char character : value) {
    accumulator = (accumulator << 6U) | decode_character(character);
    bits += 6U;
    if (bits >= 8U) {
      bits -= 8U;
      decoded.push_back(static_cast<std::uint8_t>((accumulator >> bits) & 0xffU));
    }
  }
  if (bits != 0U && (accumulator & ((1U << bits) - 1U)) != 0U)
    throw std::runtime_error("non-canonical binary base64url");
  return decoded;
}

template <typename Number> Number parse_number(const std::string& value) {
  Number result{};
  const auto parsed = std::from_chars(value.data(), value.data() + value.size(), result);
  if (parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size())
    throw std::runtime_error("invalid numeric field");
  return result;
}

bool is_safe_nonce(const std::string& value) {
  return value.size() >= 16 && value.size() <= 128 &&
         std::all_of(value.begin(), value.end(), [](unsigned char character) {
           return (character >= 'A' && character <= 'Z') ||
                  (character >= 'a' && character <= 'z') ||
                  (character >= '0' && character <= '9') || character == '_' || character == '-';
         });
}

bool is_sha256(const std::string& value) {
  return value.size() == 64 && std::all_of(value.begin(), value.end(), [](unsigned char character) {
           return (character >= '0' && character <= '9') || (character >= 'a' && character <= 'f');
         });
}

IdentityExpectation parse_identity(const std::vector<std::string>& fields, std::size_t offset) {
  IdentityExpectation identity;
  identity.device_or_volume_id = decode_base64url(fields.at(offset));
  identity.file_id = decode_base64url(fields.at(offset + 1));
  identity.link_count = parse_number<std::uint64_t>(fields.at(offset + 2));
  identity.mode = parse_number<std::uint32_t>(fields.at(offset + 3));
  identity.parent_file_id = decode_base64url(fields.at(offset + 4));
  identity.size_bytes = parse_number<std::uint64_t>(fields.at(offset + 5));
  if (fields.at(offset + 6) == "directory")
    identity.directory = true;
  else if (fields.at(offset + 6) != "regular")
    throw std::runtime_error("invalid identity type");
  if (identity.link_count == 0 || identity.mode > 0777U)
    throw std::runtime_error("invalid identity metadata");
  return identity;
}

WorkerLaunchMode parse_launch_mode(const std::string& value) {
  if (value == "fullLoad")
    return WorkerLaunchMode::full_load;
  if (value == "probe")
    return WorkerLaunchMode::probe;
  if (value == "registry")
    return WorkerLaunchMode::registry;
  throw std::runtime_error("invalid worker launch mode");
}

} // namespace

LaunchRequest LaunchRequestParser::parse(const std::string& line) const {
  if (line.size() > kMaximumLaunchRequestBytes)
    throw std::runtime_error("launcher request exceeded");
  const std::vector<std::string> fields = split_fields(line);
  if (fields.at(0) != "LWLP2" || !is_safe_nonce(fields.at(1)) || !is_sha256(fields.at(5)))
    throw std::runtime_error("invalid launcher header");
  LaunchRequest request;
  request.app_instance_nonce = fields.at(1);
  request.launch_mode = parse_launch_mode(fields.at(2));
  request.worker_path = decode_base64url(fields.at(3));
  request.working_directory = decode_base64url(fields.at(4));
  request.worker_sha256 = fields.at(5);
  request.worker_identity = parse_identity(fields, 6);
  request.directory_identity = parse_identity(fields, 13);
  if (request.worker_identity.directory || !request.directory_identity.directory)
    throw std::runtime_error("invalid launcher identity kinds");
  if (request.launch_mode == WorkerLaunchMode::full_load) {
    if (fields.size() != kFullLoadFieldCount)
      throw std::runtime_error("missing model launch authority");
    request.model_authority_request = decode_base64url_bytes(fields.at(20));
    request.worker_bootstrap_bytes = parse_number<std::uint32_t>(fields.at(21));
    if (request.model_authority_request.size() != kAuthorityRequestBytes ||
        (request.worker_bootstrap_bytes != 0U && request.worker_bootstrap_bytes != 40U)) {
      throw std::runtime_error("invalid model launch authority");
    }
  } else if (fields.size() != kBaseFieldCount) {
    throw std::runtime_error("unexpected model launch authority");
  }
  return request;
}

std::string read_bootstrap_line(int descriptor) {
  std::string line;
  line.reserve(1024);
  std::array<char, 1024> buffer{};
  while (line.size() <= kMaximumLaunchRequestBytes) {
#ifdef _WIN32
    const int count = _read(descriptor, buffer.data(), static_cast<unsigned int>(buffer.size()));
#else
    const ssize_t count = read(descriptor, buffer.data(), buffer.size());
#endif
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("launcher control closed");
    const auto end = std::find(buffer.begin(), buffer.begin() + count, '\n');
    line.append(buffer.begin(), end);
    if (end != buffer.begin() + count) {
      if (end + 1 != buffer.begin() + count)
        throw std::runtime_error("launcher trailing bootstrap bytes");
      return line;
    }
  }
  throw std::runtime_error("launcher bootstrap exceeded");
}

} // namespace local_whisper::launcher
