#include "local_whisper/common/frame_codec.hpp"

#include "test_support.hpp"

#include <gtest/gtest.h>

namespace local_whisper::common {

TEST(FrameCodec, ConsumesEveryCheckedInValidFrame) {
  const auto vectors = test_support::manifest();
  for (const auto& category : {"control", "audio"}) {
    for (const auto& vector : vectors.at(category)) {
      const auto bytes = test_support::read_binary(vector.at("binaryFile").get<std::string>());
      const auto decoded = decode_frame(bytes);
      EXPECT_EQ(decoded.kind,
                std::string(category) == "control" ? FrameKind::control : FrameKind::audio);
      EXPECT_EQ(encode_frame(decoded.kind, decoded.body), bytes) << vector.at("name");
    }
  }
}

TEST(FrameCodec, RejectsLengthKindAndBodyLimitMutations) {
  const std::vector<std::uint8_t> control = {
      0, 0, 0, 2, static_cast<std::uint8_t>(FrameKind::control), '{', '}'};
  EXPECT_NO_THROW(static_cast<void>(decode_frame(control)));
  auto changed = control;
  changed[3] = 3;
  EXPECT_THROW(static_cast<void>(decode_frame(changed)), std::runtime_error);
  changed = control;
  changed[4] = 0x7f;
  EXPECT_THROW(static_cast<void>(decode_frame(changed)), std::runtime_error);
  EXPECT_THROW(static_cast<void>(decode_frame(std::span<const std::uint8_t>(control).first(4))),
               std::runtime_error);
}

} // namespace local_whisper::common
