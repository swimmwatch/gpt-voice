#pragma once

#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/cpu_probe.hpp"
#include "local_whisper/whisper_cpp/device_authority.hpp"
#include "local_whisper/whisper_cpp/engine.hpp"
#include "local_whisper/whisper_cpp/model_authority.hpp"
#include "local_whisper/whisper_cpp/worker_protocol.hpp"

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

class WorkerApplication final {
public:
  WorkerApplication(WorkerRunMode mode, WorkerChannel& channel, SpeechEngine& engine,
                    CpuProbe& probe, WorkerClock& clock, CancellationController& cancellation,
                    ModelAuthorityView* model_authority,
                    const DeviceProofAuthority* device_authority);

  [[nodiscard]] int run() noexcept;

private:
  [[nodiscard]] int run_checked();
  void require_not_cancelled() const;

  WorkerRunMode mode_;
  WorkerChannel& channel_;
  SpeechEngine& engine_;
  CpuProbe& probe_;
  WorkerClock& clock_;
  CancellationController& cancellation_;
  ModelAuthorityView* model_authority_;
  const DeviceProofAuthority* device_authority_;
  std::optional<std::string> current_request_id_;
};

} // namespace local_whisper::whisper_cpp
