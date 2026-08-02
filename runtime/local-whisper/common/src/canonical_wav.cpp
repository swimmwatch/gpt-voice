#include "local_whisper/common/canonical_wav.hpp"

#include <algorithm>
#include <array>
#include <stdexcept>
#include <utility>

namespace local_whisper::common {
namespace {

std::uint16_t read_u16_le(std::span<const std::uint8_t> bytes, std::size_t offset) {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(static_cast<std::uint16_t>(bytes[offset + 1]) << 8U);
}

std::uint32_t read_u32_le(std::span<const std::uint8_t> bytes, std::size_t offset) {
  return static_cast<std::uint32_t>(bytes[offset]) |
         (static_cast<std::uint32_t>(bytes[offset + 1]) << 8U) |
         (static_cast<std::uint32_t>(bytes[offset + 2]) << 16U) |
         (static_cast<std::uint32_t>(bytes[offset + 3]) << 24U);
}

bool matches(std::span<const std::uint8_t> bytes, std::size_t offset,
             const std::array<std::uint8_t, 4>& expected) {
  return std::equal(expected.begin(), expected.end(),
                    bytes.begin() + static_cast<std::ptrdiff_t>(offset));
}

} // namespace

CanonicalWavDescriptor validate_canonical_wav(std::span<const std::uint8_t> bytes) {
  if (bytes.size() < kCanonicalWavHeaderBytes + 2U || bytes.size() > kCanonicalWavMaxTotalBytes)
    throw std::runtime_error("wav length");
  const std::size_t data_bytes = read_u32_le(bytes, 40);
  if (!matches(bytes, 0, {'R', 'I', 'F', 'F'}) || !matches(bytes, 8, {'W', 'A', 'V', 'E'}) ||
      !matches(bytes, 12, {'f', 'm', 't', ' '}) || !matches(bytes, 36, {'d', 'a', 't', 'a'}) ||
      read_u32_le(bytes, 4) != bytes.size() - 8U || read_u32_le(bytes, 16) != 16U ||
      read_u16_le(bytes, 20) != 1U || read_u16_le(bytes, 22) != 1U ||
      read_u32_le(bytes, 24) != 16'000U || read_u32_le(bytes, 28) != 32'000U ||
      read_u16_le(bytes, 32) != 2U || read_u16_le(bytes, 34) != 16U ||
      data_bytes != bytes.size() - kCanonicalWavHeaderBytes || data_bytes == 0U ||
      data_bytes % 2U != 0U || data_bytes > kCanonicalWavMaxDataBytes)
    throw std::runtime_error("canonical wav");
  const std::size_t samples = data_bytes / 2U;
  return {bytes.size(), data_bytes, samples, static_cast<double>(samples) * 1000.0 / 16'000.0};
}

WavAccumulator::WavAccumulator(std::string request_id, std::size_t expected_bytes)
    : request_id_(std::move(request_id)), expected_bytes_(expected_bytes) {
  if (request_id_.empty() || expected_bytes_ < kCanonicalWavHeaderBytes + 2U ||
      expected_bytes_ > kCanonicalWavMaxTotalBytes)
    throw std::runtime_error("wav declaration");
  bytes_.reserve(expected_bytes_);
}

bool WavAccumulator::append(const std::string& request_id, std::uint32_t sequence, bool final,
                            std::span<const std::uint8_t> bytes) {
  if (terminal_ || request_id != request_id_ || sequence != next_sequence_ ||
      (bytes.empty() && !final) || bytes.size() > expected_bytes_ - bytes_.size()) {
    cancel();
    throw std::runtime_error("wav stream");
  }
  bytes_.insert(bytes_.end(), bytes.begin(), bytes.end());
  ++next_sequence_;
  if (!final)
    return false;
  terminal_ = true;
  if (bytes_.size() != expected_bytes_) {
    cancel();
    throw std::runtime_error("wav terminal length");
  }
  static_cast<void>(validate_canonical_wav(bytes_));
  return true;
}

std::vector<std::uint8_t> WavAccumulator::take() {
  if (!terminal_ || bytes_.empty())
    throw std::runtime_error("wav unavailable");
  return std::exchange(bytes_, {});
}

void WavAccumulator::cancel() noexcept {
  terminal_ = true;
  bytes_.clear();
  bytes_.shrink_to_fit();
}

std::size_t WavAccumulator::retained_bytes() const noexcept { return bytes_.size(); }

} // namespace local_whisper::common
