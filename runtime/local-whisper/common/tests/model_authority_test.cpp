#include "local_whisper/common/model_authority.hpp"

#include "test_support.hpp"

#include <gtest/gtest.h>

namespace local_whisper::common {

TEST(ModelAuthority, RoundTripsEveryCheckedInFixedWidthRecord) {
  const auto vectors = test_support::manifest();
  for (const auto& vector : vectors.at("authority")) {
    const auto bytes = test_support::read_binary(vector.at("binaryFile").get<std::string>());
    EXPECT_EQ(encode_authority_record(decode_authority_record(bytes)), bytes) << vector.at("name");
  }
}

TEST(ModelAuthority, RejectsLengthDomainCarrierAndReplayMutations) {
  auto request = test_support::read_binary("authority/request.bin");
  auto transfer = test_support::read_binary("authority/linux-hop-2.bin");
  request.pop_back();
  EXPECT_THROW(static_cast<void>(decode_authority_record(request)), std::runtime_error);
  request = test_support::read_binary("authority/request.bin");
  request[0] = 0;
  EXPECT_THROW(static_cast<void>(decode_authority_record(request)), std::runtime_error);
  transfer[227] = static_cast<std::uint8_t>(AuthorityCarrierKind::windows_launcher_handle);
  EXPECT_THROW(static_cast<void>(decode_authority_record(transfer)), std::runtime_error);

  const auto decoded = decode_authority_record(test_support::read_binary("authority/request.bin"));
  const auto& nonce = std::get<AuthorityRequest>(decoded).binding.operation_nonce;
  AuthorityReplayGuard replay;
  EXPECT_TRUE(replay.consume(nonce));
  EXPECT_FALSE(replay.consume(nonce));
}

} // namespace local_whisper::common
