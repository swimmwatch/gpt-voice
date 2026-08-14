#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/common/frame_codec.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <span>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::size_t kRegressionAudioBytes = 404'524U;
constexpr std::size_t kWriterChunkBytes = 64U * 1024U;

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE handle) noexcept : handle_(handle) {}
  ~UniqueHandle() noexcept {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE)
      static_cast<void>(CloseHandle(handle_));
  }

  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;

  [[nodiscard]] HANDLE get() const noexcept { return handle_; }

private:
  HANDLE handle_;
};

class StandardInputOverride final {
public:
  explicit StandardInputOverride(HANDLE replacement) : original_(GetStdHandle(STD_INPUT_HANDLE)) {
    if (!SetStdHandle(STD_INPUT_HANDLE, replacement))
      throw std::runtime_error("test standard input override failed");
  }

  ~StandardInputOverride() noexcept {
    static_cast<void>(SetStdHandle(STD_INPUT_HANDLE, original_));
  }

  StandardInputOverride(const StandardInputOverride&) = delete;
  StandardInputOverride& operator=(const StandardInputOverride&) = delete;

private:
  HANDLE original_;
};

std::vector<std::uint8_t> regression_audio_frame(const std::string& request_id) {
  std::vector<std::uint8_t> body(8U + request_id.size() + kRegressionAudioBytes, 0U);
  body[0] = 1U;
  body[1] = 1U;
  body[6] = static_cast<std::uint8_t>((request_id.size() >> 8U) & 0xffU);
  body[7] = static_cast<std::uint8_t>(request_id.size() & 0xffU);
  std::copy(request_id.begin(), request_id.end(), body.begin() + 8);
  return local_whisper::common::encode_frame(local_whisper::common::FrameKind::audio, body);
}

TEST(WorkerProtocolWindows, ReadsAudioLargerThanAnonymousPipeBufferWithoutDeadlock) {
  HANDLE read_handle = INVALID_HANDLE_VALUE;
  HANDLE write_handle = INVALID_HANDLE_VALUE;
  ASSERT_TRUE(CreatePipe(&read_handle, &write_handle, nullptr, 0U));
  UniqueHandle reader(read_handle);
  UniqueHandle writer(write_handle);
  StandardInputOverride standard_input(reader.get());
  const std::string request_id = "tx-windows-pipe-buffer";
  const auto frame = regression_audio_frame(request_id);
  bool write_succeeded = true;
  std::jthread write_thread([&] {
    std::span<const std::uint8_t> remaining(frame);
    while (!remaining.empty()) {
      const auto requested =
          static_cast<DWORD>(std::min<std::size_t>(remaining.size(), kWriterChunkBytes));
      DWORD written = 0U;
      if (!WriteFile(writer.get(), remaining.data(), requested, &written, nullptr) ||
          written == 0U) {
        write_succeeded = false;
        return;
      }
      remaining = remaining.subspan(written);
    }
  });

  NativeWorkerChannel channel;
  const auto chunk = channel.read_audio();
  write_thread.join();

  EXPECT_TRUE(write_succeeded);
  EXPECT_EQ(chunk.request_id, request_id);
  EXPECT_EQ(chunk.sequence, 0U);
  EXPECT_TRUE(chunk.final);
  EXPECT_EQ(chunk.bytes.size(), kRegressionAudioBytes);

  std::jthread notifier([&] {
    std::this_thread::sleep_for(std::chrono::milliseconds(25));
    channel.notify_inference_complete();
  });
  EXPECT_EQ(channel.wait_for_control_or_inference(), WorkerChannelWaitResult::inference_completed);
}

} // namespace
} // namespace local_whisper::whisper_cpp

#endif
