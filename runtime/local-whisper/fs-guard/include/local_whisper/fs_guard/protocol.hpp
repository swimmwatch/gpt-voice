#pragma once

#include "local_whisper/fs_guard/command.hpp"

#include <cstddef>
#include <cstdint>
#include <limits>
#include <string>
#include <string_view>
#include <vector>

namespace local_whisper::fs_guard {

// Canonical owner for the private app/guard protocol constants. TypeScript mirrors are
// parity-tested.
inline constexpr std::string_view kProtocolVersion = "2";
inline constexpr std::size_t kMaxRequestPayloadBytes = 256U * 1024U;
inline constexpr std::size_t kProtocolFutureHeadroomBytes = 4U * 1024U;
inline constexpr std::size_t kMaxRequestIdBytes = 20U;
inline constexpr std::string_view kWriteFileCommandName = "WRITE_FILE";
inline constexpr std::string_view kLeaseTokenPrefix = "lease-";
inline constexpr std::size_t kMaxFileTokenBytes =
    kLeaseTokenPrefix.size() + std::numeric_limits<std::uint64_t>::digits10 + 1U;

[[nodiscard]] constexpr std::size_t base64url_encoded_size(const std::size_t input_bytes) noexcept {
  return (input_bytes / 3U) * 4U + (input_bytes % 3U == 0U ? 0U : input_bytes % 3U + 1U);
}

inline constexpr std::size_t kWriteFileSeparatorBytes = 4U;
inline constexpr std::size_t kMaxEncodedFileTokenBytes = base64url_encoded_size(kMaxFileTokenBytes);
inline constexpr std::size_t kWriteFileFixedPayloadBytes =
    kMaxRequestIdBytes + kProtocolVersion.size() + kWriteFileCommandName.size() +
    kMaxEncodedFileTokenBytes + kWriteFileSeparatorBytes;
inline constexpr std::size_t kMaxEncodedWriteFileChunkBytes =
    kMaxRequestPayloadBytes - kProtocolFutureHeadroomBytes - kWriteFileFixedPayloadBytes;
inline constexpr std::size_t kMaxWriteFileChunkBytes = kMaxEncodedWriteFileChunkBytes * 3U / 4U;

static_assert(base64url_encoded_size(kMaxWriteFileChunkBytes) <= kMaxEncodedWriteFileChunkBytes);
static_assert(base64url_encoded_size(kMaxWriteFileChunkBytes + 1U) >
              kMaxEncodedWriteFileChunkBytes);

struct Request {
  std::string id;
  Command command;
};

[[nodiscard]] std::string base64url_encode(std::string_view input);
[[nodiscard]] std::string
base64url_decode(std::string_view input,
                 std::size_t maximum_output_bytes = kMaxRequestPayloadBytes);
[[nodiscard]] Request parse_request(std::string_view line, std::string& request_id);
[[nodiscard]] std::string serialize_response(std::string_view request_id, bool success,
                                             const std::vector<std::string>& fields);

} // namespace local_whisper::fs_guard
