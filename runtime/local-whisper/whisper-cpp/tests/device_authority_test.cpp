#include "local_whisper/whisper_cpp/device_authority.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <span>

namespace local_whisper::whisper_cpp {
namespace {

std::array<std::uint8_t, kDeviceAuthorityRecordBytes> record() {
  std::array<std::uint8_t, kDeviceAuthorityRecordBytes> bytes{};
  constexpr std::array<std::uint8_t, 8> magic{'L', 'W', 'D', 'A', '1', 0, 0, 0};
  std::copy(magic.begin(), magic.end(), bytes.begin());
  for (std::size_t index = 0; index < 16U; ++index)
    bytes[8U + index] = static_cast<std::uint8_t>(index);
  bytes[31] = 7U;
  bytes[39] = 11U;
  return bytes;
}

TEST(DeviceAuthority, DecodesPrivateProofInputsWithoutExpectedProof) {
  const auto authority = DeviceAuthority::decode(record());
  EXPECT_EQ(authority.proof().authority_id, "AAECAwQFBgcICQoLDA0ODw");
  EXPECT_EQ(authority.proof().configuration_epoch, 7U);
  EXPECT_EQ(authority.proof().topology_generation, 11U);
}

TEST(DeviceAuthority, RejectsWrongDomainAndLength) {
  auto wrong = record();
  wrong[3] = 'X';
  EXPECT_THROW(static_cast<void>(DeviceAuthority::decode(wrong)), CoreError);
  EXPECT_THROW(static_cast<void>(DeviceAuthority::decode(
                   std::span<const std::uint8_t>(wrong).first(wrong.size() - 1U))),
               CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
