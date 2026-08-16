#include "local_whisper/fs_guard/bounded_line_reader.hpp"
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

std::string exact_limit_init_request() {
  constexpr std::string_view prefix = "7\t2\tINIT\tbGludXg\t";
  const std::size_t encoded_root_bytes = kMaxRequestPayloadBytes - prefix.size();
  const std::size_t raw_root_bytes = encoded_root_bytes / 4U * 3U + 2U;
  return std::string(prefix) + base64url_encode(std::string(raw_root_bytes, 'r'));
}

TEST(Base64UrlTest, EncodesAndDecodesCanonicalBoundaryVectors) {
  for (const auto& [plain, encoded] :
       std::vector<std::pair<std::string, std::string>>{{"", ""},
                                                        {"f", "Zg"},
                                                        {"fo", "Zm8"},
                                                        {"foo", "Zm9v"},
                                                        {std::string{"\x00\x80\xff", 3}, "AID_"}}) {
    EXPECT_EQ(base64url_encode(plain), encoded);
    EXPECT_EQ(base64url_decode(encoded), plain);
  }
}

TEST(Base64UrlTest, DecodesTheCompleteAlphabetThroughTheInverseTable) {
  constexpr std::string_view encoded =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  EXPECT_EQ(base64url_encode(base64url_decode(encoded)), encoded);
}

TEST(GuardErrorTest, RetainsOnlyClosedDiagnosticCodes) {
  const GuardError safe(ErrorCode::kIoFailed, "BUSY");
  const GuardError unsafe(ErrorCode::kIoFailed, "errno=16");

  EXPECT_EQ(safe.code(), "IO_FAILED");
  EXPECT_EQ(safe.diagnostic(), "BUSY");
  EXPECT_EQ(unsafe.code(), "IO_FAILED");
  EXPECT_TRUE(unsafe.diagnostic().empty());
}

TEST(Base64UrlTest, RejectsPaddingAlphabetAndNonCanonicalTailBits) {
  EXPECT_THROW(static_cast<void>(base64url_decode("Zg==")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("Zg/")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("A")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("Zh")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("Zm9")), GuardError);
  EXPECT_THROW(static_cast<void>(base64url_decode("Zm8", 1U)), GuardError);
}

TEST(ProtocolTest, ParsesRequestsAndSerializesResponsesByteForByte) {
  std::string request_id = "0";
  const Request request = parse_request("7\t2\tRELEASE\tbGVhc2UtMQ", request_id);
  ASSERT_TRUE(std::holds_alternative<ReleaseCommand>(request.command));
  EXPECT_EQ(request.id, "7");
  EXPECT_EQ(request_id, "7");
  EXPECT_EQ(std::get<ReleaseCommand>(request.command).token, "lease-1");
  EXPECT_EQ(serialize_response("7", true, {"ok"}), "7\t2\tOK\tb2s\n");
  EXPECT_EQ(serialize_response("7", false, {"INVALID_INPUT"}), "7\t2\tERR\tSU5WQUxJRF9JTlBVVA\n");
}

TEST(ProtocolTest, RejectsParserInputBeyondTheCanonicalLineLimit) {
  std::string request_id;
  EXPECT_THROW(
      static_cast<void>(parse_request(std::string(kMaxRequestPayloadBytes + 1U, 'a'), request_id)),
      GuardError);
}

TEST(ProtocolTest, DecodesWriteFileBytesOnceIntoTheTypedCommand) {
  std::string request_id;
  const Request request = parse_request("7\t2\tWRITE_FILE\tbGVhc2UtMQ\tAID_", request_id);

  ASSERT_TRUE(std::holds_alternative<WriteFileCommand>(request.command));
  const auto& write = std::get<WriteFileCommand>(request.command);
  EXPECT_EQ(write.file_token, "lease-1");
  EXPECT_EQ(write.bytes, std::string("\x00\x80\xff", 3));
}

TEST(ProtocolTest, DerivesAndEnforcesTheMaximumRawWriteChunk) {
  EXPECT_EQ(kMaxWriteFileChunkBytes, 193483U);
  const std::string token = "lease-18446744073709551615";
  const std::string maximum_bytes(kMaxWriteFileChunkBytes, static_cast<char>(0xa5));
  const std::string maximum_request = "99999999999999999999\t2\tWRITE_FILE\t" +
                                      base64url_encode(token) + "\t" +
                                      base64url_encode(maximum_bytes);
  EXPECT_EQ(maximum_request.size(), kMaxRequestPayloadBytes - kProtocolFutureHeadroomBytes);

  std::string request_id;
  const Request parsed = parse_request(maximum_request, request_id);
  ASSERT_TRUE(std::holds_alternative<WriteFileCommand>(parsed.command));
  EXPECT_EQ(std::get<WriteFileCommand>(parsed.command).bytes, maximum_bytes);

  const std::string over_limit = maximum_request + "p";
  EXPECT_THROW(static_cast<void>(parse_request(over_limit, request_id)), GuardError);
}

TEST(GuardApplicationTest, RejectsInvalidWriteDataWithoutDispatchOrSensitiveEcho) {
  for (const std::string_view encoded : {"Zg==", "Zg/", "A", "Zh", "Zm9"}) {
    test::RecordingBackend backend;
    GuardApplication application(backend);
    std::istringstream input("7\t2\tWRITE_FILE\tbGVhc2UtMQ\t" + std::string(encoded) + "\n");
    std::ostringstream output;

    EXPECT_EQ(application.run(input, output), 0);
    EXPECT_EQ(output.str(), "7\t2\tERR\tSU5WQUxJRF9JTlBVVA\n");
    EXPECT_TRUE(backend.last_call().empty());
  }
}

TEST(GuardApplicationTest, RejectsProtocolV1BeforeWriteInterpretation) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input("7\t1\tWRITE_FILE\tbGVhc2UtMQ\tAID_\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(output.str(), "0\t2\tERR\tSU5WQUxJRF9JTlBVVA\n");
  EXPECT_TRUE(backend.last_call().empty());
}

TEST(GuardApplicationTest, UsesStreamsAndInjectedBackend) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input("7\t2\tRELEASE\tbGVhc2UtMQ\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(output.str(), "7\t2\tOK\tcmVsZWFzZQ\n");
  EXPECT_EQ(backend.last_call(), "release");
}

TEST(GuardApplicationTest, DeliversDecodedBinaryBytesUnchangedToTheBackend) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input("7\t2\tWRITE_FILE\tbGVhc2UtMQ\tAID_\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(output.str(), "7\t2\tOK\td3JpdGVfZmlsZQ\n");
  EXPECT_EQ(backend.last_call(), "write_file");
  EXPECT_EQ(backend.last_write_bytes(), std::string("\x00\x80\xff", 3));
}

TEST(GuardApplicationTest, AcceptsAnExactLimitPayloadBeforeTheNewline) {
  const std::string request = exact_limit_init_request();
  ASSERT_EQ(request.size(), kMaxRequestPayloadBytes);
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input(request + "\n");
  std::ostringstream output;

  EXPECT_EQ(application.run(input, output), 0);
  EXPECT_EQ(backend.last_call(), "initialize");
  EXPECT_EQ(output.str(), "7\t2\tOK\taW5pdGlhbGl6ZQ\n");
}

TEST(GuardApplicationTest, RejectsLinesAboveTheFixedLimit) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  const std::string exact_request = exact_limit_init_request();
  ASSERT_EQ(exact_request.size(), kMaxRequestPayloadBytes);
  std::istringstream input(exact_request + "x\n");
  std::ostringstream output;

  EXPECT_NE(application.run(input, output), 0);
  EXPECT_TRUE(output.str().empty());
  EXPECT_TRUE(backend.last_call().empty());
}

TEST(GuardApplicationTest, RejectsNewlineFreeInputAboveTheFixedLimit) {
  test::RecordingBackend backend;
  GuardApplication application(backend);
  std::istringstream input(std::string(kMaxRequestPayloadBytes + 1, 'a'));
  std::ostringstream output;

  EXPECT_NE(application.run(input, output), 0);
  EXPECT_TRUE(output.str().empty());
  EXPECT_TRUE(backend.last_call().empty());
}

TEST(BoundedLineReaderTest, PreservesOnlyPayloadsAtOrBelowTheConfiguredLimit) {
  const BoundedLineReader reader(kMaxRequestPayloadBytes);
  for (const std::size_t size : {kMaxRequestPayloadBytes - 1, kMaxRequestPayloadBytes}) {
    std::istringstream input(std::string(size, 'x') + "\n");
    const LineReadResult result = reader.read(input);
    EXPECT_EQ(result.status, LineReadStatus::kLine);
    EXPECT_EQ(result.payload.size(), size);
  }
}

TEST(BoundedLineReaderTest, TreatsFinalBoundedEofLineAsARequest) {
  const BoundedLineReader reader(kMaxRequestPayloadBytes);
  for (const std::size_t size : {kMaxRequestPayloadBytes - 1, kMaxRequestPayloadBytes}) {
    std::istringstream input(std::string(size, 'x'));
    const LineReadResult result = reader.read(input);
    EXPECT_EQ(result.status, LineReadStatus::kLine);
    EXPECT_EQ(result.payload.size(), size);
  }
}

TEST(BoundedLineReaderTest, StopsAtTheFirstByteBeyondTheLimitWithoutDraining) {
  const BoundedLineReader reader(kMaxRequestPayloadBytes);
  std::istringstream input(std::string(kMaxRequestPayloadBytes + 1, 'x') + "still-unread\n");

  const LineReadResult result = reader.read(input);

  EXPECT_EQ(result.status, LineReadStatus::kOverflow);
  EXPECT_EQ(result.payload.size(), kMaxRequestPayloadBytes);
  EXPECT_EQ(input.peek(), 's');
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
