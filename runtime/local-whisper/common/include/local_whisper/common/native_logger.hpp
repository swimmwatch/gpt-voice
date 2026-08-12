#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <string_view>

namespace local_whisper::common {

/** The closed native-runtime JSONL schema version. */
inline constexpr std::uint32_t kNativeRuntimeLogSchemaVersion = 1U;
inline constexpr std::size_t kNativeRuntimeLogMaximumLineBytes = 4'096U;

enum class NativeLogComponent : std::uint8_t {
  filesystem_guard,
  launcher,
  model_launcher,
  whisper_worker,
};

enum class NativeLogEvent : std::uint8_t {
  process_started,
  process_ready,
  process_stopping,
  process_stopped,
  handshake_accepted,
  handshake_rejected,
  state_cold,
  state_warming,
  state_warmed,
  state_busy,
  state_stopping,
  request_accepted,
  request_completed,
  request_cancelled,
  request_cancel_too_late,
  control_eof,
  protocol_rejected,
  model_load_started,
  model_load_completed,
  model_load_failed,
  inference_started,
  inference_completed,
  inference_failed,
  resource_cleanup_started,
  resource_cleanup_completed,
  native_failure,
  count,
};

enum class NativeLogErrorCode : std::uint8_t {
  cancel_conflict,
  control_closed,
  invalid_configuration,
  invalid_input,
  io_failure,
  model_load_failure,
  protocol_mismatch,
  resource_limit,
  runtime_failure,
  unsupported,
  count,
};

enum class NativeLogLevel : std::uint8_t {
  debug,
  info,
  warn,
  error,
};

struct NativeLogConfiguration final {
  NativeLogLevel minimum_level;
  std::string process_instance_id;
};

struct NativeLogFields final {
  std::optional<NativeLogErrorCode> error_code;
  std::optional<std::string_view> request_id;
};

class NativeLogClock {
public:
  virtual ~NativeLogClock() = default;
  [[nodiscard]] virtual std::uint64_t elapsed_milliseconds() const noexcept = 0;
};

class NativeLogSink {
public:
  virtual ~NativeLogSink() = default;
  [[nodiscard]] virtual bool write(std::string_view line) noexcept = 0;
};

/** Explicitly owned, diagnostic-only logging contract for native composition roots. */
class NativeLogger {
public:
  virtual ~NativeLogger() = default;
  virtual void emit(NativeLogComponent component, NativeLogEvent event,
                    NativeLogFields fields = {}) noexcept = 0;
  virtual void shutdown() noexcept = 0;
};

/** Portable steady clock used by production native process roots. */
class SteadyNativeLogClock final : public NativeLogClock {
public:
  SteadyNativeLogClock() noexcept;
  [[nodiscard]] std::uint64_t elapsed_milliseconds() const noexcept override;

private:
  std::uint64_t started_ticks_;
};

/** Project-owned stderr sink; stdout remains exclusively protocol-owned. */
class StandardErrorNativeLogSink final : public NativeLogSink {
public:
  [[nodiscard]] bool write(std::string_view line) noexcept override;
};

/** Thread-safe canonical JSONL logger with bounded fixed-key rate state. */
class NativeJsonLogger final : public NativeLogger {
public:
  NativeJsonLogger(NativeLogConfiguration configuration, NativeLogClock& clock,
                   std::unique_ptr<NativeLogSink> sink);
  ~NativeJsonLogger() override;

  NativeJsonLogger(const NativeJsonLogger&) = delete;
  NativeJsonLogger& operator=(const NativeJsonLogger&) = delete;

  void emit(NativeLogComponent component, NativeLogEvent event,
            NativeLogFields fields = {}) noexcept override;
  void shutdown() noexcept override;

private:
  struct RateState;
  struct PreparedFields;

  [[nodiscard]] bool emit_locked(NativeLogComponent component, NativeLogEvent event,
                                 const PreparedFields& fields, std::uint64_t elapsed_milliseconds,
                                 std::optional<std::uint64_t> suppressed_count,
                                 bool bypass_rate_limit) noexcept;

  NativeLogConfiguration configuration_;
  NativeLogClock& clock_;
  std::unique_ptr<NativeLogSink> sink_;
  std::uint64_t next_sequence_ = 1U;
  bool shutdown_ = false;
  bool writes_disabled_ = false;
  std::unique_ptr<RateState[]> rate_states_;
  std::size_t rate_state_count_ = 0U;
  class MutexHolder;
  std::unique_ptr<MutexHolder> mutex_;
};

/** Parses only a valid private launch configuration; invalid input disables native logging. */
[[nodiscard]] std::optional<NativeLogConfiguration>
native_log_configuration_from_environment() noexcept;

[[nodiscard]] std::unique_ptr<NativeLogger> make_native_logger_from_environment() noexcept;

[[nodiscard]] std::string_view native_log_component_name(NativeLogComponent value) noexcept;
[[nodiscard]] std::string_view native_log_event_name(NativeLogEvent value) noexcept;
[[nodiscard]] std::string_view native_log_error_code_name(NativeLogErrorCode value) noexcept;
[[nodiscard]] NativeLogLevel native_log_event_level(NativeLogEvent value) noexcept;

} // namespace local_whisper::common
