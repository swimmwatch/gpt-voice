#pragma once

#include "local_whisper/common/native_logger.hpp"
#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/cpu_probe.hpp"
#include "local_whisper/whisper_cpp/device_authority.hpp"
#include "local_whisper/whisper_cpp/engine.hpp"
#include "local_whisper/whisper_cpp/model_authority.hpp"
#include "local_whisper/whisper_cpp/pcm_audio.hpp"
#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#include <cstddef>
#include <cstdint>
#include <optional>

namespace local_whisper::whisper_cpp {

enum class WorkerRunMode { probe, load };

class WorkerClock {
public:
  virtual ~WorkerClock() = default;
  [[nodiscard]] virtual std::uint64_t now_ticks() const noexcept = 0;
};

class SteadyWorkerClock final : public WorkerClock {
public:
  [[nodiscard]] std::uint64_t now_ticks() const noexcept override;
};

struct WavBufferReleaseEvidence final {
  std::size_t byte_length;
  std::size_t capacity_before_release;
  std::size_t capacity_after_release;
};

class WorkerAudioLifetimeObserver {
public:
  virtual ~WorkerAudioLifetimeObserver() = default;
  virtual void source_wav_released(WavBufferReleaseEvidence evidence) noexcept = 0;
  virtual void inference_pcm_released(std::size_t sample_count) noexcept = 0;
};

class WorkerApplication final {
public:
  WorkerApplication(WorkerRunMode mode, WorkerChannel& channel, SpeechEngine& engine,
                    PcmAudioConverter& pcm_converter, CpuProbe& probe, WorkerClock& clock,
                    CancellationController& cancellation, ModelAuthorityView* model_authority,
                    const DeviceProofAuthority* device_authority,
                    common::NativeLogger* native_logger = nullptr,
                    WorkerAudioLifetimeObserver* audio_lifetime_observer = nullptr);

  [[nodiscard]] int run() noexcept;

private:
  [[nodiscard]] int run_checked();
  void cleanup_engine() noexcept;
  void require_not_cancelled() const;
  void log(common::NativeLogEvent event, common::NativeLogFields fields = {}) const noexcept;

  WorkerRunMode mode_;
  WorkerChannel& channel_;
  SpeechEngine& engine_;
  PcmAudioConverter& pcm_converter_;
  CpuProbe& probe_;
  WorkerClock& clock_;
  CancellationController& cancellation_;
  ModelAuthorityView* model_authority_;
  const DeviceProofAuthority* device_authority_;
  common::NativeLogger* native_logger_;
  WorkerAudioLifetimeObserver* audio_lifetime_observer_;
  std::optional<std::string> current_request_id_;
};

} // namespace local_whisper::whisper_cpp
