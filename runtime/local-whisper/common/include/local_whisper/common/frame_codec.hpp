#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace local_whisper::common {

constexpr std::size_t kFrameHeaderBytes = 5;
constexpr std::size_t kMaxControlBodyBytes = 1'048'576;
constexpr std::size_t kMaxAudioChunkBytes = 1'048'576;
constexpr std::size_t kAudioFrameTypeBytes = 1;
constexpr std::size_t kAudioFrameFlagsBytes = 1;
constexpr std::size_t kAudioFrameSequenceBytes = 4;
constexpr std::size_t kAudioFrameRequestIdLengthBytes = 2;
constexpr std::size_t kMaxAudioRequestIdBytes = 128;
constexpr std::size_t kAudioFrameOverheadBytes =
    kAudioFrameTypeBytes + kAudioFrameFlagsBytes + kAudioFrameSequenceBytes +
    kAudioFrameRequestIdLengthBytes + kMaxAudioRequestIdBytes;
constexpr std::size_t kMaxAudioFrameBodyBytes = kMaxAudioChunkBytes + kAudioFrameOverheadBytes;

enum class FrameKind : std::uint8_t { control = 0x01, audio = 0x02 };

struct FrameView {
  FrameKind kind;
  std::span<const std::uint8_t> body;
};

[[nodiscard]] FrameKind frame_kind_from_byte(std::uint8_t value);
[[nodiscard]] constexpr std::size_t maximum_frame_body_bytes(const FrameKind kind) noexcept {
  return kind == FrameKind::control ? kMaxControlBodyBytes : kMaxAudioFrameBodyBytes;
}
[[nodiscard]] std::size_t validate_frame_body_length(FrameKind kind, std::uint64_t length);
[[nodiscard]] std::vector<std::uint8_t> encode_frame(FrameKind kind,
                                                     std::span<const std::uint8_t> body);
[[nodiscard]] FrameView decode_frame(std::span<const std::uint8_t> frame);

} // namespace local_whisper::common
