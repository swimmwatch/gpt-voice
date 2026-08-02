#pragma once

#include "local_whisper/whisper_cpp/device_registry.hpp"

#include <cstdint>
#include <string>

namespace local_whisper::whisper_cpp {

inline constexpr std::uint32_t kAmdPciVendorId = 0x1002U;

struct VulkanPreviewObservation final {
  std::uint32_t pci_vendor_id;
  std::uint16_t api_major;
  std::uint16_t api_minor;
  std::uint16_t generated_shader_major;
  std::uint16_t generated_shader_minor;
  bool physical_device;
  bool software_implementation;
  bool storage_buffer_16_bit_access;
  bool required_extensions_available;
  bool manifest_owned_loader;
  bool driver_compatible;
  bool backend_initialized;
  bool allocation_succeeded;
  bool dispatch_succeeded;
};

struct HipPreviewObservation final {
  bool approved_exact_row;
  bool exact_platform_intersection;
  bool exact_rocm_intersection;
  bool exact_dependency_closure;
  bool exact_pci_gfx_intersection;
  bool pcie_atomics_required;
  bool pcie_atomics_available;
  bool kfd_accessible;
  bool render_node_accessible;
  bool manifest_owned_loader;
  bool driver_compatible;
  bool backend_initialized;
  bool allocation_succeeded;
  bool dispatch_succeeded;
};

class AmdPreviewValidator final {
public:
  static void validate_vulkan(const VulkanPreviewObservation& observation);
  static void validate_hip(const HipPreviewObservation& observation);
  [[nodiscard]] static ValidatedDeviceLoadObservation
  validate_load(const SelectedDevice& selected, std::string_view expected_backend,
                std::uint16_t authority_ordinal, const std::string& authority_registry_fingerprint,
                const NativeDeviceLoadObservation& observation);
};

} // namespace local_whisper::whisper_cpp
