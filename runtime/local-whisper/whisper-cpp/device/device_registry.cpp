#include "local_whisper/whisper_cpp/device_registry.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <cctype>
#include <limits>
#include <unordered_set>
#include <utility>

namespace local_whisper::whisper_cpp {
namespace {

bool is_hex(char value) noexcept {
  return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f') ||
         (value >= 'A' && value <= 'F');
}

bool fixed_hex(std::string_view value, std::size_t offset, std::size_t count) noexcept {
  return offset + count <= value.size() &&
         std::all_of(value.begin() + static_cast<std::ptrdiff_t>(offset),
                     value.begin() + static_cast<std::ptrdiff_t>(offset + count), is_hex);
}

} // namespace

std::string canonical_pci_identity(std::string_view identity) {
  const bool short_domain = identity.size() == 12U;
  const bool long_domain = identity.size() == 16U;
  const std::size_t domain = short_domain ? 4U : 8U;
  if ((!short_domain && !long_domain) || !fixed_hex(identity, 0U, domain) ||
      identity[domain] != ':' || !fixed_hex(identity, domain + 1U, 2U) ||
      identity[domain + 3U] != ':' || !fixed_hex(identity, domain + 4U, 2U) ||
      identity[domain + 6U] != '.' || identity[domain + 7U] < '0' || identity[domain + 7U] > '7') {
    throw CoreError(FailureCode::device_feature_missing,
                    "invalid durable accelerator device identity");
  }
  std::string result(identity);
  std::transform(result.begin(), result.end(), result.begin(),
                 [](unsigned char value) { return static_cast<char>(std::tolower(value)); });
  return result;
}

ValidatedDeviceLoadObservation
validate_device_load_observation(const SelectedDevice& selected, std::uint16_t authority_ordinal,
                                 const std::string& authority_registry_fingerprint,
                                 const NativeDeviceLoadObservation& observation) {
  if (observation.model_weight_bytes == 0U || !observation.single_gpu_model_owner)
    throw CoreError(FailureCode::device_proof_failed, "accelerator model ownership proof failed");
  const auto activated = canonical_pci_identity(observation.activated_native_identity);
  const auto primary = canonical_pci_identity(observation.primary_state_native_identity);
  if (activated != selected.native_identity || primary != selected.native_identity ||
      authority_ordinal != selected.ordinal ||
      authority_registry_fingerprint != selected.registry_fingerprint)
    throw CoreError(FailureCode::device_proof_failed, "accelerator state device proof changed");
  return {activated, primary, observation.model_weight_bytes};
}

DeviceRegistry::DeviceRegistry(NativeDeviceDiscovery& discovery, std::string engine_id,
                               std::string runtime_build_digest, std::string backend_id)
    : discovery_(discovery), engine_id_(std::move(engine_id)),
      runtime_build_digest_(std::move(runtime_build_digest)), backend_id_(std::move(backend_id)) {}

DeviceRegistry::Snapshot DeviceRegistry::capture_snapshot() {
  auto discovered = discovery_.enumerate();
  if (discovered.size() > 256U)
    throw CoreError(FailureCode::device_proof_failed,
                    "accelerator registry exceeds authority limit");
  local_whisper::common::DeviceRegistry proof{engine_id_, runtime_build_digest_, backend_id_, {}};
  std::vector<NativeDevice> filtered;
  std::unordered_set<std::string> identities;
  for (auto& device : discovered) {
    if (device.type != local_whisper::common::RegistryDeviceType::gpu &&
        device.type != local_whisper::common::RegistryDeviceType::integrated_gpu)
      continue;
    if (device.backend_id != backend_id_)
      continue;
    device.native_identity = canonical_pci_identity(device.native_identity);
    if (!identities.insert(device.native_identity).second)
      throw CoreError(FailureCode::device_proof_failed, "duplicate accelerator device identity");
    if (filtered.size() > std::numeric_limits<std::uint16_t>::max())
      throw CoreError(FailureCode::device_proof_failed, "accelerator registry ordinal overflow");
    const auto ordinal = static_cast<std::uint16_t>(filtered.size());
    proof.entries.push_back({ordinal, device.type, device.backend_id, device.native_identity});
    filtered.push_back(std::move(device));
  }
  return {std::move(proof), std::move(filtered)};
}

bool DeviceRegistry::same_snapshot(const Snapshot& left, const Snapshot& right) const noexcept {
  if (left.proof_registry.entries.size() != right.proof_registry.entries.size())
    return false;
  for (std::size_t index = 0; index < left.proof_registry.entries.size(); ++index) {
    const auto& a = left.proof_registry.entries[index];
    const auto& b = right.proof_registry.entries[index];
    if (a.ordinal != b.ordinal || a.type != b.type || a.backend_id != b.backend_id ||
        a.native_identity != b.native_identity ||
        left.native_devices[index].native_token != right.native_devices[index].native_token)
      return false;
  }
  return true;
}

SelectedDevice DeviceRegistry::resolve(std::uint16_t ordinal,
                                       std::string_view expected_fingerprint) {
  auto first = capture_snapshot();
  if (first.native_devices.empty())
    throw CoreError(FailureCode::device_not_found, "accelerator device registry is empty");
  const auto fingerprint = local_whisper::common::registry_fingerprint(first.proof_registry);
  if (fingerprint != expected_fingerprint)
    throw CoreError(FailureCode::device_proof_failed, "accelerator registry authority changed");
  if (ordinal >= first.native_devices.size())
    throw CoreError(FailureCode::device_proof_failed, "selected accelerator ordinal is missing");
  auto second = capture_snapshot();
  if (!same_snapshot(first, second) ||
      local_whisper::common::registry_fingerprint(second.proof_registry) != fingerprint)
    throw CoreError(FailureCode::device_proof_failed,
                    "accelerator registry changed during activation");
  const auto& selected = first.native_devices[ordinal];
  return {ordinal,
          selected.type,
          selected.backend_id,
          selected.native_identity,
          selected.native_token,
          fingerprint};
}

local_whisper::common::DeviceRegistry DeviceRegistry::capture() {
  return capture_snapshot().proof_registry;
}

} // namespace local_whisper::whisper_cpp
