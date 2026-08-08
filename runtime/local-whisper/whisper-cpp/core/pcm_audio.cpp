#include "local_whisper/whisper_cpp/pcm_audio.hpp"

#include "local_whisper/common/canonical_wav.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <cstddef>
#include <cstdint>
#include <new>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {

PcmAudio::PcmAudio(std::vector<float> samples) : samples_(std::move(samples)) {}

PcmAudio PcmAudio::from_canonical_wav(std::span<const std::uint8_t> bytes) {
  local_whisper::common::CanonicalWavDescriptor descriptor{};
  try {
    descriptor = local_whisper::common::validate_canonical_wav(bytes);
  } catch (...) {
    throw CoreError(FailureCode::audio_format_unsupported, "invalid canonical PCM audio");
  }
  try {
    std::vector<float> samples(descriptor.sample_count);
    for (std::size_t index = 0; index < samples.size(); ++index) {
      const auto offset = local_whisper::common::kCanonicalWavHeaderBytes + index * 2U;
      const auto encoded =
          static_cast<std::uint16_t>(bytes[offset]) |
          static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1U]) << 8U);
      const auto sample = static_cast<std::int16_t>(encoded);
      samples[index] = static_cast<float>(sample) / 32768.0F;
    }
    return PcmAudio(std::move(samples));
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "PCM allocation failed");
  }
}

std::span<const float> PcmAudio::samples() const noexcept { return samples_; }

} // namespace local_whisper::whisper_cpp
