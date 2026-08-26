#include "local_whisper/whisper_cpp/device_authority.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <array>
#include <utility>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::array<std::uint8_t, 8> kMagic = {'L', 'W', 'D', 'A', '1', 0, 0, 0};

std::string base64url(std::span<const std::uint8_t> bytes) {
  constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string result;
  result.reserve((bytes.size() * 8U + 5U) / 6U);
  std::uint32_t accumulator = 0U;
  unsigned int bits = 0U;
  for (const auto byte : bytes) {
    accumulator = (accumulator << 8U) | byte;
    bits += 8U;
    while (bits >= 6U) {
      bits -= 6U;
      result.push_back(alphabet[(accumulator >> bits) & 0x3fU]);
    }
  }
  if (bits != 0U)
    result.push_back(alphabet[(accumulator << (6U - bits)) & 0x3fU]);
  return result;
}

std::uint64_t read_u64(std::span<const std::uint8_t> bytes) noexcept {
  std::uint64_t value = 0U;
  for (const auto byte : bytes)
    value = (value << 8U) | byte;
  return value;
}

} // namespace

DeviceAuthority::DeviceAuthority(DeviceProofAuthority proof) : proof_(std::move(proof)) {}

DeviceAuthority DeviceAuthority::decode(std::span<const std::uint8_t> record) {
  if (record.size() != kDeviceAuthorityRecordBytes ||
      !std::equal(kMagic.begin(), kMagic.end(), record.begin()))
    throw CoreError(FailureCode::device_proof_failed, "invalid device authority record");
  constexpr std::size_t kAuthorityOffset = 8U;
  constexpr std::size_t kConfigurationOffset = 24U;
  constexpr std::size_t kTopologyOffset = 32U;
  const auto authority = base64url(record.subspan(kAuthorityOffset, 16U));
  if (authority.size() != 22U)
    throw CoreError(FailureCode::device_proof_failed, "invalid device authority identity");
  return DeviceAuthority({authority, read_u64(record.subspan(kConfigurationOffset, 8U)),
                          read_u64(record.subspan(kTopologyOffset, 8U))});
}

const DeviceProofAuthority& DeviceAuthority::proof() const noexcept { return proof_; }

} // namespace local_whisper::whisper_cpp
