#include "local_whisper/whisper_cpp/cancellation.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

namespace local_whisper::whisper_cpp {

void CancellationController::request() noexcept {
  requested_.store(true, std::memory_order_release);
}

void CancellationController::reset() noexcept {
  requested_.store(false, std::memory_order_release);
}

bool CancellationController::requested() const noexcept {
  return requested_.load(std::memory_order_acquire);
}

void CancellationController::checkpoint() const {
  if (requested())
    throw CoreError(FailureCode::cancelled, "worker operation cancelled");
}

bool InferenceTerminalArbiter::try_succeed() noexcept {
  auto expected = InferenceTerminal::running;
  return state_.compare_exchange_strong(expected, InferenceTerminal::succeeded,
                                        std::memory_order_acq_rel);
}

bool InferenceTerminalArbiter::cancel() noexcept {
  auto expected = InferenceTerminal::running;
  return state_.compare_exchange_strong(expected, InferenceTerminal::cancelled,
                                        std::memory_order_acq_rel);
}

InferenceTerminal InferenceTerminalArbiter::state() const noexcept {
  return state_.load(std::memory_order_acquire);
}

} // namespace local_whisper::whisper_cpp
