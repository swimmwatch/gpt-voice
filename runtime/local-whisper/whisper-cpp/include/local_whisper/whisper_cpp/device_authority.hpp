#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <string>

namespace local_whisper::whisper_cpp {

inline constexpr std::size_t kDeviceAuthorityRecordBytes = 40U;

struct DeviceProofAuthority final {
  std::string authority_id;
  std::uint64_t configuration_epoch;
  std::uint64_t topology_generation;
};

class DeviceAuthority final {
public:
  [[nodiscard]] static DeviceAuthority decode(std::span<const std::uint8_t> record);
  [[nodiscard]] static DeviceAuthority receive_from_standard_channel();

  [[nodiscard]] const DeviceProofAuthority& proof() const noexcept;

private:
  explicit DeviceAuthority(DeviceProofAuthority proof);

  DeviceProofAuthority proof_;
};

} // namespace local_whisper::whisper_cpp
