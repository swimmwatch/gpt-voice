#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::common {

constexpr std::size_t kCanonicalWavHeaderBytes = 44;
constexpr std::size_t kCanonicalWavMaxSamples = 28'800'000;
constexpr std::size_t kCanonicalWavMaxDataBytes = kCanonicalWavMaxSamples * 2;
constexpr std::size_t kCanonicalWavMaxTotalBytes =
    kCanonicalWavHeaderBytes + kCanonicalWavMaxDataBytes;
constexpr std::size_t kCanonicalWavMaxOwnedBytes = 172'800'044;

struct CanonicalWavDescriptor {
  std::size_t total_bytes;
  std::size_t data_bytes;
  std::size_t sample_count;
  double duration_milliseconds;
};

[[nodiscard]] CanonicalWavDescriptor validate_canonical_wav(std::span<const std::uint8_t> bytes);

class WavAccumulator final {
public:
  WavAccumulator(std::string request_id, std::size_t expected_bytes);

  [[nodiscard]] bool append(const std::string& request_id, std::uint32_t sequence, bool final,
                            std::span<const std::uint8_t> bytes);
  [[nodiscard]] std::vector<std::uint8_t> take();
  void cancel() noexcept;
  [[nodiscard]] std::size_t retained_bytes() const noexcept;

private:
  std::string request_id_;
  std::size_t expected_bytes_;
  std::uint32_t next_sequence_ = 0;
  std::vector<std::uint8_t> bytes_;
  bool terminal_ = false;
};

} // namespace local_whisper::common
