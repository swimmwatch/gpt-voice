#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace local_whisper::common {

enum class RegistryDeviceType : std::uint8_t { gpu = 1, integrated_gpu = 2 };

struct RegistryEntry {
  std::uint16_t ordinal;
  RegistryDeviceType type;
  std::string backend_id;
  std::string native_identity;
};

struct DeviceRegistry {
  std::string engine_id;
  std::string runtime_build_digest;
  std::string backend_id;
  std::vector<RegistryEntry> entries;
};

enum class DeviceProofDomain { probe, load };

struct DeviceProofInput {
  std::string authority_id;
  std::string challenge;
  std::uint64_t configuration_epoch;
  std::uint64_t topology_generation;
  std::string engine_id;
  std::string runtime_build_digest;
  std::string backend_id;
  std::string registry_fingerprint;
  std::uint16_t selected_ordinal;
  std::uint16_t activated_ordinal;
  std::string actual_native_identity;
  std::string primary_execution_native_identity;
  std::uint64_t selected_device_model_weight_bytes;
};

[[nodiscard]] std::string registry_fingerprint(const DeviceRegistry& registry);
[[nodiscard]] std::string device_proof(DeviceProofDomain domain, const DeviceProofInput& input);

} // namespace local_whisper::common
