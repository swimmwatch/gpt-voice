#include "local_whisper/launcher/launch_request.hpp"

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace local_whisper::launcher {
namespace {

std::string base64url(const std::string_view input) {
  constexpr std::string_view table =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string result;
  std::uint32_t accumulator = 0;
  unsigned int bits = 0;
  for (const unsigned char character : input) {
    accumulator = (accumulator << 8U) | character;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result.push_back(table[(accumulator >> bits) & 0x3fU]);
    }
  }
  if (bits != 0)
    result.push_back(table[(accumulator << (6U - bits)) & 0x3fU]);
  return result;
}

std::string valid_line() {
  const std::vector<std::string> fields = {
      "LWLP2",
      "fixture_nonce_1234",
      "probe",
      base64url("/managed/runtime/worker"),
      base64url("/managed/runtime"),
      std::string(64, 'a'),
      base64url("7"),
      base64url("11"),
      "1",
      "320",
      base64url("9"),
      "4096",
      "regular",
      base64url("7"),
      base64url("9"),
      "1",
      "448",
      base64url("5"),
      "8192",
      "directory",
  };
  std::string line;
  for (std::size_t index = 0; index < fields.size(); ++index) {
    if (index != 0)
      line.push_back('\t');
    line += fields[index];
  }
  return line;
}

TEST(LaunchRequestParserTest, ParsesCompleteVersionTwoBootstrap) {
  const LaunchRequest request = LaunchRequestParser{}.parse(valid_line());

  EXPECT_EQ(request.app_instance_nonce, "fixture_nonce_1234");
  EXPECT_EQ(request.launch_mode, WorkerLaunchMode::probe);
  EXPECT_EQ(request.worker_path, "/managed/runtime/worker");
  EXPECT_EQ(request.working_directory, "/managed/runtime");
  EXPECT_EQ(request.worker_sha256, std::string(64, 'a'));
  EXPECT_FALSE(request.worker_identity.directory);
  EXPECT_EQ(request.worker_identity.mode, 0500U);
  EXPECT_TRUE(request.directory_identity.directory);
  EXPECT_EQ(request.directory_identity.mode, 0700U);
}

TEST(LaunchRequestParserTest, RejectsParserInputBeyondTheCanonicalBootstrapLimit) {
  EXPECT_THROW(static_cast<void>(
                   LaunchRequestParser{}.parse(std::string(kMaximumLaunchRequestBytes + 1U, 'a'))),
               std::runtime_error);
}

TEST(LaunchRequestParserTest, RejectsUnknownVersionUnsafeNonceAndWrongIdentityKind) {
  std::string wrong_version = valid_line();
  wrong_version.replace(0, 5, "LWLP1");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(wrong_version)), std::runtime_error);

  std::string unsafe_nonce = valid_line();
  const std::size_t nonce = unsafe_nonce.find("fixture_nonce_1234");
  unsafe_nonce.replace(nonce, std::string("fixture_nonce_1234").size(), "unsafe nonce value");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(unsafe_nonce)), std::runtime_error);

  std::string wrong_kind = valid_line();
  const std::size_t regular = wrong_kind.find("regular");
  wrong_kind.replace(regular, std::string("regular").size(), "directory");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(wrong_kind)), std::runtime_error);
}

TEST(LaunchRequestParserTest, AcceptsOnlyFixedWorkerLaunchModes) {
  for (const auto& mode :
       {std::string("fullLoad"), std::string("probe"), std::string("registry")}) {
    std::string line = valid_line();
    const std::size_t mode_offset = line.find("\tprobe\t");
    line.replace(mode_offset + 1U, std::string("probe").size(), mode);
    EXPECT_NO_THROW(static_cast<void>(LaunchRequestParser{}.parse(line)));
  }
  std::string invalid = valid_line();
  const std::size_t mode_offset = invalid.find("\tprobe\t");
  invalid.replace(mode_offset + 1U, std::string("probe").size(), "unsafe-mode");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(invalid)), std::runtime_error);
}

TEST(LaunchRequestParserTest,
     FullLoadUsesTheStandardPathEnvelopeAndRetainsLegacyAuthorityReferenceFrames) {
  std::string standard = valid_line();
  const std::size_t mode_offset = standard.find("\tprobe\t");
  standard.replace(mode_offset + 1U, std::string("probe").size(), "fullLoad");
  EXPECT_NO_THROW(static_cast<void>(LaunchRequestParser{}.parse(standard)));

  const std::string legacy = standard + "\t" + base64url(std::string(234, 'x')) + "\t40";
  EXPECT_NO_THROW(static_cast<void>(LaunchRequestParser{}.parse(legacy)));
}

TEST(LaunchRequestParserTest, RejectsNonCanonicalBase64AndNumericOverflow) {
  std::string noncanonical = valid_line();
  const std::string encoded_path = base64url("/managed/runtime/worker");
  noncanonical.replace(noncanonical.find(encoded_path), encoded_path.size(), "A");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(noncanonical)), std::runtime_error);

  std::string overflow = valid_line();
  const std::string size_field = "\t4096\tregular";
  overflow.replace(overflow.find(size_field), size_field.size(), "\t18446744073709551616\tregular");
  EXPECT_THROW(static_cast<void>(LaunchRequestParser{}.parse(overflow)), std::runtime_error);
}

} // namespace
} // namespace local_whisper::launcher
