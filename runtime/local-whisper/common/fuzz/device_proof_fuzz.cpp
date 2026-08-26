#include "local_whisper/common/device_proof.hpp"

#include <cstddef>
#include <cstdint>
#include <exception>
#include <span>
#include <string>

namespace {

const std::string kAuthorityId(22, 'A');
const std::string kChallenge(43, 'A');
const std::string kDigest(64, 'a');

} // namespace

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  try {
    const std::string identity(reinterpret_cast<const char*>(data), size);
    const local_whisper::common::DeviceRegistry registry{
        identity,
        kDigest,
        identity,
        {{0, local_whisper::common::RegistryDeviceType::gpu, identity, identity}},
    };
    const std::string fingerprint = local_whisper::common::registry_fingerprint(registry);
    const local_whisper::common::DeviceProofInput input{
        kAuthorityId, kChallenge, 0, 0,        identity, kDigest, identity,
        fingerprint,  0,          0, identity, identity, 0,
    };
    static_cast<void>(local_whisper::common::device_proof(
        local_whisper::common::DeviceProofDomain::probe, input));
  } catch (const std::exception&) {
  }
  return 0;
}
