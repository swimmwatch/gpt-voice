#include "local_whisper/common/native_logger.hpp"

#include <array>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <memory>
#include <mutex>
#include <new>
#include <string>
#include <utility>

namespace local_whisper::common {
namespace {

constexpr std::uint64_t kRateWindowMilliseconds = 60'000U;
constexpr std::uint32_t kMaximumRecordsPerWindow = 10U;
constexpr std::uint64_t kMaximumSafeInteger = 9'007'199'254'740'991U;
constexpr std::size_t kComponentCount =
    static_cast<std::size_t>(NativeLogComponent::whisper_worker) + 1U;
constexpr std::size_t kEventCount = static_cast<std::size_t>(NativeLogEvent::count);
constexpr std::size_t kErrorCodeCount = static_cast<std::size_t>(NativeLogErrorCode::count) + 1U;
constexpr std::size_t kRateStateCount = kComponentCount * kEventCount * kErrorCodeCount;

thread_local const NativeJsonLogger* active_logger = nullptr;

[[nodiscard]] bool is_valid_uuid(const std::string_view value) noexcept {
  if (value.size() != 36U)
    return false;
  for (std::size_t index = 0; index < value.size(); ++index) {
    if (index == 8U || index == 13U || index == 18U || index == 23U) {
      if (value[index] != '-')
        return false;
      continue;
    }
    const char character = value[index];
    if (!((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f')))
      return false;
  }
  return value[14U] >= '1' && value[14U] <= '8' &&
         (value[19U] == '8' || value[19U] == '9' || value[19U] == 'a' || value[19U] == 'b');
}

[[nodiscard]] std::optional<std::string> environment_value(const char* const name) noexcept {
  try {
#if defined(_WIN32)
    char* allocated = nullptr;
    std::size_t length = 0U;
    if (_dupenv_s(&allocated, &length, name) != 0 || allocated == nullptr)
      return std::nullopt;
    const std::unique_ptr<char, decltype(&std::free)> value(allocated, &std::free);
    return std::string(value.get());
#else
    const char* const value = std::getenv(name);
    return value == nullptr ? std::nullopt : std::optional<std::string>(value);
#endif
  } catch (...) {
    return std::nullopt;
  }
}

[[nodiscard]] bool is_valid_utf8(const std::string_view value) noexcept {
  std::size_t index = 0U;
  while (index < value.size()) {
    const auto byte = static_cast<unsigned char>(value[index]);
    if (byte <= 0x7fU) {
      if (byte < 0x20U || byte == 0x7fU)
        return false;
      ++index;
      continue;
    }
    std::size_t continuation_count = 0U;
    std::uint32_t code_point = 0U;
    if (byte >= 0xc2U && byte <= 0xdfU) {
      continuation_count = 1U;
      code_point = byte & 0x1fU;
    } else if (byte >= 0xe0U && byte <= 0xefU) {
      continuation_count = 2U;
      code_point = byte & 0x0fU;
    } else if (byte >= 0xf0U && byte <= 0xf4U) {
      continuation_count = 3U;
      code_point = byte & 0x07U;
    } else {
      return false;
    }
    if (index + continuation_count >= value.size())
      return false;
    for (std::size_t offset = 1U; offset <= continuation_count; ++offset) {
      const auto continuation = static_cast<unsigned char>(value[index + offset]);
      if ((continuation & 0xc0U) != 0x80U)
        return false;
      code_point = (code_point << 6U) | (continuation & 0x3fU);
    }
    if ((continuation_count == 2U && code_point < 0x800U) ||
        (continuation_count == 3U && code_point < 0x10000U) || code_point > 0x10ffffU ||
        (code_point >= 0xd800U && code_point <= 0xdfffU)) {
      return false;
    }
    index += continuation_count + 1U;
  }
  return true;
}

void append_json_string(std::string& output, const std::string_view value) {
  output.push_back('"');
  for (const unsigned char character : value) {
    switch (character) {
    case '"':
      output += "\\\"";
      break;
    case '\\':
      output += "\\\\";
      break;
    default:
      output.push_back(static_cast<char>(character));
      break;
    }
  }
  output.push_back('"');
}

void append_member_prefix(std::string& output, const std::string_view key, bool& first) {
  if (!first)
    output.push_back(',');
  first = false;
  append_json_string(output, key);
  output.push_back(':');
}

[[nodiscard]] bool is_enabled(const NativeLogLevel minimum, const NativeLogLevel value) noexcept {
  return static_cast<unsigned int>(value) >= static_cast<unsigned int>(minimum);
}

[[nodiscard]] std::size_t rate_index(const NativeLogComponent component, const NativeLogEvent event,
                                     const std::optional<NativeLogErrorCode> error_code) noexcept {
  const std::size_t component_index = static_cast<std::size_t>(component);
  const std::size_t event_index = static_cast<std::size_t>(event);
  const std::size_t error_index =
      error_code.has_value() ? static_cast<std::size_t>(*error_code) + 1U : 0U;
  return ((component_index * kEventCount) + event_index) * kErrorCodeCount + error_index;
}

} // namespace

struct NativeJsonLogger::RateState final {
  std::uint64_t window_started_at = 0U;
  std::uint64_t suppressed_count = 0U;
  std::uint32_t emitted_count = 0U;
  bool initialized = false;
};

struct NativeJsonLogger::PreparedFields final {
  std::optional<NativeLogErrorCode> error_code;
  std::optional<std::string> request_id;
};

class NativeJsonLogger::MutexHolder final {
public:
  std::recursive_mutex value;
};

NativeJsonLogger::~NativeJsonLogger() = default;

SteadyNativeLogClock::SteadyNativeLogClock() noexcept
    : started_ticks_(
          static_cast<std::uint64_t>(std::chrono::steady_clock::now().time_since_epoch().count())) {
}

std::uint64_t SteadyNativeLogClock::elapsed_milliseconds() const noexcept {
  const auto now =
      static_cast<std::uint64_t>(std::chrono::steady_clock::now().time_since_epoch().count());
  if (now <= started_ticks_)
    return 0U;
  const auto period = std::chrono::steady_clock::period{};
  const long double milliseconds = static_cast<long double>(now - started_ticks_) *
                                   static_cast<long double>(period.num) * 1'000.0L /
                                   static_cast<long double>(period.den);
  if (milliseconds >= static_cast<long double>(std::numeric_limits<std::uint64_t>::max()))
    return std::numeric_limits<std::uint64_t>::max();
  return static_cast<std::uint64_t>(milliseconds);
}

bool StandardErrorNativeLogSink::write(const std::string_view line) noexcept {
  if (line.empty() || std::fwrite(line.data(), 1U, line.size(), stderr) != line.size())
    return false;
  return std::fflush(stderr) == 0;
}

NativeJsonLogger::NativeJsonLogger(NativeLogConfiguration configuration, NativeLogClock& clock,
                                   std::unique_ptr<NativeLogSink> sink)
    : configuration_(std::move(configuration)), clock_(clock), sink_(std::move(sink)),
      rate_states_(std::make_unique<RateState[]>(kRateStateCount)),
      rate_state_count_(kRateStateCount), mutex_(std::make_unique<MutexHolder>()) {
  if (!is_valid_uuid(configuration_.process_instance_id) || sink_ == nullptr)
    writes_disabled_ = true;
}

void NativeJsonLogger::emit(const NativeLogComponent component, const NativeLogEvent event,
                            const NativeLogFields fields) noexcept {
  if (active_logger != nullptr || static_cast<std::size_t>(component) >= kComponentCount ||
      static_cast<std::size_t>(event) >= kEventCount ||
      (fields.error_code.has_value() && static_cast<std::size_t>(*fields.error_code) >=
                                            static_cast<std::size_t>(NativeLogErrorCode::count)) ||
      !is_enabled(configuration_.minimum_level, native_log_event_level(event))) {
    return;
  }
  try {
    PreparedFields prepared{fields.error_code, std::nullopt};
    if (fields.request_id.has_value()) {
      if (fields.request_id->size() > 128U || !is_valid_utf8(*fields.request_id))
        return;
      prepared.request_id.emplace(*fields.request_id);
    }
    const auto now = clock_.elapsed_milliseconds();
    std::scoped_lock lock(mutex_->value);
    if (shutdown_ || writes_disabled_ || sink_ == nullptr)
      return;
    auto& state = rate_states_[rate_index(component, event, prepared.error_code)];
    std::optional<std::uint64_t> suppressed_count;
    if (!state.initialized || now < state.window_started_at ||
        now - state.window_started_at >= kRateWindowMilliseconds) {
      if (state.initialized && state.suppressed_count != 0U)
        suppressed_count = state.suppressed_count;
      state = RateState{now, 0U, 0U, true};
    }
    if (state.emitted_count >= kMaximumRecordsPerWindow) {
      if (state.suppressed_count >= kMaximumSafeInteger) {
        writes_disabled_ = true;
        return;
      }
      ++state.suppressed_count;
      return;
    }
    if (emit_locked(component, event, prepared, now, suppressed_count, false))
      ++state.emitted_count;
  } catch (...) {
    // Allocation/clock failures contain diagnostics only; do not race a concurrent shutdown.
  }
}

void NativeJsonLogger::shutdown() noexcept {
  std::uint64_t now = 0U;
  try {
    now = clock_.elapsed_milliseconds();
  } catch (...) {
    // A failed diagnostic clock cannot keep the owner from closing the logger.
  }
  try {
    std::scoped_lock lock(mutex_->value);
    if (shutdown_)
      return;
    if (!writes_disabled_ && sink_ != nullptr && active_logger != this) {
      for (std::size_t index = 0U; index < rate_state_count_ && !writes_disabled_; ++index) {
        auto& state = rate_states_[index];
        if (!state.initialized || state.suppressed_count == 0U)
          continue;
        const auto error_index = index % kErrorCodeCount;
        const auto event_index = (index / kErrorCodeCount) % kEventCount;
        const auto component_index = index / (kErrorCodeCount * kEventCount);
        const auto error_code = error_index == 0U
                                    ? std::optional<NativeLogErrorCode>{}
                                    : std::optional<NativeLogErrorCode>(
                                          static_cast<NativeLogErrorCode>(error_index - 1U));
        static_cast<void>(emit_locked(static_cast<NativeLogComponent>(component_index),
                                      static_cast<NativeLogEvent>(event_index),
                                      PreparedFields{error_code, std::nullopt}, now,
                                      state.suppressed_count, true));
        state.suppressed_count = 0U;
      }
    }
    shutdown_ = true;
  } catch (...) {
    // Explicit shutdown remains non-throwing if diagnostic synchronization fails.
  }
}

bool NativeJsonLogger::emit_locked(const NativeLogComponent component, const NativeLogEvent event,
                                   const PreparedFields& fields,
                                   const std::uint64_t elapsed_milliseconds,
                                   const std::optional<std::uint64_t> suppressed_count,
                                   const bool /*bypass_rate_limit*/) noexcept {
  std::string line;
  try {
    if (elapsed_milliseconds > kMaximumSafeInteger || next_sequence_ > kMaximumSafeInteger ||
        (suppressed_count.has_value() && *suppressed_count > kMaximumSafeInteger)) {
      writes_disabled_ = true;
      return false;
    }
    line.reserve(320U);
    bool first = true;
    line.push_back('{');
    append_member_prefix(line, "component", first);
    append_json_string(line, native_log_component_name(component));
    append_member_prefix(line, "elapsedMs", first);
    line += std::to_string(elapsed_milliseconds);
    if (fields.error_code.has_value()) {
      append_member_prefix(line, "errorCode", first);
      append_json_string(line, native_log_error_code_name(*fields.error_code));
    }
    append_member_prefix(line, "event", first);
    append_json_string(line, native_log_event_name(event));
    append_member_prefix(line, "level", first);
    append_json_string(line, native_log_event_level(event) == NativeLogLevel::debug  ? "debug"
                             : native_log_event_level(event) == NativeLogLevel::info ? "info"
                             : native_log_event_level(event) == NativeLogLevel::warn ? "warn"
                                                                                     : "error");
    append_member_prefix(line, "processInstanceId", first);
    append_json_string(line, configuration_.process_instance_id);
    if (fields.request_id.has_value()) {
      append_member_prefix(line, "requestId", first);
      append_json_string(line, *fields.request_id);
    }
    append_member_prefix(line, "schemaVersion", first);
    line += std::to_string(kNativeRuntimeLogSchemaVersion);
    append_member_prefix(line, "sequence", first);
    line += std::to_string(next_sequence_++);
    if (suppressed_count.has_value()) {
      append_member_prefix(line, "suppressedCount", first);
      line += std::to_string(*suppressed_count);
    }
    line += "}\n";
    if (line.size() > kNativeRuntimeLogMaximumLineBytes) {
      writes_disabled_ = true;
      return false;
    }
    active_logger = this;
    const bool written = sink_->write(line);
    active_logger = nullptr;
    if (!written)
      writes_disabled_ = true;
    return written;
  } catch (...) {
    active_logger = nullptr;
    writes_disabled_ = true;
    return false;
  }
}

std::optional<NativeLogConfiguration> native_log_configuration_from_environment() noexcept {
  try {
    const auto level = environment_value("LOCAL_WHISPER_NATIVE_LOG_LEVEL");
    const auto process_instance_id = environment_value("LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID");
    if (!process_instance_id.has_value() || !is_valid_uuid(*process_instance_id))
      return std::nullopt;
    if (level.has_value() && *level == "debug")
      return NativeLogConfiguration{NativeLogLevel::debug, *process_instance_id};
    return NativeLogConfiguration{NativeLogLevel::info, *process_instance_id};
  } catch (...) {
    return std::nullopt;
  }
}

std::unique_ptr<NativeLogger> make_native_logger_from_environment() noexcept {
  try {
    const auto configuration = native_log_configuration_from_environment();
    if (!configuration.has_value())
      return nullptr;
    // The logger references its clock, so retain both in one native-root owner.
    class EnvironmentLogger final : public NativeLogger {
    public:
      explicit EnvironmentLogger(NativeLogConfiguration config)
          : clock_(),
            logger_(std::move(config), clock_, std::make_unique<StandardErrorNativeLogSink>()) {}
      void emit(NativeLogComponent component, NativeLogEvent event,
                NativeLogFields fields) noexcept override {
        logger_.emit(component, event, fields);
      }
      void shutdown() noexcept override { logger_.shutdown(); }

    private:
      SteadyNativeLogClock clock_;
      NativeJsonLogger logger_;
    };
    return std::make_unique<EnvironmentLogger>(*configuration);
  } catch (...) {
    return nullptr;
  }
}

std::string_view native_log_component_name(const NativeLogComponent value) noexcept {
  constexpr std::array<std::string_view, kComponentCount> names = {
      "filesystemGuard", "launcher", "modelLauncher", "whisperWorker"};
  const auto index = static_cast<std::size_t>(value);
  return index < names.size() ? names[index] : "";
}

std::string_view native_log_event_name(const NativeLogEvent value) noexcept {
  constexpr std::array<std::string_view, kEventCount> names = {"processStarted",
                                                               "processReady",
                                                               "processStopping",
                                                               "processStopped",
                                                               "handshakeAccepted",
                                                               "handshakeRejected",
                                                               "stateCold",
                                                               "stateWarming",
                                                               "stateWarmed",
                                                               "stateBusy",
                                                               "stateStopping",
                                                               "requestAccepted",
                                                               "requestCompleted",
                                                               "requestCancelled",
                                                               "requestCancelTooLate",
                                                               "controlEof",
                                                               "protocolRejected",
                                                               "modelLoadStarted",
                                                               "modelLoadCompleted",
                                                               "modelLoadFailed",
                                                               "inferenceStarted",
                                                               "inferenceCompleted",
                                                               "inferenceFailed",
                                                               "resourceCleanupStarted",
                                                               "resourceCleanupCompleted",
                                                               "nativeFailure"};
  const auto index = static_cast<std::size_t>(value);
  return index < names.size() ? names[index] : "";
}

std::string_view native_log_error_code_name(const NativeLogErrorCode value) noexcept {
  constexpr std::array<std::string_view, static_cast<std::size_t>(NativeLogErrorCode::count)>
      names = {"cancelConflict", "controlClosed",    "invalidConfiguration", "invalidInput",
               "ioFailure",      "modelLoadFailure", "protocolMismatch",     "resourceLimit",
               "runtimeFailure", "unsupported"};
  const auto index = static_cast<std::size_t>(value);
  return index < names.size() ? names[index] : "";
}

NativeLogLevel native_log_event_level(const NativeLogEvent value) noexcept {
  switch (value) {
  case NativeLogEvent::handshake_accepted:
  case NativeLogEvent::handshake_rejected:
  case NativeLogEvent::state_cold:
  case NativeLogEvent::state_warming:
  case NativeLogEvent::state_warmed:
  case NativeLogEvent::state_busy:
  case NativeLogEvent::state_stopping:
  case NativeLogEvent::request_accepted:
  case NativeLogEvent::inference_started:
  case NativeLogEvent::resource_cleanup_started:
  case NativeLogEvent::resource_cleanup_completed:
    return NativeLogLevel::debug;
  case NativeLogEvent::control_eof:
  case NativeLogEvent::protocol_rejected:
    return NativeLogLevel::warn;
  case NativeLogEvent::model_load_failed:
  case NativeLogEvent::inference_failed:
  case NativeLogEvent::native_failure:
    return NativeLogLevel::error;
  default:
    return NativeLogLevel::info;
  }
}

} // namespace local_whisper::common
