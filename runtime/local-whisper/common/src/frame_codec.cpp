#include "local_whisper/common/frame_codec.hpp"

#include <limits>
#include <stdexcept>

namespace local_whisper::common {
namespace {

std::size_t maximum_body(FrameKind kind) {
  return kind == FrameKind::control ? kMaxControlBodyBytes
                                    : kMaxAudioChunkBytes + 1U + 1U + 4U + 2U + 128U;
}

std::uint32_t read_u32(std::span<const std::uint8_t> bytes) {
  return (static_cast<std::uint32_t>(bytes[0]) << 24U) |
         (static_cast<std::uint32_t>(bytes[1]) << 16U) |
         (static_cast<std::uint32_t>(bytes[2]) << 8U) | static_cast<std::uint32_t>(bytes[3]);
}

} // namespace

std::vector<std::uint8_t> encode_frame(FrameKind kind, std::span<const std::uint8_t> body) {
  if (body.size() > maximum_body(kind) || body.size() > std::numeric_limits<std::uint32_t>::max())
    throw std::runtime_error("frame body limit");
  const auto length = static_cast<std::uint32_t>(body.size());
  std::vector<std::uint8_t> result(kFrameHeaderBytes + body.size());
  result[0] = static_cast<std::uint8_t>(length >> 24U);
  result[1] = static_cast<std::uint8_t>(length >> 16U);
  result[2] = static_cast<std::uint8_t>(length >> 8U);
  result[3] = static_cast<std::uint8_t>(length);
  result[4] = static_cast<std::uint8_t>(kind);
  std::copy(body.begin(), body.end(),
            result.begin() + static_cast<std::ptrdiff_t>(kFrameHeaderBytes));
  return result;
}

FrameView decode_frame(std::span<const std::uint8_t> frame) {
  if (frame.size() < kFrameHeaderBytes)
    throw std::runtime_error("truncated frame");
  const auto body_length = static_cast<std::size_t>(read_u32(frame.first<4>()));
  if (body_length != frame.size() - kFrameHeaderBytes)
    throw std::runtime_error("frame length mismatch");
  FrameKind kind;
  if (frame[4] == static_cast<std::uint8_t>(FrameKind::control))
    kind = FrameKind::control;
  else if (frame[4] == static_cast<std::uint8_t>(FrameKind::audio))
    kind = FrameKind::audio;
  else
    throw std::runtime_error("unknown frame kind");
  if (body_length > maximum_body(kind))
    throw std::runtime_error("frame body limit");
  return FrameView{kind, frame.subspan(kFrameHeaderBytes)};
}

} // namespace local_whisper::common
