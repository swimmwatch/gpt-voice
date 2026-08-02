#include "local_whisper/common/canonical_wav.hpp"

#include "test_support.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <utility>
#include <vector>

namespace local_whisper::common {
namespace {

void write_u32_le(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint32_t value) {
  for (std::size_t index = 0; index < 4; ++index)
    bytes.at(offset + index) = static_cast<std::uint8_t>(value >> (index * 8U));
}

std::vector<std::uint8_t> maximum_canonical_wav() {
  std::vector<std::uint8_t> bytes(kCanonicalWavMaxTotalBytes, 0);
  for (const auto& [offset, value] :
       std::array<std::pair<std::size_t, std::array<std::uint8_t, 4>>, 4>{
           std::pair{0U, std::array<std::uint8_t, 4>{'R', 'I', 'F', 'F'}},
           std::pair{8U, std::array<std::uint8_t, 4>{'W', 'A', 'V', 'E'}},
           std::pair{12U, std::array<std::uint8_t, 4>{'f', 'm', 't', ' '}},
           std::pair{36U, std::array<std::uint8_t, 4>{'d', 'a', 't', 'a'}},
       }) {
    std::copy(value.begin(), value.end(), bytes.begin() + static_cast<std::ptrdiff_t>(offset));
  }
  write_u32_le(bytes, 4, static_cast<std::uint32_t>(bytes.size() - 8U));
  write_u32_le(bytes, 16, 16);
  bytes[20] = 1;
  bytes[22] = 1;
  write_u32_le(bytes, 24, 16'000);
  write_u32_le(bytes, 28, 32'000);
  bytes[32] = 2;
  bytes[34] = 16;
  write_u32_le(bytes, 40, static_cast<std::uint32_t>(kCanonicalWavMaxDataBytes));
  return bytes;
}

} // namespace

TEST(CanonicalWav, ValidatesCheckedInWavVectors) {
  const auto vectors = test_support::manifest();
  for (const auto& vector : vectors.at("wav")) {
    const auto bytes = test_support::read_binary(vector.at("binaryFile").get<std::string>());
    if (vector.at("valid").get<bool>())
      EXPECT_NO_THROW(static_cast<void>(validate_canonical_wav(bytes))) << vector.at("name");
    else
      EXPECT_THROW(static_cast<void>(validate_canonical_wav(bytes)), std::runtime_error)
          << vector.at("name");
  }
}

TEST(CanonicalWav, AccumulatesSequenceAndReleasesOnTerminalPaths) {
  const auto bytes = test_support::read_binary("wav/minimum.bin");
  WavAccumulator accumulator("tx-1", bytes.size());
  EXPECT_FALSE(
      accumulator.append("tx-1", 0, false, std::span<const std::uint8_t>(bytes).first(20)));
  EXPECT_TRUE(
      accumulator.append("tx-1", 1, true, std::span<const std::uint8_t>(bytes).subspan(20)));
  EXPECT_EQ(accumulator.take(), bytes);

  WavAccumulator invalid("tx-2", bytes.size());
  EXPECT_THROW(static_cast<void>(invalid.append("tx-2", 1, true, bytes)), std::runtime_error);
  EXPECT_EQ(invalid.retained_bytes(), 0U);
}

TEST(CanonicalWav, AcceptsExactMaximumWithoutOverflow) {
  const auto bytes = maximum_canonical_wav();
  const auto descriptor = validate_canonical_wav(bytes);
  EXPECT_EQ(descriptor.total_bytes, kCanonicalWavMaxTotalBytes);
  EXPECT_EQ(descriptor.sample_count, kCanonicalWavMaxSamples);
  EXPECT_EQ(descriptor.duration_milliseconds, 1'800'000.0);
}

} // namespace local_whisper::common
