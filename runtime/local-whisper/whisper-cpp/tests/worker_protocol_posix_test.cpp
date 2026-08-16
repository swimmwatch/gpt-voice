#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#if defined(__linux__)

#include "local_whisper/common/frame_codec.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <span>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::size_t kRegressionAudioBytes = 70'000U;
constexpr std::size_t kWriterChunkBytes = 64U * 1024U;

class UniqueDescriptor final {
public:
  explicit UniqueDescriptor(int descriptor) noexcept : descriptor_(descriptor) {}

  ~UniqueDescriptor() noexcept {
    if (descriptor_ >= 0) {
      while (close(descriptor_) < 0 && errno == EINTR) {
      }
    }
  }

  UniqueDescriptor(const UniqueDescriptor&) = delete;
  UniqueDescriptor& operator=(const UniqueDescriptor&) = delete;

  [[nodiscard]] int get() const noexcept { return descriptor_; }

private:
  int descriptor_;
};

class StandardInputOverride final {
public:
  explicit StandardInputOverride(int replacement) : original_(dup(STDIN_FILENO)) {
    if (original_ < 0 || dup2(replacement, STDIN_FILENO) < 0) {
      if (original_ >= 0) {
        while (close(original_) < 0 && errno == EINTR) {
        }
      }
      throw std::runtime_error("test standard input override failed");
    }
  }

  ~StandardInputOverride() noexcept {
    if (original_ >= 0) {
      while (dup2(original_, STDIN_FILENO) < 0 && errno == EINTR) {
      }
      while (close(original_) < 0 && errno == EINTR) {
      }
    }
  }

  StandardInputOverride(const StandardInputOverride&) = delete;
  StandardInputOverride& operator=(const StandardInputOverride&) = delete;

private:
  int original_;
};

std::vector<std::uint8_t> regression_audio_frame(const std::string& request_id) {
  std::vector<std::uint8_t> body(8U + request_id.size() + kRegressionAudioBytes, 0U);
  body[0] = kWorkerProtocolVersion;
  body[1] = 1U;
  body[6] = static_cast<std::uint8_t>((request_id.size() >> 8U) & 0xffU);
  body[7] = static_cast<std::uint8_t>(request_id.size() & 0xffU);
  std::copy(request_id.begin(), request_id.end(), body.begin() + 8);
  return local_whisper::common::encode_frame(local_whisper::common::FrameKind::audio, body);
}

TEST(WorkerProtocolPosix, ReadsProtocolV2AudioFrame) {
  std::array<int, 2> descriptors{-1, -1};
  ASSERT_EQ(pipe(descriptors.data()), 0);
  UniqueDescriptor reader(descriptors[0]);
  UniqueDescriptor writer(descriptors[1]);
  StandardInputOverride standard_input(reader.get());
  const std::string request_id = "tx-posix-protocol-v2";
  const auto frame = regression_audio_frame(request_id);
  bool write_succeeded = true;
  std::jthread write_thread([&] {
    std::span<const std::uint8_t> remaining(frame);
    while (!remaining.empty()) {
      const auto requested = std::min<std::size_t>(remaining.size(), kWriterChunkBytes);
      const auto written = write(writer.get(), remaining.data(), requested);
      if (written <= 0) {
        write_succeeded = false;
        return;
      }
      remaining = remaining.subspan(static_cast<std::size_t>(written));
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
}

} // namespace
} // namespace local_whisper::whisper_cpp

#endif
