#pragma once

#include "local_whisper/common/nlohmann_json.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace local_whisper::whisper_cpp {

struct WorkerAudioChunk final {
  std::string request_id;
  std::uint32_t sequence;
  bool final;
  std::vector<std::uint8_t> bytes;
};

enum class WorkerChannelWaitResult : std::uint8_t {
  control_ready,
  control_closed,
  inference_completed,
};

class WorkerChannel {
public:
  virtual ~WorkerChannel() = default;

  [[nodiscard]] virtual nlohmann::json read_control() = 0;
  [[nodiscard]] virtual WorkerAudioChunk read_audio() = 0;
  [[nodiscard]] virtual WorkerChannelWaitResult wait_for_control_or_inference() = 0;
  virtual void notify_inference_complete() noexcept = 0;
  virtual void send_control(const nlohmann::json& value) = 0;
};

class NativeWorkerChannel final : public WorkerChannel {
public:
  NativeWorkerChannel();
  ~NativeWorkerChannel() noexcept override;

  NativeWorkerChannel(const NativeWorkerChannel&) = delete;
  NativeWorkerChannel& operator=(const NativeWorkerChannel&) = delete;

  [[nodiscard]] nlohmann::json read_control() override;
  [[nodiscard]] WorkerAudioChunk read_audio() override;
  [[nodiscard]] WorkerChannelWaitResult wait_for_control_or_inference() override;
  void notify_inference_complete() noexcept override;
  void send_control(const nlohmann::json& value) override;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::whisper_cpp
