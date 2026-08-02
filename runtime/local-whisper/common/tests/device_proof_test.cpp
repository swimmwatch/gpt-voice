#include "local_whisper/common/device_proof.hpp"

#include "test_support.hpp"

#include <gtest/gtest.h>

namespace local_whisper::common {
namespace {

DeviceRegistry registry_from_json(const nlohmann::json& value) {
  DeviceRegistry result{
      value.at("engineId"), value.at("runtimeBuildDigest"), value.at("backendId"), {}};
  for (const auto& entry : value.at("entries")) {
    result.entries.push_back(
        {entry.at("ordinal").get<std::uint16_t>(),
         entry.at("type") == "gpu" ? RegistryDeviceType::gpu : RegistryDeviceType::integrated_gpu,
         entry.at("backendId"), entry.at("nativeIdentity")});
  }
  return result;
}

DeviceProofInput proof_from_json(const nlohmann::json& value) {
  return {value.at("authorityId"),
          value.at("challenge"),
          std::stoull(value.at("configurationEpoch").get<std::string>()),
          std::stoull(value.at("topologyGeneration").get<std::string>()),
          value.at("engineId"),
          value.at("runtimeBuildDigest"),
          value.at("backendId"),
          value.at("registryFingerprint"),
          value.at("selectedOrdinal").get<std::uint16_t>(),
          value.at("activatedOrdinal").get<std::uint16_t>(),
          value.at("actualNativeIdentity"),
          value.at("primaryExecutionNativeIdentity"),
          std::stoull(value.at("selectedDeviceModelWeightBytes").get<std::string>())};
}

} // namespace

TEST(DeviceProof, ReproducesRegistryProbeAndLoadVectors) {
  const auto proofs = test_support::manifest().at("proofs");
  EXPECT_EQ(registry_fingerprint(registry_from_json(proofs.at("registry"))),
            proofs.at("registryFingerprint").get<std::string>());
  EXPECT_EQ(device_proof(DeviceProofDomain::probe, proof_from_json(proofs.at("probe").at("input"))),
            proofs.at("probe").at("expectedProof").get<std::string>());
  EXPECT_EQ(device_proof(DeviceProofDomain::load, proof_from_json(proofs.at("load").at("input"))),
            proofs.at("load").at("expectedProof").get<std::string>());
  for (const auto& vector : proofs.at("registries")) {
    EXPECT_EQ(registry_fingerprint(registry_from_json(vector.at("input"))),
              vector.at("expectedFingerprint").get<std::string>())
        << vector.at("name");
  }
  for (const auto& vector : proofs.at("boundaries")) {
    const auto domain =
        vector.at("domain") == "probe" ? DeviceProofDomain::probe : DeviceProofDomain::load;
    EXPECT_EQ(device_proof(domain, proof_from_json(vector.at("input"))),
              vector.at("expectedProof").get<std::string>())
        << vector.at("name");
  }
}

TEST(DeviceProof, RejectsCrossDomainWeightsAndDuplicateRegistryAuthority) {
  const auto proofs = test_support::manifest().at("proofs");
  const auto probe = proof_from_json(proofs.at("probe").at("input"));
  const auto load = proof_from_json(proofs.at("load").at("input"));
  EXPECT_THROW(static_cast<void>(device_proof(DeviceProofDomain::load, probe)), std::runtime_error);
  EXPECT_THROW(static_cast<void>(device_proof(DeviceProofDomain::probe, load)), std::runtime_error);
  auto registry = registry_from_json(proofs.at("registry"));
  registry.entries.push_back(registry.entries.front());
  EXPECT_THROW(static_cast<void>(registry_fingerprint(registry)), std::runtime_error);
}

} // namespace local_whisper::common
