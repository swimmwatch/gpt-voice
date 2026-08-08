#pragma once

#include <nlohmann/json.hpp>

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

class WorkerChannel {
public:
  virtual ~WorkerChannel() = default;

  [[nodiscard]] virtual nlohmann::json read_control() = 0;
  [[nodiscard]] virtual WorkerAudioChunk read_audio() = 0;
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
  void send_control(const nlohmann::json& value) override;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::whisper_cpp
