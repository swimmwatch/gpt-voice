#include "local_whisper/common/device_proof.hpp"

#include "local_whisper/common/sha256.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string_view>
#include <unordered_set>
#include <vector>

namespace local_whisper::common {
namespace {

constexpr std::array<std::uint8_t, 7> kRegistryDomain = {'L', 'W', 'R', 'E', 'G', '1', 0};
constexpr std::array<std::uint8_t, 8> kProbeDomain = {'L', 'W', 'D', 'E', 'V', '1', 'P', 0};
constexpr std::array<std::uint8_t, 8> kLoadDomain = {'L', 'W', 'D', 'E', 'V', '1', 'L', 0};

int base64url_value(char value) {
  if (value >= 'A' && value <= 'Z')
    return value - 'A';
  if (value >= 'a' && value <= 'z')
    return value - 'a' + 26;
  if (value >= '0' && value <= '9')
    return value - '0' + 52;
  if (value == '-')
    return 62;
  if (value == '_')
    return 63;
  return -1;
}

std::vector<std::uint8_t> decode_base64url(std::string_view value, std::size_t expected_bytes) {
  std::vector<std::uint8_t> result;
  result.reserve(expected_bytes);
  std::uint32_t accumulator = 0;
  unsigned int bits = 0;
  for (const char character : value) {
    const int decoded = base64url_value(character);
    if (decoded < 0)
      throw std::runtime_error("base64url character");
    accumulator = (accumulator << 6U) | static_cast<std::uint32_t>(decoded);
    bits += 6U;
    if (bits >= 8U) {
      bits -= 8U;
      result.push_back(static_cast<std::uint8_t>(accumulator >> bits));
      accumulator &= (1U << bits) - 1U;
    }
  }
  if (result.size() != expected_bytes || accumulator != 0U)
    throw std::runtime_error("base64url length");
  return result;
}

std::array<std::uint8_t, 32> decode_hex_digest(std::string_view value) {
  if (value.size() != 64)
    throw std::runtime_error("digest length");
  auto nibble = [](char character) -> std::uint8_t {
    if (character >= '0' && character <= '9')
      return static_cast<std::uint8_t>(character - '0');
    if (character >= 'a' && character <= 'f')
      return static_cast<std::uint8_t>(character - 'a' + 10);
    throw std::runtime_error("digest character");
  };
  std::array<std::uint8_t, 32> result{};
  for (std::size_t index = 0; index < result.size(); ++index)
    result[index] =
        static_cast<std::uint8_t>((nibble(value[index * 2]) << 4U) | nibble(value[index * 2 + 1]));
  return result;
}

class DigestWriter final {
public:
  void raw(std::span<const std::uint8_t> bytes) {
    bytes_.insert(bytes_.end(), bytes.begin(), bytes.end());
  }
  void raw(const std::vector<std::uint8_t>& bytes) { raw(std::span<const std::uint8_t>(bytes)); }
  template <std::size_t Size> void raw(const std::array<std::uint8_t, Size>& bytes) {
    raw(std::span<const std::uint8_t>(bytes));
  }

  void u16(std::uint16_t value) {
    bytes_.push_back(static_cast<std::uint8_t>(value >> 8U));
    bytes_.push_back(static_cast<std::uint8_t>(value));
  }

  void u64(std::uint64_t value) {
    for (int shift = 56; shift >= 0; shift -= 8)
      bytes_.push_back(static_cast<std::uint8_t>(value >> static_cast<unsigned int>(shift)));
  }

  void field(const std::string& value) {
    if (value.empty() || value.size() > 256U)
      throw std::runtime_error("field length");
    u16(static_cast<std::uint16_t>(value.size()));
    raw(std::span<const std::uint8_t>(reinterpret_cast<const std::uint8_t*>(value.data()),
                                      value.size()));
  }

  [[nodiscard]] std::string finish() const { return hex_sha256(bytes_); }

private:
  std::vector<std::uint8_t> bytes_;
};

} // namespace

std::string registry_fingerprint(const DeviceRegistry& registry) {
  if (registry.entries.size() > 256U)
    throw std::runtime_error("registry count");
  DigestWriter writer;
  writer.raw(kRegistryDomain);
  writer.field(registry.engine_id);
  writer.raw(decode_hex_digest(registry.runtime_build_digest));
  writer.field(registry.backend_id);
  writer.u16(static_cast<std::uint16_t>(registry.entries.size()));
  std::unordered_set<std::uint16_t> ordinals;
  std::unordered_set<std::string> identities;
  for (const auto& entry : registry.entries) {
    if (!ordinals.insert(entry.ordinal).second || !identities.insert(entry.native_identity).second)
      throw std::runtime_error("duplicate registry authority");
    writer.u16(entry.ordinal);
    writer.raw(std::array<std::uint8_t, 1>{static_cast<std::uint8_t>(entry.type)});
    writer.field(entry.backend_id);
    writer.field(entry.native_identity);
  }
  return writer.finish();
}

std::string device_proof(DeviceProofDomain domain, const DeviceProofInput& input) {
  if ((domain == DeviceProofDomain::probe && input.selected_device_model_weight_bytes != 0U) ||
      (domain == DeviceProofDomain::load && input.selected_device_model_weight_bytes == 0U))
    throw std::runtime_error("proof weight");
  DigestWriter writer;
  writer.raw(domain == DeviceProofDomain::probe ? std::span<const std::uint8_t>(kProbeDomain)
                                                : std::span<const std::uint8_t>(kLoadDomain));
  writer.raw(decode_base64url(input.authority_id, 16));
  writer.raw(decode_base64url(input.challenge, 32));
  writer.u64(input.configuration_epoch);
  writer.u64(input.topology_generation);
  writer.field(input.engine_id);
  writer.raw(decode_hex_digest(input.runtime_build_digest));
  writer.field(input.backend_id);
  writer.raw(decode_hex_digest(input.registry_fingerprint));
  writer.u16(input.selected_ordinal);
  writer.u16(input.activated_ordinal);
  writer.field(input.actual_native_identity);
  writer.field(input.primary_execution_native_identity);
  writer.u64(input.selected_device_model_weight_bytes);
  return writer.finish();
}

} // namespace local_whisper::common
