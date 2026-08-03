#include "local_whisper/fs_guard/model_launch_request.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"
#include "local_whisper/fs_guard/validation.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <charconv>
#include <limits>
#include <string_view>

#ifdef _WIN32
#include <io.h>
#else
#include <unistd.h>
#endif

namespace local_whisper::fs_guard {
namespace {

constexpr std::size_t kFieldCount = 20;
constexpr std::size_t kMaximumBootstrapBytes = 64U * 1024U;

template <typename Number> Number parse_number(const std::string& value) {
  if (value.empty() || (value.size() > 1U && value.front() == '0'))
    throw GuardError(ErrorCode::kInvalidInput);
  Number result{};
  const auto parsed = std::from_chars(value.data(), value.data() + value.size(), result);
  if (parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size())
    throw GuardError(ErrorCode::kInvalidInput);
  return result;
}

bool is_sha256(const std::string_view value) {
  return value.size() == 64U &&
         std::all_of(value.begin(), value.end(), [](const unsigned char character) {
           return (character >= '0' && character <= '9') || (character >= 'a' && character <= 'f');
         });
}

void require_safe_decoded(const std::string& value, const std::size_t maximum_bytes) {
  if (value.empty() || value.size() > maximum_bytes || value.find('\0') != std::string::npos ||
      value.find('\n') != std::string::npos || value.find('\r') != std::string::npos) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
}

void validate_launcher_bootstrap(const std::string& value, const std::string& nonce) {
  require_safe_decoded(value, kMaximumBootstrapBytes);
  const auto fields = split(value, '\t');
  if (fields.size() != 20U || fields[0] != "LWLP2" || fields[1] != nonce ||
      fields[2] != "fullLoad") {
    throw GuardError(ErrorCode::kInvalidInput);
  }
}

} // namespace

ModelLaunchRequest ModelLaunchRequestParser::parse(const std::string& line) const {
  const auto fields = split(line, '\t');
  if (fields.size() != kFieldCount || fields[0] != "LWGL1" || !is_safe_token(fields[1], 16, 128) ||
      !is_sha256(fields[3]) || !is_sha256(fields[6]) || !is_sha256(fields[16]) ||
      !is_sha256(fields[17])) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
  ModelLaunchRequest request;
  request.app_instance_nonce = fields[1];
  request.launcher_path = base64url_decode(fields[2]);
  request.launcher_sha256 = fields[3];
  request.launcher_bootstrap = base64url_decode(fields[4]);
  request.model_path = base64url_decode(fields[5]);
  request.model_sha256 = fields[6];
  request.model_size_bytes = parse_number<std::uint64_t>(fields[7]);
  request.model_identity.device_id = base64url_decode(fields[8]);
  request.model_identity.file_id = base64url_decode(fields[9]);
  request.model_identity.link_count = parse_number<std::uint64_t>(fields[10]);
  request.model_identity.mode = parse_number<std::uint32_t>(fields[11]);
  request.model_identity.parent_file_id = base64url_decode(fields[12]);
  request.model_identity.size_bytes = parse_number<std::uint64_t>(fields[13]);
  request.configuration_epoch = parse_number<std::uint64_t>(fields[15]);
  request.lease_token_sha256 = fields[16];
  request.model_identity_sha256 = fields[17];
  const std::string operation_nonce = base64url_decode(fields[18]);
  request.worker_bootstrap_bytes = parse_number<std::uint32_t>(fields[19]);
  require_safe_decoded(request.launcher_path, 32U * 1024U);
  require_safe_decoded(request.model_path, 32U * 1024U);
  validate_launcher_bootstrap(request.launcher_bootstrap, request.app_instance_nonce);
  if (fields[14] != "regular" || request.model_size_bytes == 0U ||
      request.model_identity.size_bytes != request.model_size_bytes ||
      request.model_identity.link_count != 1U || request.model_identity.mode > 0777U ||
      request.configuration_epoch >
          static_cast<std::uint64_t>(std::numeric_limits<std::int64_t>::max()) ||
      operation_nonce.size() != request.operation_nonce.size() ||
      std::all_of(operation_nonce.begin(), operation_nonce.end(),
                  [](const char value) { return value == 0; }) ||
      (request.worker_bootstrap_bytes != 0U && request.worker_bootstrap_bytes != 40U)) {
    throw GuardError(ErrorCode::kInvalidInput);
  }
  std::copy(operation_nonce.begin(), operation_nonce.end(), request.operation_nonce.begin());
  return request;
}

std::string read_model_launch_bootstrap(const int descriptor) {
  std::string line;
  line.reserve(1024);
  std::array<char, 1024> buffer{};
  while (line.size() <= kMaximumBootstrapBytes) {
#ifdef _WIN32
    const int count = _read(descriptor, buffer.data(), static_cast<unsigned int>(buffer.size()));
#else
    const ssize_t count = read(descriptor, buffer.data(), buffer.size());
#endif
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw GuardError(ErrorCode::kInvalidInput);
    const auto end = std::find(buffer.begin(), buffer.begin() + count, '\n');
    line.append(buffer.begin(), end);
    if (end != buffer.begin() + count) {
      if (end + 1 != buffer.begin() + count)
        throw GuardError(ErrorCode::kInvalidInput);
      return line;
    }
  }
  throw GuardError(ErrorCode::kInvalidInput);
}

} // namespace local_whisper::fs_guard
