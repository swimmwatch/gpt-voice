#include "local_whisper/whisper_cpp/device_registry.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

class FakeDiscovery final : public NativeDeviceDiscovery {
public:
  [[nodiscard]] std::vector<NativeDevice> enumerate() override {
    ++calls;
    if (mutate_second && calls == 2U) {
      auto changed = devices;
      changed.front().native_identity = "0000:03:00.0";
      return changed;
    }
    return devices;
  }

  std::vector<NativeDevice> devices;
  bool mutate_second = false;
  std::size_t calls = 0U;
};

NativeDevice cuda(std::string identity, std::uintptr_t token = 1U) {
  return {local_whisper::common::RegistryDeviceType::gpu, "cuda", std::move(identity), token};
}

TEST(DeviceRegistry, NormalizesPciIdentityAndResolvesStableDoubleEnumeration) {
  FakeDiscovery discovery;
  discovery.devices = {cuda("00000000:02:00.0")};
  DeviceRegistry registry(discovery, "whisperCpp", std::string(64U, 'a'), "cuda");
  const auto fingerprint = local_whisper::common::registry_fingerprint(registry.capture());
  discovery.calls = 0U;
  const auto selected = registry.resolve(0U, fingerprint);
  EXPECT_EQ(selected.native_identity, "00000000:02:00.0");
  EXPECT_EQ(selected.ordinal, 0U);
  EXPECT_EQ(discovery.calls, 2U);
}

TEST(DeviceRegistry, RejectsWhitespaceMalformedAndDuplicateIdentity) {
  EXPECT_THROW(static_cast<void>(canonical_pci_identity(" 0000:02:00.0")), CoreError);
  EXPECT_THROW(static_cast<void>(canonical_pci_identity("0000:02:00.8")), CoreError);
  FakeDiscovery discovery;
  discovery.devices = {cuda("0000:02:00.0", 1U), cuda("0000:02:00.0", 2U)};
  DeviceRegistry registry(discovery, "whisperCpp", std::string(64U, 'a'), "cuda");
  EXPECT_THROW(static_cast<void>(registry.capture()), CoreError);
}

TEST(DeviceRegistry, RejectsExpectedFingerprintOrdinalAndSecondEnumerationMutation) {
  FakeDiscovery discovery;
  discovery.devices = {cuda("0000:02:00.0")};
  DeviceRegistry registry(discovery, "whisperCpp", std::string(64U, 'a'), "cuda");
  EXPECT_THROW(static_cast<void>(registry.resolve(0U, std::string(64U, 'b'))), CoreError);
  const auto fingerprint = local_whisper::common::registry_fingerprint(registry.capture());
  discovery.calls = 0U;
  EXPECT_THROW(static_cast<void>(registry.resolve(1U, fingerprint)), CoreError);
  discovery.calls = 0U;
  discovery.mutate_second = true;
  EXPECT_THROW(static_cast<void>(registry.resolve(0U, fingerprint)), CoreError);
}

TEST(DeviceRegistry, ValidatesSelectedDeviceWeightAndPrimaryStateOwnership) {
  const SelectedDevice selected{0U,     local_whisper::common::RegistryDeviceType::gpu,
                                "cuda", "0000:02:00.0",
                                1U,     std::string(64U, 'a')};
  const auto validated = validate_device_load_observation(
      selected, 0U, std::string(64U, 'a'), {"0000:02:00.0", "0000:02:00.0", 42U, true});
  EXPECT_EQ(validated.activated_native_identity, selected.native_identity);
  EXPECT_EQ(validated.primary_state_native_identity, selected.native_identity);
  EXPECT_EQ(validated.model_weight_bytes, 42U);
}

TEST(DeviceRegistry, RejectsZeroWeightSecondGpuWrongOrdinalAndPrimaryState) {
  const SelectedDevice selected{0U,     local_whisper::common::RegistryDeviceType::gpu,
                                "cuda", "0000:02:00.0",
                                1U,     std::string(64U, 'a')};
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 0U, std::string(64U, 'a'), {"0000:02:00.0", "0000:02:00.0", 0U, true})),
      CoreError);
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 0U, std::string(64U, 'a'), {"0000:02:00.0", "0000:02:00.0", 42U, false})),
      CoreError);
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 1U, std::string(64U, 'a'), {"0000:02:00.0", "0000:02:00.0", 42U, true})),
      CoreError);
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 0U, std::string(64U, 'a'), {"0000:03:00.0", "0000:02:00.0", 42U, true})),
      CoreError);
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 0U, std::string(64U, 'a'), {"0000:02:00.0", "0000:03:00.0", 42U, true})),
      CoreError);
  EXPECT_THROW(
      static_cast<void>(validate_device_load_observation(
          selected, 0U, std::string(64U, 'b'), {"0000:02:00.0", "0000:02:00.0", 42U, true})),
      CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
