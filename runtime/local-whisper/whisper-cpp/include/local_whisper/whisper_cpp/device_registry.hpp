#pragma once

#include "local_whisper/common/device_proof.hpp"

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace local_whisper::whisper_cpp {

struct NativeDevice final {
  local_whisper::common::RegistryDeviceType type;
  std::string backend_id;
  std::string native_identity;
  std::uintptr_t native_token;
};

class NativeDeviceDiscovery {
public:
  virtual ~NativeDeviceDiscovery() = default;
  [[nodiscard]] virtual std::vector<NativeDevice> enumerate() = 0;
};

struct SelectedDevice final {
  std::uint16_t ordinal;
  local_whisper::common::RegistryDeviceType type;
  std::string backend_id;
  std::string native_identity;
  std::uintptr_t native_token;
  std::string registry_fingerprint;
};

struct NativeDeviceLoadObservation final {
  std::string activated_native_identity;
  std::string primary_state_native_identity;
  std::uint64_t model_weight_bytes;
  bool single_gpu_model_owner;
};

struct ValidatedDeviceLoadObservation final {
  std::string activated_native_identity;
  std::string primary_state_native_identity;
  std::uint64_t model_weight_bytes;
};

[[nodiscard]] std::string canonical_pci_identity(std::string_view identity);
[[nodiscard]] ValidatedDeviceLoadObservation
validate_device_load_observation(const SelectedDevice& selected, std::uint16_t authority_ordinal,
                                 const std::string& authority_registry_fingerprint,
                                 const NativeDeviceLoadObservation& observation);

class DeviceRegistry final {
public:
  DeviceRegistry(NativeDeviceDiscovery& discovery, std::string engine_id,
                 std::string runtime_build_digest, std::string backend_id);

  [[nodiscard]] SelectedDevice resolve(std::uint16_t ordinal,
                                       std::string_view expected_fingerprint);
  [[nodiscard]] local_whisper::common::DeviceRegistry capture();

private:
  struct Snapshot final {
    local_whisper::common::DeviceRegistry proof_registry;
    std::vector<NativeDevice> native_devices;
  };

  [[nodiscard]] Snapshot capture_snapshot();
  [[nodiscard]] bool same_snapshot(const Snapshot& left, const Snapshot& right) const noexcept;

  NativeDeviceDiscovery& discovery_;
  std::string engine_id_;
  std::string runtime_build_digest_;
  std::string backend_id_;
};

} // namespace local_whisper::whisper_cpp
