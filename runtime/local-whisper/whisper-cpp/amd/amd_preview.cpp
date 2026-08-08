#include "local_whisper/whisper_cpp/amd_preview.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

namespace local_whisper::whisper_cpp {
namespace {

bool version_at_least(std::uint16_t major, std::uint16_t minor, std::uint16_t required_major,
                      std::uint16_t required_minor) noexcept {
  return major > required_major || (major == required_major && minor >= required_minor);
}

void validate_common_runtime(bool manifest_owned_loader, bool driver_compatible,
                             bool backend_initialized, bool allocation_succeeded,
                             bool dispatch_succeeded) {
  if (!manifest_owned_loader)
    throw CoreError(FailureCode::runtime_prerequisite_missing,
                    "AMD runtime dependency authority is incomplete");
  if (!driver_compatible)
    throw CoreError(FailureCode::driver_incompatible, "AMD driver/runtime contract mismatch");
  if (!backend_initialized)
    throw CoreError(FailureCode::backend_init_failed, "AMD backend activation failed");
  if (!allocation_succeeded || !dispatch_succeeded)
    throw CoreError(FailureCode::allocation_failed, "AMD allocation or dispatch failed");
}

} // namespace

void AmdPreviewValidator::validate_vulkan(const VulkanPreviewObservation& observation) {
  if (observation.pci_vendor_id != kAmdPciVendorId || !observation.physical_device ||
      observation.software_implementation)
    throw CoreError(FailureCode::device_not_allowlisted,
                    "Vulkan device is not an allowlisted physical AMD adapter");
  if (!version_at_least(observation.generated_shader_major, observation.generated_shader_minor, 1U,
                        3U) ||
      !version_at_least(observation.api_major, observation.api_minor,
                        observation.generated_shader_major, observation.generated_shader_minor) ||
      !observation.storage_buffer_16_bit_access || !observation.required_extensions_available)
    throw CoreError(FailureCode::device_feature_missing,
                    "Vulkan API or feature contract is incomplete");
  validate_common_runtime(observation.manifest_owned_loader, observation.driver_compatible,
                          observation.backend_initialized, observation.allocation_succeeded,
                          observation.dispatch_succeeded);
}

void AmdPreviewValidator::validate_hip(const HipPreviewObservation& observation) {
  if (!observation.approved_exact_row || !observation.exact_platform_intersection ||
      !observation.exact_rocm_intersection || !observation.exact_pci_gfx_intersection)
    throw CoreError(FailureCode::device_not_allowlisted,
                    "HIP device has no approved exact compatibility row");
  if (!observation.exact_dependency_closure || !observation.manifest_owned_loader)
    throw CoreError(FailureCode::runtime_prerequisite_missing,
                    "HIP runtime dependency authority is incomplete");
  if (!observation.driver_compatible)
    throw CoreError(FailureCode::driver_incompatible, "HIP driver/runtime contract mismatch");
  if (observation.pcie_atomics_required && !observation.pcie_atomics_available)
    throw CoreError(FailureCode::device_feature_missing, "HIP PCIe atomics requirement failed");
  if (!observation.kfd_accessible || !observation.render_node_accessible)
    throw CoreError(FailureCode::gpu_permission_denied, "HIP device access is unavailable");
  if (!observation.backend_initialized)
    throw CoreError(FailureCode::backend_init_failed, "HIP backend activation failed");
  if (!observation.allocation_succeeded || !observation.dispatch_succeeded)
    throw CoreError(FailureCode::allocation_failed, "HIP allocation or dispatch failed");
}

ValidatedDeviceLoadObservation AmdPreviewValidator::validate_load(
    const SelectedDevice& selected, std::string_view expected_backend,
    std::uint16_t authority_ordinal, const std::string& authority_registry_fingerprint,
    const NativeDeviceLoadObservation& observation) {
  if ((expected_backend != "hip" && expected_backend != "vulkan") ||
      selected.backend_id != expected_backend)
    throw CoreError(FailureCode::backend_unsupported, "AMD backend selection changed");
  return validate_device_load_observation(selected, authority_ordinal,
                                          authority_registry_fingerprint, observation);
}

} // namespace local_whisper::whisper_cpp
