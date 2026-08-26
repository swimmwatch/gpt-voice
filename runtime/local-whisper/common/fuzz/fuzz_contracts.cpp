#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/canonical_wav.hpp"
#include "local_whisper/common/device_proof.hpp"
#include "local_whisper/common/frame_codec.hpp"
#include "local_whisper/common/model_authority.hpp"

#include <iostream>

int main() {
  using namespace local_whisper::common;
  std::cout << "frame-codec\t" << kFrameHeaderBytes + kMaxAudioFrameBodyBytes + 1U << '\n';
  std::cout << "bounded-json\t" << kBoundedJsonMaxRawBytes + 1U << '\n';
  std::cout << "canonical-wav\t" << kCanonicalWavMaxTotalBytes + 1U << '\n';
  std::cout << "model-authority\t" << kAuthorityAcknowledgmentBytes + 1U << '\n';
  std::cout << "device-proof\t" << kDeviceProofMaxCanonicalFieldBytes + 1U << '\n';
  return 0;
}
