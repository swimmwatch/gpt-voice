#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/frame_codec.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <poll.h>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include <sys/eventfd.h>
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
  if (value.empty() || value.size() > local_whisper::common::kMaxAudioRequestIdBytes)
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
  try {
    const auto kind = local_whisper::common::frame_kind_from_byte(header[4]);
    static_cast<void>(local_whisper::common::validate_frame_body_length(kind, length));
  } catch (...) {
    throw CoreError(FailureCode::transcription_failed, "worker frame exceeds limit");
  }
  std::vector<std::uint8_t> frame(header.begin(), header.end());
  frame.resize(frame.size() + length);
  read_exact(descriptor, std::span<std::uint8_t>(frame).subspan(header.size()));
  static_cast<void>(local_whisper::common::decode_frame(frame));
  return frame;
}

class CompletionEvent final {
public:
  CompletionEvent() : descriptor_(eventfd(0, EFD_CLOEXEC)) {
    if (descriptor_ < 0)
      throw CoreError(FailureCode::transcription_failed, "worker completion event unavailable");
  }

  ~CompletionEvent() noexcept {
    if (descriptor_ >= 0) {
      while (close(descriptor_) < 0 && errno == EINTR) {
      }
    }
  }

  CompletionEvent(const CompletionEvent&) = delete;
  CompletionEvent& operator=(const CompletionEvent&) = delete;

  [[nodiscard]] int descriptor() const noexcept { return descriptor_; }

  void signal() noexcept {
    const std::uint64_t value = 1U;
    while (write(descriptor_, &value, sizeof(value)) < 0 && errno == EINTR) {
    }
  }

  void consume() {
    std::uint64_t value = 0U;
    while (read(descriptor_, &value, sizeof(value)) < 0) {
      if (errno != EINTR)
        throw CoreError(FailureCode::transcription_failed, "worker completion event read failed");
    }
  }

private:
  int descriptor_;
};

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
        view.body[0] != kWorkerProtocolVersion || view.body[1] > 1U) {
      throw CoreError(FailureCode::audio_format_unsupported, "invalid audio frame");
    }
    const auto sequence = read_big_u32(std::span<const std::uint8_t, 4>(view.body.data() + 2, 4));
    const auto request_bytes =
        read_big_u16(std::span<const std::uint8_t, 2>(view.body.data() + 6, 2));
    if (request_bytes == 0U || request_bytes > local_whisper::common::kMaxAudioRequestIdBytes ||
        8U + request_bytes > view.body.size())
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

  [[nodiscard]] WorkerChannelWaitResult wait_for_control_or_inference() {
    std::array<pollfd, 2> descriptors{
        {{STDIN_FILENO, POLLIN, 0}, {completion_event_.descriptor(), POLLIN, 0}}};
    int result = 0;
    do {
      result = poll(descriptors.data(), descriptors.size(), -1);
    } while (result < 0 && errno == EINTR);
    if (result < 0)
      throw CoreError(FailureCode::transcription_failed, "worker wait failed");
    if ((descriptors[1].revents & POLLIN) != 0) {
      completion_event_.consume();
      return WorkerChannelWaitResult::inference_completed;
    }
    if ((descriptors[0].revents & POLLIN) != 0)
      return WorkerChannelWaitResult::control_ready;
    if ((descriptors[0].revents & (POLLERR | POLLHUP | POLLNVAL)) != 0)
      return WorkerChannelWaitResult::control_closed;
    throw CoreError(FailureCode::transcription_failed, "worker wait returned no event");
  }

  void notify_inference_complete() noexcept { completion_event_.signal(); }

  void send_control(const nlohmann::json& value) {
    const auto serialized = value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
    const auto body = std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(serialized.data()), serialized.size());
    const auto frame =
        local_whisper::common::encode_frame(local_whisper::common::FrameKind::control, body);
    write_exact(STDOUT_FILENO, frame);
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
