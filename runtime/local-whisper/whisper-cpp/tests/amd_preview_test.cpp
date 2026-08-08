#include "local_whisper/whisper_cpp/amd_preview.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <cstdint>
#include <string>

namespace local_whisper::whisper_cpp {
namespace {

VulkanPreviewObservation valid_vulkan() {
  return {kAmdPciVendorId, 1U, 3U, 1U, 3U, true, false, true, true, true, true, true, true, true};
}

HipPreviewObservation valid_hip() {
  return {true, true, true, true, true, true, true, true, true, true, true, true, true, true};
}

void expect_code(FailureCode expected, const auto& action) {
  try {
    action();
    FAIL() << "expected CoreError";
  } catch (const CoreError& error) {
    EXPECT_EQ(error.code(), expected);
  }
}

TEST(AmdPreview, AcceptsOnlyExactSyntheticVulkan13AmdContract) {
  EXPECT_NO_THROW(AmdPreviewValidator::validate_vulkan(valid_vulkan()));
  auto old_api = valid_vulkan();
  old_api.api_minor = 2U;
  expect_code(FailureCode::device_feature_missing,
              [&] { AmdPreviewValidator::validate_vulkan(old_api); });
  auto non_amd = valid_vulkan();
  non_amd.pci_vendor_id = 0x10deU;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_vulkan(non_amd); });
  auto software = valid_vulkan();
  software.software_implementation = true;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_vulkan(software); });
  auto no_storage16 = valid_vulkan();
  no_storage16.storage_buffer_16_bit_access = false;
  expect_code(FailureCode::device_feature_missing,
              [&] { AmdPreviewValidator::validate_vulkan(no_storage16); });
  auto old_target = valid_vulkan();
  old_target.generated_shader_minor = 2U;
  expect_code(FailureCode::device_feature_missing,
              [&] { AmdPreviewValidator::validate_vulkan(old_target); });
  auto missing_extension = valid_vulkan();
  missing_extension.required_extensions_available = false;
  expect_code(FailureCode::device_feature_missing,
              [&] { AmdPreviewValidator::validate_vulkan(missing_extension); });
}

TEST(AmdPreview, MapsVulkanRuntimeFailuresWithoutFallback) {
  auto missing_loader = valid_vulkan();
  missing_loader.manifest_owned_loader = false;
  expect_code(FailureCode::runtime_prerequisite_missing,
              [&] { AmdPreviewValidator::validate_vulkan(missing_loader); });
  auto bad_driver = valid_vulkan();
  bad_driver.driver_compatible = false;
  expect_code(FailureCode::driver_incompatible,
              [&] { AmdPreviewValidator::validate_vulkan(bad_driver); });
  auto init_failure = valid_vulkan();
  init_failure.backend_initialized = false;
  expect_code(FailureCode::backend_init_failed,
              [&] { AmdPreviewValidator::validate_vulkan(init_failure); });
  auto dispatch_failure = valid_vulkan();
  dispatch_failure.dispatch_succeeded = false;
  expect_code(FailureCode::allocation_failed,
              [&] { AmdPreviewValidator::validate_vulkan(dispatch_failure); });
  auto allocation_failure = valid_vulkan();
  allocation_failure.allocation_succeeded = false;
  expect_code(FailureCode::allocation_failed,
              [&] { AmdPreviewValidator::validate_vulkan(allocation_failure); });
}

TEST(AmdPreview, HipRequiresApprovedExactIntersectionAndPermissions) {
  EXPECT_NO_THROW(AmdPreviewValidator::validate_hip(valid_hip()));
  auto no_row = valid_hip();
  no_row.approved_exact_row = false;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_hip(no_row); });
  auto wrong_platform = valid_hip();
  wrong_platform.exact_platform_intersection = false;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_hip(wrong_platform); });
  auto wrong_rocm = valid_hip();
  wrong_rocm.exact_rocm_intersection = false;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_hip(wrong_rocm); });
  auto wrong_pci_gfx = valid_hip();
  wrong_pci_gfx.exact_pci_gfx_intersection = false;
  expect_code(FailureCode::device_not_allowlisted,
              [&] { AmdPreviewValidator::validate_hip(wrong_pci_gfx); });
  auto mixed_closure = valid_hip();
  mixed_closure.exact_dependency_closure = false;
  expect_code(FailureCode::runtime_prerequisite_missing,
              [&] { AmdPreviewValidator::validate_hip(mixed_closure); });
  auto bad_driver = valid_hip();
  bad_driver.driver_compatible = false;
  expect_code(FailureCode::driver_incompatible,
              [&] { AmdPreviewValidator::validate_hip(bad_driver); });
  auto no_atomics = valid_hip();
  no_atomics.pcie_atomics_available = false;
  expect_code(FailureCode::device_feature_missing,
              [&] { AmdPreviewValidator::validate_hip(no_atomics); });
  auto no_kfd = valid_hip();
  no_kfd.kfd_accessible = false;
  expect_code(FailureCode::gpu_permission_denied,
              [&] { AmdPreviewValidator::validate_hip(no_kfd); });
  auto no_render_node = valid_hip();
  no_render_node.render_node_accessible = false;
  expect_code(FailureCode::gpu_permission_denied,
              [&] { AmdPreviewValidator::validate_hip(no_render_node); });
  auto init_failure = valid_hip();
  init_failure.backend_initialized = false;
  expect_code(FailureCode::backend_init_failed,
              [&] { AmdPreviewValidator::validate_hip(init_failure); });
  auto dispatch_failure = valid_hip();
  dispatch_failure.dispatch_succeeded = false;
  expect_code(FailureCode::allocation_failed,
              [&] { AmdPreviewValidator::validate_hip(dispatch_failure); });
}

TEST(AmdPreview, ReusesExactDeviceWeightAndPrimaryStateProof) {
  const std::string fingerprint(64U, 'a');
  const SelectedDevice selected{0U,       local_whisper::common::RegistryDeviceType::gpu,
                                "vulkan", "0000:03:00.0",
                                1U,       fingerprint};
  const auto validated = AmdPreviewValidator::validate_load(
      selected, "vulkan", 0U, fingerprint, {"0000:03:00.0", "0000:03:00.0", 1'048'576U, true});
  EXPECT_EQ(validated.model_weight_bytes, 1'048'576U);
  expect_code(FailureCode::backend_unsupported, [&] {
    static_cast<void>(AmdPreviewValidator::validate_load(
        selected, "hip", 0U, fingerprint, {"0000:03:00.0", "0000:03:00.0", 1'048'576U, true}));
  });
  expect_code(FailureCode::device_proof_failed, [&] {
    static_cast<void>(AmdPreviewValidator::validate_load(
        selected, "vulkan", 0U, fingerprint, {"0000:03:00.0", "0000:04:00.0", 1'048'576U, true}));
  });
}

} // namespace
} // namespace local_whisper::whisper_cpp
