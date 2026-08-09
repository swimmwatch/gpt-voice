#include "local_whisper/common/sha256.hpp"

#include "sha256_test_vectors.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <span>
#include <stdexcept>
#include <string>
#include <vector>

namespace local_whisper::common {
namespace {

std::string streamed_digest(const std::span<const std::uint8_t> bytes,
                            const std::span<const std::size_t> chunks) {
  Sha256 hash;
  std::size_t offset = 0;
  for (const std::size_t chunk : chunks) {
    if (offset == bytes.size())
      break;
    const std::size_t count = std::min(chunk, bytes.size() - offset);
    hash.update(bytes.subspan(offset, count));
    offset += count;
  }
  if (offset < bytes.size())
    hash.update(bytes.subspan(offset));
  return to_lower_hex(hash.finish());
}

TEST(Sha256, MatchesSharedStandardVectorsWithWholeAndSplitStreams) {
  constexpr std::array<std::size_t, 4> kFirstSplit = {1U, 7U, 31U, 2U};
  constexpr std::array<std::size_t, 5> kSecondSplit = {64U, 3U, 11U, 1U, 19U};
  for (const auto& vector : test_support::shared_sha256_vectors()) {
    EXPECT_EQ(hex_sha256(vector.bytes), vector.expected_hex) << vector.name;
    EXPECT_EQ(streamed_digest(vector.bytes, kFirstSplit), vector.expected_hex) << vector.name;
    EXPECT_EQ(streamed_digest(vector.bytes, kSecondSplit), vector.expected_hex) << vector.name;
  }
}

TEST(Sha256, MatchesOneMillionAStandardVector) {
  const std::vector<std::uint8_t> bytes(1'000'000U, 'a');
  EXPECT_EQ(hex_sha256(bytes), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
}

TEST(Sha256, RejectsInvalidLifecycleAndBitLengthOverflow) {
  Sha256 hash;
  const std::array<std::uint8_t, 1> byte = {'a'};
  hash.update(byte);
  static_cast<void>(hash.finish());
  EXPECT_THROW(static_cast<void>(hash.finish()), std::runtime_error);
  EXPECT_THROW(hash.update(byte), std::runtime_error);

  EXPECT_TRUE(can_extend_sha256_input(kMaxSha256InputBytes - 1U, 1U));
  EXPECT_FALSE(can_extend_sha256_input(kMaxSha256InputBytes, 1U));
  EXPECT_FALSE(can_extend_sha256_input(kMaxSha256InputBytes + 1U, 0U));
}

} // namespace
} // namespace local_whisper::common
