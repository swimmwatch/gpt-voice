#include "local_whisper/fs_guard/guard_application.hpp"
#include "local_whisper/fs_guard/protocol.hpp"

#include "local_whisper/fs_guard/error.hpp"

#include "fake_backend.hpp"

#include <gtest/gtest.h>

#include <sstream>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

TEST(Base64UrlTest, EncodesAndDecodesCanonicalBoundaryVectors) {
  for (const auto& [plain, encoded] : std::vector<std::pair<std::string, std::string>>{
           {"", ""}, {"f", "Zg"}, {"fo", "Zm8"}, {"foo", "Zm9v"}, {"hello", "aGVsbG8"}}) {
    EXPECT_EQ(base64url_encode(plain), encoded);
    EXPECT_EQ(base64url_decode(encoded), plain);
  }
}

TEST(Base64UrlTest, RejectsPaddingAlphabetAndNonCanonicalTailBits) {
  EXPECT_THROW(static_cast<void>(base64url_decode("Zg==")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("Zg/")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("A")), GuardError);
}

TEST(ProtocolTest, ParsesRequestsAndSerializesResponsesByteForByte) {
  std::string request_id = "0";
  const Request request = parse_request("7\t1\tRELEASE\tbGVhc2UtMQ", request_id);
  ASSERT_TRUE(std::holds_alternative<ReleaseCommand>(request.command));
  EXPECT_EQ(request.id, "7");
  EXPECT_EQ(request_id, "7");
  EXPECT_EQ(std::get<ReleaseCommand>(request.command).token, "lease-1");
  EXPECT_EQ(serialize_response("7", true, {"ok"}), "7\t1\tOK\tb2s\n");
  EXPECT_EQ(serialize_response("7", false, {"INVALID_INPUT"}), "7\t1\tERR\tSU5WQUxJRF9JTlBVVA\n");
}

TEST(GuardApplicationTest, UsesStreamsAndInjectedBackend) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input("7\t1\tRELEASE\tbGVhc2UtMQ\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(output.str(), "7\t1\tOK\tcmVsZWFzZQ\n");
  EXPECT_EQ(backend.last_call(), "release");
}

TEST(GuardApplicationTest, RejectsLinesAboveTheFixedLimit) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input(std::string(kMaxLineBytes + 1, 'a') + "\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(output.str(), "0\t1\tERR\tSU5WQUxJRF9JTlBVVA\n");
}

TEST(ErrorTest, NormalizesOnlyTheSafeNativeVocabulary) {
  for (const std::string_view code : {"CONFLICT", "IDENTITY_CHANGED", "INVALID_INPUT", "IO_FAILED",
                                      "UNSAFE_ENTRY", "UNSUPPORTED"}) {
    EXPECT_EQ(to_string(normalize_error_code(code)), code);
  }
  EXPECT_EQ(to_string(normalize_error_code("private path leaked")), "IO_FAILED");
}

} // namespace
} // namespace local_whisper::fs_guard
