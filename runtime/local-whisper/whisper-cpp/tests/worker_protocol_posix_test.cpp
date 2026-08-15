#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#ifndef _WIN32

#include "local_whisper/common/frame_codec.hpp"

#include <gtest/gtest.h>

#include <array>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <future>
#include <span>
#include <stdexcept>
#include <string>
#include <thread>

#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

class StandardInputOverride final {
public:
  explicit StandardInputOverride(const int replacement) : original_(dup(STDIN_FILENO)) {
    if (original_ < 0)
      throw std::runtime_error("test standard input override failed");
    if (dup2(replacement, STDIN_FILENO) != STDIN_FILENO) {
      static_cast<void>(close(original_));
      original_ = -1;
      throw std::runtime_error("test standard input override failed");
    }
  }

  ~StandardInputOverride() noexcept {
    if (original_ >= 0) {
      static_cast<void>(dup2(original_, STDIN_FILENO));
      static_cast<void>(close(original_));
    }
  }

  StandardInputOverride(const StandardInputOverride&) = delete;
  StandardInputOverride& operator=(const StandardInputOverride&) = delete;

private:
  int original_;
};

void write_all(const int descriptor, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = write(descriptor, bytes.data(), bytes.size());
    if (count <= 0)
      throw std::runtime_error("test pipe write failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

TEST(WorkerProtocolPosix, PrioritizesQueuedControlAndConsumesSimultaneousCompletion) {
  std::array<int, 2> descriptors{};
  ASSERT_EQ(pipe(descriptors.data()), 0);
  StandardInputOverride standard_input(descriptors[0]);
  static_cast<void>(close(descriptors[0]));

  NativeWorkerChannel channel;
  const std::string body = R"({"protocolVersion":1,"requestId":"cancel-race","type":"cancel"})";
  const auto frame = local_whisper::common::encode_frame(
      local_whisper::common::FrameKind::control,
      std::span<const std::uint8_t>(reinterpret_cast<const std::uint8_t*>(body.data()),
                                    body.size()));
  write_all(descriptors[1], frame);
  channel.notify_inference_complete();

  EXPECT_EQ(channel.wait_for_control_or_inference(), WorkerChannelWaitResult::control_ready);
  EXPECT_EQ(channel.read_control().at("requestId"), "cancel-race");

  std::promise<WorkerChannelWaitResult> promise;
  auto result = promise.get_future();
  std::jthread waiter([&] { promise.set_value(channel.wait_for_control_or_inference()); });
  EXPECT_EQ(result.wait_for(std::chrono::milliseconds(25)), std::future_status::timeout);
  channel.notify_inference_complete();
  EXPECT_EQ(result.get(), WorkerChannelWaitResult::inference_completed);
  static_cast<void>(close(descriptors[1]));
}

} // namespace
} // namespace local_whisper::whisper_cpp

#endif
