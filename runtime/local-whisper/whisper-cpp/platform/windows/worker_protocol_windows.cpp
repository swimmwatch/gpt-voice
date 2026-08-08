#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/frame_codec.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

void read_exact(std::span<std::uint8_t> bytes) {
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  while (!bytes.empty()) {
    DWORD count = 0;
    if (!ReadFile(input, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr) ||
        count == 0U) {
      throw CoreError(FailureCode::transcription_failed, "Windows protocol read failed");
    }
    bytes = bytes.subspan(count);
  }
}

void write_exact(std::span<const std::uint8_t> bytes) {
  const HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  while (!bytes.empty()) {
    DWORD count = 0;
    if (!WriteFile(output, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr) ||
        count == 0U) {
      throw CoreError(FailureCode::transcription_failed, "Windows protocol write failed");
    }
    bytes = bytes.subspan(count);
  }
}

std::uint32_t big_u32(const std::uint8_t* bytes) {
  return (static_cast<std::uint32_t>(bytes[0]) << 24U) |
         (static_cast<std::uint32_t>(bytes[1]) << 16U) |
         (static_cast<std::uint32_t>(bytes[2]) << 8U) | bytes[3];
}

std::vector<std::uint8_t> read_frame() {
  std::array<std::uint8_t, 5> header{};
  read_exact(header);
  const auto length = big_u32(header.data());
  if (length > local_whisper::common::kMaxAudioChunkBytes + 136U)
    throw CoreError(FailureCode::transcription_failed, "Windows frame exceeds limit");
  std::vector<std::uint8_t> frame(header.begin(), header.end());
  frame.resize(frame.size() + length);
  read_exact(std::span<std::uint8_t>(frame).subspan(header.size()));
  static_cast<void>(local_whisper::common::decode_frame(frame));
  return frame;
}

} // namespace

class NativeWorkerChannel::Impl final {
public:
  [[nodiscard]] nlohmann::json read_control() {
    const auto frame = read_frame();
    const auto view = local_whisper::common::decode_frame(frame);
    if (view.kind != local_whisper::common::FrameKind::control ||
        !local_whisper::common::validate_bounded_json(view.body).valid) {
      throw CoreError(FailureCode::transcription_failed, "invalid Windows control frame");
    }
    try {
      const auto value = nlohmann::json::parse(view.body.begin(), view.body.end());
      if (!value.is_object())
        throw CoreError(FailureCode::transcription_failed, "Windows control must be object");
      return value;
    } catch (const CoreError&) {
      throw;
    } catch (...) {
      throw CoreError(FailureCode::transcription_failed, "invalid Windows control JSON");
    }
  }

  [[nodiscard]] WorkerAudioChunk read_audio() {
    const auto frame = read_frame();
    const auto view = local_whisper::common::decode_frame(frame);
    if (view.kind != local_whisper::common::FrameKind::audio || view.body.size() < 8U ||
        view.body[0] != 1U || view.body[1] > 1U) {
      throw CoreError(FailureCode::audio_format_unsupported, "invalid Windows audio frame");
    }
    const auto sequence = big_u32(view.body.data() + 2U);
    const auto request_bytes =
        static_cast<std::uint16_t>((static_cast<std::uint16_t>(view.body[6]) << 8U) | view.body[7]);
    if (request_bytes == 0U || request_bytes > 128U || 8U + request_bytes > view.body.size())
      throw CoreError(FailureCode::audio_format_unsupported, "invalid Windows audio identity");
    const auto request = view.body.subspan(8U, request_bytes);
    const auto audio = view.body.subspan(8U + request_bytes);
    if (audio.size() > local_whisper::common::kMaxAudioChunkBytes ||
        (audio.empty() && view.body[1] == 0U)) {
      throw CoreError(FailureCode::audio_format_unsupported, "invalid Windows audio body");
    }
    return {std::string(request.begin(), request.end()), sequence, view.body[1] == 1U,
            std::vector<std::uint8_t>(audio.begin(), audio.end())};
  }

  void send_control(const nlohmann::json& value) {
    const auto serialized = value.dump();
    const auto body = std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(serialized.data()), serialized.size());
    write_exact(
        local_whisper::common::encode_frame(local_whisper::common::FrameKind::control, body));
  }
};

NativeWorkerChannel::NativeWorkerChannel() : impl_(std::make_unique<Impl>()) {}
NativeWorkerChannel::~NativeWorkerChannel() noexcept = default;
nlohmann::json NativeWorkerChannel::read_control() { return impl_->read_control(); }
WorkerAudioChunk NativeWorkerChannel::read_audio() { return impl_->read_audio(); }
void NativeWorkerChannel::send_control(const nlohmann::json& value) { impl_->send_control(value); }

} // namespace local_whisper::whisper_cpp

#endif
