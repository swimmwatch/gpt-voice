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
#include <utility>
#include <vector>

namespace local_whisper::common {
namespace {

std::string streamed_digest(const std::span<const std::uint8_t> bytes,
                            const std::span<const std::size_t> chunks,
                            const Sha256DispatchMode mode) {
  Sha256 hash(mode);
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
  constexpr std::array<Sha256DispatchMode, 3> kRequiredModes = {
      Sha256DispatchMode::automatic,
      Sha256DispatchMode::scalar,
      Sha256DispatchMode::simulated_unsupported,
  };
  for (const auto& vector : test_support::shared_sha256_vectors()) {
    EXPECT_EQ(hex_sha256(vector.bytes), vector.expected_hex) << vector.name;
    for (const Sha256DispatchMode mode : kRequiredModes) {
      EXPECT_EQ(streamed_digest(vector.bytes, kFirstSplit, mode), vector.expected_hex)
          << vector.name;
      EXPECT_EQ(streamed_digest(vector.bytes, kSecondSplit, mode), vector.expected_hex)
          << vector.name;
    }
    if (sha256_acceleration_supported_for_testing()) {
      EXPECT_EQ(streamed_digest(vector.bytes, kFirstSplit, Sha256DispatchMode::accelerated),
                vector.expected_hex)
          << vector.name;
      EXPECT_EQ(streamed_digest(vector.bytes, kSecondSplit, Sha256DispatchMode::accelerated),
                vector.expected_hex)
          << vector.name;
    }
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

  constexpr std::uint64_t kFourGibibytes = 4ULL * 1024ULL * 1024ULL * 1024ULL;
  EXPECT_TRUE(can_extend_sha256_input(0U, kFourGibibytes));
  EXPECT_TRUE(can_extend_sha256_input(kFourGibibytes, kFourGibibytes));
}

TEST(Sha256, SelectsOnlySupportedImmutableDispatchTargets) {
  const Sha256 scalar(Sha256DispatchMode::scalar);
  const Sha256 unsupported(Sha256DispatchMode::simulated_unsupported);
  EXPECT_EQ(scalar.dispatch_target_for_testing(), Sha256DispatchTarget::scalar);
  EXPECT_EQ(unsupported.dispatch_target_for_testing(), Sha256DispatchTarget::scalar);

  const Sha256 automatic(Sha256DispatchMode::automatic);
  const auto expected_automatic = sha256_acceleration_supported_for_testing()
                                      ? Sha256DispatchTarget::accelerated
                                      : Sha256DispatchTarget::scalar;
  EXPECT_EQ(automatic.dispatch_target_for_testing(), expected_automatic);

  if (sha256_acceleration_supported_for_testing()) {
    const Sha256 accelerated(Sha256DispatchMode::accelerated);
    EXPECT_EQ(accelerated.dispatch_target_for_testing(), Sha256DispatchTarget::accelerated);
  }
}

TEST(Sha256, PreservesStreamingStateAcrossMoves) {
  const std::array<std::uint8_t, 3> bytes = {'a', 'b', 'c'};
  constexpr auto kExpected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  Sha256 source(Sha256DispatchMode::scalar);
  source.update(std::span<const std::uint8_t>(bytes).first(1U));
  Sha256 moved(std::move(source));
  moved.update(std::span<const std::uint8_t>(bytes).subspan(1U));
  EXPECT_EQ(to_lower_hex(moved.finish()), kExpected);

  Sha256 assigned_source(Sha256DispatchMode::simulated_unsupported);
  assigned_source.update(std::span<const std::uint8_t>(bytes).first(2U));
  Sha256 assigned_target(Sha256DispatchMode::scalar);
  assigned_target = std::move(assigned_source);
  assigned_target.update(std::span<const std::uint8_t>(bytes).subspan(2U));
  EXPECT_EQ(to_lower_hex(assigned_target.finish()), kExpected);
}

} // namespace
} // namespace local_whisper::common
