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

} // namespace local_whisper::whisper_cpp
