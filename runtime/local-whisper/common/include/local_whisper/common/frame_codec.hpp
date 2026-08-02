#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace local_whisper::common {

constexpr std::size_t kFrameHeaderBytes = 5;
constexpr std::size_t kMaxControlBodyBytes = 1'048'576;
constexpr std::size_t kMaxAudioChunkBytes = 1'048'576;

enum class FrameKind : std::uint8_t { control = 0x01, audio = 0x02 };

struct FrameView {
  FrameKind kind;
  std::span<const std::uint8_t> body;
};

[[nodiscard]] std::vector<std::uint8_t> encode_frame(FrameKind kind,
                                                     std::span<const std::uint8_t> body);
[[nodiscard]] FrameView decode_frame(std::span<const std::uint8_t> frame);

} // namespace local_whisper::common
