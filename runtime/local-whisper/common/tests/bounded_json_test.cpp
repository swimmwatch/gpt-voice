#include "local_whisper/common/bounded_json.hpp"

#include "test_support.hpp"

#include <gtest/gtest.h>

#include <vector>

namespace local_whisper::common {

TEST(BoundedJson, AgreesWithEveryCheckedInLexicalVector) {
  const auto vectors = test_support::manifest();
  for (const auto& vector : vectors.at("lexical")) {
    const auto bytes = test_support::read_binary(vector.at("binaryFile").get<std::string>());
    const auto result = validate_bounded_json(bytes);
    EXPECT_EQ(result.valid, vector.at("valid").get<bool>()) << vector.at("name");
  }
}

TEST(BoundedJson, RejectsRawBodyAboveProtocolLimitBeforeParsing) {
  std::vector<std::uint8_t> body(1'048'577, ' ');
  body.back() = '0';
  const auto result = validate_bounded_json(body);
  EXPECT_FALSE(result.valid);
  EXPECT_EQ(result.event_count, 0U);
}

TEST(StandardLibraryBounds, RejectsOutOfRangeVectorAccessWhenAssertionsAreEnabled) {
#if defined(_GLIBCXX_ASSERTIONS)
  EXPECT_DEATH(
      {
        const std::vector<int> values{42};
        volatile int value = values[1];
        static_cast<void>(value);
      },
      ".*");
#else
  GTEST_SKIP() << "_GLIBCXX_ASSERTIONS is enabled only for Linux sanitized graphs";
#endif
}

} // namespace local_whisper::common
