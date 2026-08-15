#pragma once

#include <cstdint>
#include <span>
#include <vector>

namespace local_whisper::whisper_cpp {

class PcmAudio final {
public:
  static PcmAudio from_canonical_wav(std::span<const std::uint8_t> bytes);

  [[nodiscard]] std::span<const float> samples() const noexcept;

private:
  explicit PcmAudio(std::vector<float> samples);

  std::vector<float> samples_;
};

class PcmAudioConverter {
public:
  virtual ~PcmAudioConverter() = default;
  [[nodiscard]] virtual PcmAudio convert_canonical_wav(std::span<const std::uint8_t> bytes) = 0;
};

class CanonicalPcmAudioConverter final : public PcmAudioConverter {
public:
  [[nodiscard]] PcmAudio convert_canonical_wav(std::span<const std::uint8_t> bytes) override;
};

} // namespace local_whisper::whisper_cpp
