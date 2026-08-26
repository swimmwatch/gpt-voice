#pragma once

#include <atomic>
#include <cstdint>

namespace local_whisper::whisper_cpp {

class CancellationToken {
public:
  virtual ~CancellationToken() = default;
  [[nodiscard]] virtual bool requested() const noexcept = 0;
};

class CancellationController final : public CancellationToken {
public:
  void request() noexcept;
  void reset() noexcept;
  [[nodiscard]] bool requested() const noexcept override;
  void checkpoint() const;

private:
  std::atomic_bool requested_{false};
};

enum class InferenceTerminal : std::uint8_t { running, succeeded, cancelled };

class InferenceTerminalArbiter final {
public:
  [[nodiscard]] bool try_succeed() noexcept;
  [[nodiscard]] bool cancel() noexcept;
  [[nodiscard]] InferenceTerminal state() const noexcept;

private:
  std::atomic<InferenceTerminal> state_{InferenceTerminal::running};
};

} // namespace local_whisper::whisper_cpp
