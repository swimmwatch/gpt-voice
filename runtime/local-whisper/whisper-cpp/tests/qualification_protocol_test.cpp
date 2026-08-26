#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/qualification_protocol.hpp"

#include <gtest/gtest.h>

#include <array>
#include <cstdint>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

std::vector<std::uint8_t> bytes(std::string value) { return {value.begin(), value.end()}; }

std::string valid_command() {
  return R"({"schemaVersion":1,"family":"base","variant":"full","modelSizeBytes":17,"modelSha256":"1111111111111111111111111111111111111111111111111111111111111111","wavSizeBytes":44,"wavSha256":"2222222222222222222222222222222222222222222222222222222222222222","language":"en","cpuThreads":4,"selectedOrdinal":null})";
}

TEST(QualificationProtocol, AcceptsTheClosedCommandContract) {
  const auto input = bytes(valid_command());
  const auto command = parse_qualification_command(input);
  EXPECT_EQ(command.family, "base");
  EXPECT_EQ(command.variant, "full");
  EXPECT_EQ(command.model_size_bytes, 17U);
  EXPECT_EQ(command.wav_size_bytes, 44U);
  EXPECT_EQ(command.language, "en");
  EXPECT_EQ(command.cpu_threads, 4U);
  EXPECT_FALSE(command.selected_ordinal.has_value());
}

TEST(QualificationProtocol, RejectsUnknownDuplicateAndIncompatibleInput) {
  auto unknown = valid_command();
  unknown.insert(unknown.size() - 1U, R"(,"hostPath":"/tmp/model")");
  EXPECT_THROW(static_cast<void>(parse_qualification_command(bytes(unknown))), CoreError);

  auto duplicate = valid_command();
  duplicate.replace(duplicate.find(R"("schemaVersion":1)"), 17U,
                    R"("schemaVersion":1,"schemaVersion":1)");
  EXPECT_THROW(static_cast<void>(parse_qualification_command(bytes(duplicate))), CoreError);

  auto incompatible = valid_command();
  incompatible.replace(incompatible.find(R"("family":"base")"), 15U, R"("family":"large-v3")");
  EXPECT_THROW(static_cast<void>(parse_qualification_command(bytes(incompatible))), CoreError);
}

TEST(QualificationProtocol, RejectsMutableOrMismatchedWavAuthority) {
  std::array<std::uint8_t, 44> wav{};
  const auto digest = local_whisper::common::sha256(wav);
  EXPECT_THROW(static_cast<void>(read_qualification_wav(-1, wav.size(), digest)), CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
