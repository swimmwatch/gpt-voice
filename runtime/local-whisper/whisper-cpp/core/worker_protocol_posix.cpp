#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/frame_codec.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

void read_exact(int descriptor, std::span<std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = read(descriptor, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw CoreError(FailureCode::transcription_failed, "worker protocol read failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

void write_exact(int descriptor, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = write(descriptor, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw CoreError(FailureCode::transcription_failed, "worker protocol write failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

std::uint32_t read_big_u32(std::span<const std::uint8_t, 4> bytes) {
  return (static_cast<std::uint32_t>(bytes[0]) << 24U) |
         (static_cast<std::uint32_t>(bytes[1]) << 16U) |
         (static_cast<std::uint32_t>(bytes[2]) << 8U) | bytes[3];
}

std::uint16_t read_big_u16(std::span<const std::uint8_t, 2> bytes) {
  return static_cast<std::uint16_t>((static_cast<std::uint16_t>(bytes[0]) << 8U) | bytes[1]);
}

bool valid_request_id(std::span<const std::uint8_t> value) {
  if (value.empty() || value.size() > 128U)
    return false;
  for (const auto byte : value) {
    if (byte < 0x20U || byte == 0x7fU)
      return false;
  }
  return true;
}

std::vector<std::uint8_t> read_frame(int descriptor) {
  std::array<std::uint8_t, local_whisper::common::kFrameHeaderBytes> header{};
  read_exact(descriptor, header);
  const auto length = read_big_u32(std::span<const std::uint8_t, 4>(header.data(), 4));
  const std::uint64_t maximum =
      header[4] == static_cast<std::uint8_t>(local_whisper::common::FrameKind::control)
          ? local_whisper::common::kMaxControlBodyBytes
          : local_whisper::common::kMaxAudioChunkBytes + 136U;
  if (length > maximum)
    throw CoreError(FailureCode::transcription_failed, "worker frame exceeds limit");
  std::vector<std::uint8_t> frame(header.begin(), header.end());
  frame.resize(frame.size() + length);
  read_exact(descriptor, std::span<std::uint8_t>(frame).subspan(header.size()));
  static_cast<void>(local_whisper::common::decode_frame(frame));
  return frame;
}

} // namespace

class NativeWorkerChannel::Impl final {
public:
  [[nodiscard]] nlohmann::json read_control() {
    const auto frame = read_frame(STDIN_FILENO);
    const auto view = local_whisper::common::decode_frame(frame);
    if (view.kind != local_whisper::common::FrameKind::control)
      throw CoreError(FailureCode::transcription_failed, "expected control frame");
    const auto validation = local_whisper::common::validate_bounded_json(view.body);
    if (!validation.valid)
      throw CoreError(FailureCode::transcription_failed, "invalid bounded control JSON");
    try {
      const auto value = nlohmann::json::parse(view.body.begin(), view.body.end());
      if (!value.is_object())
        throw CoreError(FailureCode::transcription_failed, "control message must be object");
      return value;
    } catch (const CoreError&) {
      throw;
    } catch (...) {
      throw CoreError(FailureCode::transcription_failed, "invalid control JSON");
    }
  }

  [[nodiscard]] WorkerAudioChunk read_audio() {
    const auto frame = read_frame(STDIN_FILENO);
    const auto view = local_whisper::common::decode_frame(frame);
    if (view.kind != local_whisper::common::FrameKind::audio || view.body.size() < 8U ||
        view.body[0] != 1U || view.body[1] > 1U) {
      throw CoreError(FailureCode::audio_format_unsupported, "invalid audio frame");
    }
    const auto sequence = read_big_u32(std::span<const std::uint8_t, 4>(view.body.data() + 2, 4));
    const auto request_bytes =
        read_big_u16(std::span<const std::uint8_t, 2>(view.body.data() + 6, 2));
    if (request_bytes == 0U || request_bytes > 128U || 8U + request_bytes > view.body.size())
      throw CoreError(FailureCode::audio_format_unsupported, "invalid audio request identity");
    const auto request = view.body.subspan(8U, request_bytes);
    const auto audio = view.body.subspan(8U + request_bytes);
    if (!valid_request_id(request) || audio.size() > local_whisper::common::kMaxAudioChunkBytes ||
        (audio.empty() && view.body[1] == 0U)) {
      throw CoreError(FailureCode::audio_format_unsupported, "invalid audio chunk body");
    }
    return {std::string(request.begin(), request.end()), sequence, view.body[1] == 1U,
            std::vector<std::uint8_t>(audio.begin(), audio.end())};
  }

  void send_control(const nlohmann::json& value) {
    const auto serialized = value.dump();
    const auto body = std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(serialized.data()), serialized.size());
    const auto frame =
        local_whisper::common::encode_frame(local_whisper::common::FrameKind::control, body);
    write_exact(STDOUT_FILENO, frame);
  }
};

NativeWorkerChannel::NativeWorkerChannel() : impl_(std::make_unique<Impl>()) {}
NativeWorkerChannel::~NativeWorkerChannel() noexcept = default;
nlohmann::json NativeWorkerChannel::read_control() { return impl_->read_control(); }
WorkerAudioChunk NativeWorkerChannel::read_audio() { return impl_->read_audio(); }
void NativeWorkerChannel::send_control(const nlohmann::json& value) { impl_->send_control(value); }

} // namespace local_whisper::whisper_cpp
