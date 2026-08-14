#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/frame_codec.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::size_t kWindowsPipeIoChunkBytes = 64U * 1024U;
constexpr DWORD kControlPollIntervalMs = 50U;

enum class ControlInputState { idle, ready, closed };

void read_exact(std::span<std::uint8_t> bytes) {
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  while (!bytes.empty()) {
    DWORD count = 0;
    const auto requested =
        static_cast<DWORD>(std::min<std::size_t>(bytes.size(), kWindowsPipeIoChunkBytes));
    if (!ReadFile(input, bytes.data(), requested, &count, nullptr) || count == 0U) {
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
  std::array<std::uint8_t, local_whisper::common::kFrameHeaderBytes> header{};
  read_exact(header);
  const auto length = big_u32(header.data());
  try {
    const auto kind = local_whisper::common::frame_kind_from_byte(header[4]);
    static_cast<void>(local_whisper::common::validate_frame_body_length(kind, length));
  } catch (...) {
    throw CoreError(FailureCode::transcription_failed, "Windows frame exceeds limit");
  }
  std::vector<std::uint8_t> frame(header.begin(), header.end());
  frame.resize(frame.size() + length);
  read_exact(std::span<std::uint8_t>(frame).subspan(header.size()));
  static_cast<void>(local_whisper::common::decode_frame(frame));
  return frame;
}

class CompletionEvent final {
public:
  CompletionEvent() : handle_(CreateEventW(nullptr, FALSE, FALSE, nullptr)) {
    if (handle_ == nullptr)
      throw CoreError(FailureCode::transcription_failed, "Windows completion event unavailable");
  }

  ~CompletionEvent() noexcept {
    if (handle_ != nullptr)
      static_cast<void>(CloseHandle(handle_));
  }

  CompletionEvent(const CompletionEvent&) = delete;
  CompletionEvent& operator=(const CompletionEvent&) = delete;

  [[nodiscard]] HANDLE handle() const noexcept { return handle_; }
  void signal() noexcept { static_cast<void>(SetEvent(handle_)); }

private:
  HANDLE handle_;
};

ControlInputState control_input_state(HANDLE input) {
  DWORD available = 0U;
  if (PeekNamedPipe(input, nullptr, 0U, nullptr, &available, nullptr))
    return available == 0U ? ControlInputState::idle : ControlInputState::ready;
  const DWORD error = GetLastError();
  if (error == ERROR_BROKEN_PIPE || error == ERROR_HANDLE_EOF)
    return ControlInputState::closed;
  throw CoreError(FailureCode::transcription_failed, "Windows control pipe state failed");
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
    if (request_bytes == 0U || request_bytes > local_whisper::common::kMaxAudioRequestIdBytes ||
        8U + request_bytes > view.body.size())
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

  [[nodiscard]] WorkerChannelWaitResult wait_for_control_or_inference() {
    const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
    if (input == nullptr || input == INVALID_HANDLE_VALUE)
      throw CoreError(FailureCode::transcription_failed, "Windows control input unavailable");
    while (true) {
      const auto state = control_input_state(input);
      if (state == ControlInputState::ready)
        return WorkerChannelWaitResult::control_ready;
      if (state == ControlInputState::closed)
        return WorkerChannelWaitResult::control_closed;
      const DWORD result = WaitForSingleObject(completion_event_.handle(), kControlPollIntervalMs);
      if (result == WAIT_TIMEOUT)
        continue;
      if (result != WAIT_OBJECT_0)
        throw CoreError(FailureCode::transcription_failed, "Windows worker wait failed");
      const auto final_state = control_input_state(input);
      if (final_state == ControlInputState::ready)
        return WorkerChannelWaitResult::control_ready;
      if (final_state == ControlInputState::closed)
        return WorkerChannelWaitResult::control_closed;
      return WorkerChannelWaitResult::inference_completed;
    }
  }

  void notify_inference_complete() noexcept { completion_event_.signal(); }

  void send_control(const nlohmann::json& value) {
    const auto serialized = value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
    const auto body = std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(serialized.data()), serialized.size());
    write_exact(
        local_whisper::common::encode_frame(local_whisper::common::FrameKind::control, body));
  }

private:
  CompletionEvent completion_event_;
};

NativeWorkerChannel::NativeWorkerChannel() : impl_(std::make_unique<Impl>()) {}
NativeWorkerChannel::~NativeWorkerChannel() noexcept = default;
nlohmann::json NativeWorkerChannel::read_control() { return impl_->read_control(); }
WorkerAudioChunk NativeWorkerChannel::read_audio() { return impl_->read_audio(); }
WorkerChannelWaitResult NativeWorkerChannel::wait_for_control_or_inference() {
  return impl_->wait_for_control_or_inference();
}
void NativeWorkerChannel::notify_inference_complete() noexcept {
  impl_->notify_inference_complete();
}
void NativeWorkerChannel::send_control(const nlohmann::json& value) { impl_->send_control(value); }

} // namespace local_whisper::whisper_cpp

#endif
