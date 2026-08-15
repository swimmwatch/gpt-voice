#include "local_whisper/whisper_cpp/worker_application.hpp"

#include "local_whisper/common/canonical_wav.hpp"
#include "local_whisper/common/nlohmann_json.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/exact_model_reader.hpp"
#include "local_whisper/whisper_cpp/pcm_audio.hpp"

#include <algorithm>
#include <array>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::string_view kRuntimeRevision = LOCAL_WHISPER_RUNTIME_REVISION;
constexpr std::string_view kRuntimeBackend = LOCAL_WHISPER_BACKEND_ID;
constexpr std::uint64_t kMaxSafeInteger = 9'007'199'254'740'991ULL;

nlohmann::json backend_capabilities(EngineBackend backend) {
  if (backend == EngineBackend::cpu)
    return nlohmann::json::array(
        {"cpu-baseline", "exact-model-authority", "cooperative-cancellation"});
  const std::string backend_capability = backend == EngineBackend::cuda  ? "cuda-sm-120a"
                                         : backend == EngineBackend::hip ? "hip-exact-row"
                                                                         : "vulkan-1.3-amd-preview";
  return nlohmann::json::array({backend_capability, "exact-device-proof", "exact-model-authority",
                                "cooperative-cancellation"});
}

void require_exact_keys(const nlohmann::json& value,
                        std::initializer_list<std::string_view> expected) {
  if (!value.is_object() || value.size() != expected.size())
    throw CoreError(FailureCode::invalid_settings, "invalid worker message shape");
  for (const auto key : expected) {
    if (!value.contains(key))
      throw CoreError(FailureCode::invalid_settings, "missing worker message field");
  }
}

void require_protocol(const nlohmann::json& value, std::string_view type) {
  if (!value.contains("type") || !value["type"].is_string() ||
      value["type"].get<std::string>() != type || !value.contains("protocolVersion") ||
      !value["protocolVersion"].is_number_integer() || value["protocolVersion"].get<int>() != 1) {
    throw CoreError(FailureCode::invalid_settings, "invalid worker protocol message");
  }
}

std::string require_string(const nlohmann::json& value, std::string_view key,
                           std::size_t maximum_bytes = 256U) {
  if (!value.contains(key) || !value[key].is_string())
    throw CoreError(FailureCode::invalid_settings, "invalid worker string field");
  const auto result = value[key].get<std::string>();
  if (result.empty() || result.size() > maximum_bytes ||
      std::any_of(result.begin(), result.end(),
                  [](unsigned char byte) { return byte < 0x20U || byte == 0x7fU; })) {
    throw CoreError(FailureCode::invalid_settings, "unsafe worker string field");
  }
  return result;
}

std::string request_id(const nlohmann::json& value) {
  return require_string(value, "requestId", 128U);
}

std::string hex_digest(const std::array<std::uint8_t, 32>& bytes) {
  constexpr std::string_view alphabet = "0123456789abcdef";
  std::string result;
  result.reserve(64U);
  for (const auto byte : bytes) {
    result.push_back(alphabet[byte >> 4U]);
    result.push_back(alphabet[byte & 0x0fU]);
  }
  return result;
}

std::string base64url(std::span<const std::uint8_t> bytes) {
  constexpr std::string_view alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string result;
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const auto byte : bytes) {
    accumulator = (accumulator << 8U) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result.push_back(alphabet[(accumulator >> static_cast<unsigned>(bits)) & 0x3fU]);
    }
  }
  if (bits > 0)
    result.push_back(alphabet[(accumulator << static_cast<unsigned>(6 - bits)) & 0x3fU]);
  return result;
}

class InferenceStopGuard final {
public:
  InferenceStopGuard(std::jthread& thread, CancellationController& cancellation) noexcept
      : thread_(thread), cancellation_(cancellation) {}

  ~InferenceStopGuard() noexcept {
    if (!armed_)
      return;
    cancellation_.request();
    thread_.request_stop();
  }

  InferenceStopGuard(const InferenceStopGuard&) = delete;
  InferenceStopGuard& operator=(const InferenceStopGuard&) = delete;

  void disarm() noexcept { armed_ = false; }

private:
  std::jthread& thread_;
  CancellationController& cancellation_;
  bool armed_ = true;
};

struct InferenceOutcome final {
  std::exception_ptr error;
  std::optional<std::string> transcript;
};

class SourceWavBuffer final {
public:
  SourceWavBuffer(std::vector<std::uint8_t> bytes, WorkerAudioLifetimeObserver* observer) noexcept
      : bytes_(std::move(bytes)), observer_(observer) {}

  ~SourceWavBuffer() noexcept {
    const auto byte_length = bytes_.size();
    const auto capacity_before_release = bytes_.capacity();
    std::vector<std::uint8_t>().swap(bytes_);
    if (observer_ != nullptr)
      observer_->source_wav_released({byte_length, capacity_before_release, bytes_.capacity()});
  }

  SourceWavBuffer(const SourceWavBuffer&) = delete;
  SourceWavBuffer& operator=(const SourceWavBuffer&) = delete;

  [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept { return bytes_; }

private:
  std::vector<std::uint8_t> bytes_;
  WorkerAudioLifetimeObserver* observer_;
};

class InferencePcmBuffer final {
public:
  InferencePcmBuffer(PcmAudio audio, WorkerAudioLifetimeObserver* observer)
      : audio_(std::move(audio)), observer_(observer) {}

  ~InferencePcmBuffer() noexcept {
    const auto sample_count = audio_->samples().size();
    audio_.reset();
    if (observer_ != nullptr)
      observer_->inference_pcm_released(sample_count);
  }

  InferencePcmBuffer(const InferencePcmBuffer&) = delete;
  InferencePcmBuffer& operator=(const InferencePcmBuffer&) = delete;

  [[nodiscard]] std::span<const float> samples() const noexcept { return audio_->samples(); }

private:
  std::optional<PcmAudio> audio_;
  WorkerAudioLifetimeObserver* observer_;
};

std::string protocol_failure(FailureCode code) {
  switch (code) {
  case FailureCode::runtime_prerequisite_missing:
    return "RUNTIME_PREREQUISITE_MISSING";
  case FailureCode::device_not_allowlisted:
    return "DEVICE_NOT_ALLOWLISTED";
  case FailureCode::backend_unsupported:
    return "BACKEND_UNSUPPORTED";
  case FailureCode::target_unsupported:
    return "TARGET_UNSUPPORTED";
  case FailureCode::driver_incompatible:
    return "DRIVER_INCOMPATIBLE";
  case FailureCode::gpu_permission_denied:
    return "GPU_PERMISSION_DENIED";
  case FailureCode::device_not_found:
    return "DEVICE_NOT_FOUND";
  case FailureCode::device_feature_missing:
    return "DEVICE_FEATURE_MISSING";
  case FailureCode::device_proof_failed:
    return "DEVICE_PROOF_FAILED";
  case FailureCode::backend_init_failed:
    return "BACKEND_INIT_FAILED";
  case FailureCode::model_corrupt:
    return "MODEL_CORRUPT";
  case FailureCode::model_load_failed:
    return "MODEL_LOAD_FAILED";
  case FailureCode::warmup_failed:
    return "WARMUP_FAILED";
  case FailureCode::allocation_failed:
    return "ALLOCATION_FAILED";
  case FailureCode::invalid_settings:
    return "INVALID_SETTINGS";
  case FailureCode::audio_format_unsupported:
    return "AUDIO_FORMAT_UNSUPPORTED";
  case FailureCode::transcription_failed:
    return "TRANSCRIPTION_FAILED";
  case FailureCode::cancelled:
    return "CANCELLED";
  case FailureCode::not_ready:
    return "CPU_FEATURE_MISSING";
  case FailureCode::model_authority_invalid:
    return "WORKER_START_FAILED";
  case FailureCode::cleanup_failed:
    return "CLEANUP_FAILED";
  }
  return "TRANSCRIPTION_FAILED";
}

common::NativeLogErrorCode native_log_error_code(const FailureCode code) noexcept {
  switch (code) {
  case FailureCode::cancelled:
    return common::NativeLogErrorCode::cancel_conflict;
  case FailureCode::invalid_settings:
  case FailureCode::audio_format_unsupported:
    return common::NativeLogErrorCode::invalid_input;
  case FailureCode::model_authority_invalid:
  case FailureCode::model_corrupt:
  case FailureCode::model_load_failed:
    return common::NativeLogErrorCode::model_load_failure;
  case FailureCode::allocation_failed:
    return common::NativeLogErrorCode::resource_limit;
  case FailureCode::backend_unsupported:
  case FailureCode::target_unsupported:
    return common::NativeLogErrorCode::unsupported;
  case FailureCode::device_not_allowlisted:
  case FailureCode::device_not_found:
  case FailureCode::device_feature_missing:
  case FailureCode::device_proof_failed:
  case FailureCode::driver_incompatible:
  case FailureCode::gpu_permission_denied:
    return common::NativeLogErrorCode::protocol_mismatch;
  case FailureCode::runtime_prerequisite_missing:
  case FailureCode::backend_init_failed:
  case FailureCode::warmup_failed:
  case FailureCode::transcription_failed:
  case FailureCode::not_ready:
  case FailureCode::cleanup_failed:
    return common::NativeLogErrorCode::runtime_failure;
  }
  return common::NativeLogErrorCode::runtime_failure;
}

void require_cpu_binding(const nlohmann::json& value) {
  if (!value.is_object() || value.size() != 1U || value.value("kind", "") != "cpu")
    throw CoreError(FailureCode::invalid_settings, "CPU worker received non-CPU binding");
}

std::uint16_t require_gpu_binding(const nlohmann::json& value) {
  if (!value.is_object() || value.size() != 2U || value.value("kind", "") != "gpuIndex" ||
      !value.contains("index") || !value.at("index").is_number_unsigned())
    throw CoreError(FailureCode::invalid_settings,
                    "accelerator worker received invalid GPU binding");
  const auto index = value.at("index").get<std::uint64_t>();
  if (index > 255U)
    throw CoreError(FailureCode::invalid_settings, "accelerator ordinal exceeds protocol limit");
  return static_cast<std::uint16_t>(index);
}

std::string require_digest(const nlohmann::json& value, std::string_view key) {
  const auto digest = require_string(value, key, 64U);
  if (digest.size() != 64U || !std::all_of(digest.begin(), digest.end(), [](char byte) {
        return (byte >= '0' && byte <= '9') || (byte >= 'a' && byte <= 'f');
      }))
    throw CoreError(FailureCode::invalid_settings, "invalid worker digest field");
  return digest;
}

std::string require_challenge(const nlohmann::json& value, std::string_view key) {
  const auto challenge = require_string(value, key, 43U);
  if (challenge.size() != 43U || !std::all_of(challenge.begin(), challenge.end(), [](char byte) {
        return (byte >= 'A' && byte <= 'Z') || (byte >= 'a' && byte <= 'z') ||
               (byte >= '0' && byte <= '9') || byte == '-' || byte == '_';
      }))
    throw CoreError(FailureCode::invalid_settings, "invalid worker challenge field");
  return challenge;
}

struct LoadContract final {
  std::string authority_id;
  std::string request_id;
  std::string family;
  std::string variant;
  std::uint32_t cpu_threads;
  nlohmann::json residency;
  nlohmann::json model;
  std::optional<DeviceOperationAuthority> device_authority;
};

LoadContract parse_load(const nlohmann::json& value, EngineBackend backend,
                        const DeviceProofAuthority* device_authority) {
  if (backend == EngineBackend::cpu)
    require_exact_keys(value, {"type", "protocolVersion", "requestId", "authorityId",
                               "deviceBinding", "residency"});
  else
    require_exact_keys(value,
                       {"type", "protocolVersion", "requestId", "authorityId", "deviceBinding",
                        "loadChallenge", "registryFingerprint", "residency"});
  require_protocol(value, "load");
  std::optional<DeviceOperationAuthority> operation_authority;
  if (backend == EngineBackend::cpu) {
    require_cpu_binding(value.at("deviceBinding"));
  } else {
    if (device_authority == nullptr)
      throw CoreError(FailureCode::device_proof_failed, "accelerator load lacks device authority");
    const auto ordinal = require_gpu_binding(value.at("deviceBinding"));
    operation_authority =
        DeviceOperationAuthority{*device_authority, require_challenge(value, "loadChallenge"),
                                 require_digest(value, "registryFingerprint"), ordinal};
  }
  auto residency = value.at("residency");
  require_exact_keys(residency, {"engine", "runtimePackRevision", "target", "backend", "deviceId",
                                 "model", "configuredGpuCpuThreads", "resolvedCpuThreads",
                                 "logicalProcessorTopologyGeneration", "configurationEpoch"});
  const bool cpu = backend == EngineBackend::cpu;
  if (residency.value("engine", "") != "whisperCpp" ||
      residency.value("target", "") != (cpu ? "cpu" : "gpu") ||
      residency.value("backend", "") != kRuntimeBackend ||
      residency.value("runtimePackRevision", "") != kRuntimeRevision ||
      (cpu && !residency.at("deviceId").is_null()) ||
      (!cpu && (!residency.at("deviceId").is_string() ||
                residency.at("deviceId").get<std::string>().empty())) ||
      !residency.at("resolvedCpuThreads").is_number_unsigned() ||
      !residency.at("logicalProcessorTopologyGeneration").is_number_unsigned() ||
      !residency.at("configurationEpoch").is_number_unsigned())
    throw CoreError(FailureCode::invalid_settings, "invalid Whisper.cpp residency");
  const auto threads = residency.at("resolvedCpuThreads").get<std::uint64_t>();
  if (threads == 0U || threads > kMaxLogicalProcessorCount ||
      residency.at("logicalProcessorTopologyGeneration").get<std::uint64_t>() > kMaxSafeInteger ||
      residency.at("configurationEpoch").get<std::uint64_t>() > kMaxSafeInteger)
    throw CoreError(FailureCode::invalid_settings, "invalid CPU thread count");
  const auto& configured_gpu_threads = residency.at("configuredGpuCpuThreads");
  if (cpu) {
    if (!configured_gpu_threads.is_null())
      throw CoreError(FailureCode::invalid_settings, "CPU residency contains GPU thread settings");
  } else if (configured_gpu_threads.is_string()) {
    if (configured_gpu_threads.get<std::string>() != "auto")
      throw CoreError(FailureCode::invalid_settings, "invalid configured GPU CPU threads");
  } else if (!configured_gpu_threads.is_number_unsigned() ||
             configured_gpu_threads.get<std::uint64_t>() != threads) {
    throw CoreError(FailureCode::invalid_settings,
                    "configured GPU CPU threads do not match resolution");
  }
  auto model = residency.at("model");
  require_exact_keys(model, {"engine", "logicalModel", "sourceCheckpointRevision",
                             "artifactRevision", "nativeFormat", "variant"});
  const auto family = model.value("logicalModel", "");
  const auto variant = model.value("variant", "");
  const std::set<std::string> families = {"tiny",   "base",     "small",
                                          "medium", "large-v3", "large-v3-turbo"};
  if (model.value("engine", "") != "whisperCpp" || model.value("nativeFormat", "") != "ggml" ||
      !families.contains(family) || (variant != "full" && variant != "q5_0")) {
    throw CoreError(FailureCode::invalid_settings, "invalid Whisper.cpp model identity");
  }
  static_cast<void>(require_string(model, "sourceCheckpointRevision"));
  static_cast<void>(require_string(model, "artifactRevision"));
  const auto authority_id = require_string(value, "authorityId", 22U);
  if (operation_authority.has_value() &&
      operation_authority->proof_authority.authority_id != authority_id)
    throw CoreError(FailureCode::device_proof_failed, "accelerator authority identity mismatch");
  return {authority_id,
          request_id(value),
          family,
          variant,
          static_cast<std::uint32_t>(threads),
          std::move(residency),
          std::move(model),
          std::move(operation_authority)};
}

std::size_t utf8_code_points(const std::string& value) {
  return static_cast<std::size_t>(std::count_if(
      value.begin(), value.end(), [](unsigned char byte) { return (byte & 0xc0U) != 0x80U; }));
}

TranscriptionOptions parse_options(const nlohmann::json& value, std::uint32_t cpu_threads) {
  require_exact_keys(
      value, {"language", "initialPrompt", "temperatureHundredths", "strategy", "candidateCount"});
  std::string language;
  if (!value.at("language").is_null())
    language = require_string(value, "language", 128U);
  if (!value.at("initialPrompt").is_string())
    throw CoreError(FailureCode::invalid_settings, "invalid initial prompt");
  const auto prompt = value.at("initialPrompt").get<std::string>();
  if (prompt.find('\0') != std::string::npos || utf8_code_points(prompt) > 1'000U ||
      !value.at("temperatureHundredths").is_number_unsigned() ||
      !value.at("strategy").is_string()) {
    throw CoreError(FailureCode::invalid_settings, "invalid decoding settings");
  }
  const auto temperature = value.at("temperatureHundredths").get<std::uint64_t>();
  const auto strategy = value.at("strategy").get<std::string>();
  std::uint64_t candidate = 1U;
  DecodingStrategy decoded_strategy = DecodingStrategy::greedy;
  if (strategy == "greedy") {
    if (temperature != 0U || !value.at("candidateCount").is_null())
      throw CoreError(FailureCode::invalid_settings, "invalid greedy settings");
  } else if (strategy == "beamSearch" || strategy == "bestOfSampling") {
    if (!value.at("candidateCount").is_number_unsigned())
      throw CoreError(FailureCode::invalid_settings, "missing candidate count");
    candidate = value.at("candidateCount").get<std::uint64_t>();
    decoded_strategy = strategy == "beamSearch" ? DecodingStrategy::beam_search
                                                : DecodingStrategy::best_of_sampling;
    if ((strategy == "beamSearch" && temperature != 0U) ||
        (strategy == "bestOfSampling" && temperature == 0U)) {
      throw CoreError(FailureCode::invalid_settings, "invalid strategy temperature");
    }
  } else {
    throw CoreError(FailureCode::invalid_settings, "unknown decoding strategy");
  }
  if (temperature > 100U || temperature % 5U != 0U || candidate == 0U || candidate > 20U)
    throw CoreError(FailureCode::invalid_settings, "decoding value outside limits");
  return {language,
          prompt,
          static_cast<std::uint32_t>(temperature),
          decoded_strategy,
          static_cast<std::uint32_t>(candidate),
          cpu_threads};
}

} // namespace

std::uint64_t SteadyWorkerClock::now_ticks() const noexcept {
  return static_cast<std::uint64_t>(std::chrono::steady_clock::now().time_since_epoch().count());
}
WorkerApplication::WorkerApplication(WorkerRunMode mode, WorkerChannel& channel,
                                     SpeechEngine& engine, PcmAudioConverter& pcm_converter,
                                     CpuProbe& probe, WorkerClock& clock,
                                     CancellationController& cancellation,
                                     ModelAuthorityView* model_authority,
                                     const DeviceProofAuthority* device_authority,
                                     common::NativeLogger* native_logger,
                                     WorkerAudioLifetimeObserver* audio_lifetime_observer)
    : mode_(mode), channel_(channel), engine_(engine), pcm_converter_(pcm_converter), probe_(probe),
      clock_(clock), cancellation_(cancellation), model_authority_(model_authority),
      device_authority_(device_authority), native_logger_(native_logger),
      audio_lifetime_observer_(audio_lifetime_observer) {}

void WorkerApplication::require_not_cancelled() const { cancellation_.checkpoint(); }

void WorkerApplication::log(const common::NativeLogEvent event,
                            const common::NativeLogFields fields) const noexcept {
  if (native_logger_ != nullptr)
    native_logger_->emit(common::NativeLogComponent::whisper_worker, event, fields);
}

void WorkerApplication::cleanup_engine() noexcept {
  log(common::NativeLogEvent::resource_cleanup_started);
  try {
    engine_.unload();
  } catch (...) {
    // Native cleanup must not expose a raw engine error or terminate error reporting.
  }
  log(common::NativeLogEvent::resource_cleanup_completed);
}

int WorkerApplication::run() noexcept {
  try {
    return run_checked();
  } catch (const CoreError& error) {
    const auto error_code = native_log_error_code(error.code());
    const common::NativeLogFields fields{error_code,
                                         current_request_id_.has_value()
                                             ? std::optional<std::string_view>(*current_request_id_)
                                             : std::nullopt};
    if (error.code() == FailureCode::invalid_settings)
      log(common::NativeLogEvent::protocol_rejected, fields);
    if (error.code() == FailureCode::model_authority_invalid ||
        error.code() == FailureCode::model_corrupt ||
        error.code() == FailureCode::model_load_failed)
      log(common::NativeLogEvent::model_load_failed, fields);
    if (error.code() == FailureCode::audio_format_unsupported ||
        error.code() == FailureCode::transcription_failed)
      log(common::NativeLogEvent::inference_failed, fields);
    log(common::NativeLogEvent::native_failure,
        {error_code, current_request_id_.has_value()
                         ? std::optional<std::string_view>(*current_request_id_)
                         : std::nullopt});
    cleanup_engine();
    try {
      channel_.send_control(
          {{"type", "failure"},
           {"protocolVersion", 1},
           {"requestId", current_request_id_.has_value() ? nlohmann::json(*current_request_id_)
                                                         : nlohmann::json(nullptr)},
           {"code", protocol_failure(error.code())}});
    } catch (...) {
    }
    return 10;
  } catch (...) {
    log(common::NativeLogEvent::native_failure,
        {common::NativeLogErrorCode::runtime_failure, std::nullopt});
    cleanup_engine();
    return 11;
  }
}

int WorkerApplication::run_checked() {
  log(common::NativeLogEvent::state_cold);
  const auto hello = channel_.read_control();
  require_exact_keys(hello, {"type", "protocolVersion"});
  require_protocol(hello, "hello");
  channel_.send_control({{"type", "helloAck"},
                         {"protocolVersion", 1},
                         {"engine", "whisperCpp"},
                         {"runtimeRevision", kRuntimeRevision},
                         {"runtimeBuildDigest", LOCAL_WHISPER_RUNTIME_BUILD_DIGEST},
                         {"backend", kRuntimeBackend},
                         {"capabilities", backend_capabilities(engine_.backend())},
                         {"maxControlFrameBytes", 1'048'576},
                         {"maxAudioChunkBytes", 1'048'576}});
  log(common::NativeLogEvent::handshake_accepted);
  log(common::NativeLogEvent::process_ready);

  if (mode_ == WorkerRunMode::probe) {
    const auto message = channel_.read_control();
    if (engine_.backend() == EngineBackend::cpu)
      require_exact_keys(message,
                         {"type", "protocolVersion", "requestId", "authorityId", "deviceBinding"});
    else
      require_exact_keys(message, {"type", "protocolVersion", "requestId", "authorityId",
                                   "deviceBinding", "probeChallenge", "registryFingerprint"});
    require_protocol(message, "probe");
    current_request_id_ = request_id(message);
    require_not_cancelled();
    const auto authority_id = require_string(message, "authorityId", 22U);
    if (engine_.backend() == EngineBackend::cpu) {
      require_cpu_binding(message.at("deviceBinding"));
      const auto evidence = probe_.run(4U);
      channel_.send_control({{"type", "probed"},
                             {"protocolVersion", 1},
                             {"requestId", *current_request_id_},
                             {"authorityId", authority_id},
                             {"deviceBinding", {{"kind", "cpu"}}}});
      return evidence.compute_digest == 0U ? 12 : 0;
    }
    if (device_authority_ == nullptr || device_authority_->authority_id != authority_id)
      throw CoreError(FailureCode::device_proof_failed, "accelerator probe authority mismatch");
    const auto ordinal = require_gpu_binding(message.at("deviceBinding"));
    const DeviceOperationAuthority authority{
        *device_authority_, require_challenge(message, "probeChallenge"),
        require_digest(message, "registryFingerprint"), ordinal};
    const auto evidence = engine_.probe_device(authority, cancellation_);
    channel_.send_control(
        {{"type", "probed"},
         {"protocolVersion", 1},
         {"requestId", *current_request_id_},
         {"authorityId", authority_id},
         {"deviceBinding", {{"kind", "gpuIndex"}, {"index", ordinal}}},
         {"activatedOrdinal", evidence.activated_ordinal},
         {"actualNativeIdentity", evidence.actual_native_identity},
         {"primaryExecutionNativeIdentity", evidence.primary_execution_native_identity},
         {"registryFingerprint", evidence.registry_fingerprint},
         {"probeProof", evidence.probe_proof}});
    return 0;
  }

  if (model_authority_ == nullptr)
    throw CoreError(FailureCode::model_authority_invalid, "load worker lacks model authority");
  const auto load = parse_load(channel_.read_control(), engine_.backend(), device_authority_);
  current_request_id_ = load.request_id;
  log(common::NativeLogEvent::model_load_started, {std::nullopt, *current_request_id_});
  if (load.authority_id != base64url(model_authority_->binding().operation_nonce))
    throw CoreError(FailureCode::model_authority_invalid, "model authority ID mismatch");
  require_not_cancelled();
  const auto started = clock_.now_ticks();
  const auto probe_evidence = probe_.run(load.cpu_threads);
  if (engine_.backend() != EngineBackend::cpu &&
      probe_evidence.resolved_threads != load.cpu_threads) {
    throw CoreError(FailureCode::invalid_settings, "GPU CPU thread topology changed before load");
  }
  ExactModelReader reader(model_authority_->source(),
                          model_authority_->binding().expected_artifact_bytes,
                          model_authority_->binding().artifact_content_sha256);
  engine_.load(reader, load.family, load.variant, load.device_authority, cancellation_);
  if (clock_.now_ticks() < started)
    throw CoreError(FailureCode::model_load_failed, "worker clock moved backwards");
  nlohmann::json loaded{
      {"type", "loaded"},
      {"protocolVersion", 1},
      {"requestId", load.request_id},
      {"authorityId", load.authority_id},
      {"deviceBinding", engine_.backend() == EngineBackend::cpu
                            ? nlohmann::json{{"kind", "cpu"}}
                            : nlohmann::json{{"kind", "gpuIndex"},
                                             {"index", load.device_authority->selected_ordinal}}},
      {"residency", load.residency},
      {"effectiveBackend", kRuntimeBackend},
      {"model", load.model},
      {"modelSha256", hex_digest(model_authority_->binding().artifact_content_sha256)},
      {"primaryStateOwnership", "worker"}};
  if (load.device_authority.has_value()) {
    const auto evidence = engine_.load_evidence(*load.device_authority);
    loaded["activatedOrdinal"] = evidence.activated_ordinal;
    loaded["actualNativeIdentity"] = evidence.actual_native_identity;
    loaded["primaryExecutionNativeIdentity"] = evidence.primary_execution_native_identity;
    loaded["registryFingerprint"] = evidence.registry_fingerprint;
    loaded["selectedDeviceModelWeightBytes"] = evidence.selected_device_model_weight_bytes;
    loaded["loadProof"] = evidence.load_proof;
  }
  log(common::NativeLogEvent::model_load_completed, {std::nullopt, *current_request_id_});
  channel_.send_control(loaded);

  bool warmed = false;
  std::optional<nlohmann::json> prefetched_control;
  while (true) {
    auto message =
        prefetched_control.has_value() ? std::move(*prefetched_control) : channel_.read_control();
    prefetched_control.reset();
    current_request_id_ = request_id(message);
    const auto type = require_string(message, "type", 32U);
    require_not_cancelled();
    if (type == "warmup") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "warmup");
      if (!engine_.loaded() || warmed)
        throw CoreError(FailureCode::invalid_settings,
                        "warm-up requires a loaded non-warmed worker");
      log(common::NativeLogEvent::state_warming, {std::nullopt, *current_request_id_});
      try {
        engine_.warm_up(probe_evidence.resolved_threads, cancellation_);
      } catch (const CoreError& error) {
        if (error.code() == FailureCode::cancelled)
          throw;
        throw CoreError(FailureCode::warmup_failed, "worker warm-up failed");
      } catch (...) {
        throw CoreError(FailureCode::warmup_failed, "worker warm-up failed");
      }
      warmed = true;
      channel_.send_control(
          {{"type", "warmed"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      log(common::NativeLogEvent::state_warmed, {std::nullopt, *current_request_id_});
      continue;
    }
    if (type == "transcribe") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId", "settingsEpoch",
                                   "audioByteLength", "options"});
      require_protocol(message, "transcribe");
      if (!engine_.loaded() || !warmed)
        throw CoreError(FailureCode::invalid_settings,
                        "transcription requires explicit successful warm-up");
      if (!message.at("settingsEpoch").is_number_unsigned() ||
          !message.at("audioByteLength").is_number_unsigned()) {
        throw CoreError(FailureCode::invalid_settings, "invalid transcription envelope");
      }
      const auto declared_bytes = message.at("audioByteLength").get<std::uint64_t>();
      if (declared_bytes > local_whisper::common::kCanonicalWavMaxTotalBytes)
        throw CoreError(FailureCode::audio_format_unsupported, "audio declaration exceeds limit");
      const auto options = parse_options(message.at("options"), probe_evidence.resolved_threads);
      log(common::NativeLogEvent::request_accepted, {std::nullopt, *current_request_id_});
      InferencePcmBuffer audio(
          [&]() -> PcmAudio {
            try {
              local_whisper::common::WavAccumulator accumulator(*current_request_id_,
                                                                declared_bytes);
              while (true) {
                auto chunk = channel_.read_audio();
                if (accumulator.append(chunk.request_id, chunk.sequence, chunk.final, chunk.bytes))
                  break;
              }
              SourceWavBuffer wav(accumulator.take(), audio_lifetime_observer_);
              return pcm_converter_.convert_canonical_wav(wav.bytes());
            } catch (const CoreError&) {
              throw;
            } catch (...) {
              throw CoreError(FailureCode::audio_format_unsupported, "invalid streamed audio");
            }
          }(),
          audio_lifetime_observer_);
      cancellation_.reset();
      InferenceTerminalArbiter terminal;
      InferenceOutcome inference_outcome;
      const auto transcription_request_id = *current_request_id_;
      std::jthread inference([&, transcription_request_id] {
        try {
          const auto text = engine_.transcribe(audio.samples(), options, cancellation_);
          cancellation_.checkpoint();
          inference_outcome.transcript = text;
          static_cast<void>(terminal.try_succeed());
        } catch (...) {
          inference_outcome.error = std::current_exception();
        }
        channel_.notify_inference_complete();
      });
      InferenceStopGuard inference_stop(inference, cancellation_);
      log(common::NativeLogEvent::inference_started, {std::nullopt, transcription_request_id});
      log(common::NativeLogEvent::state_busy);
      const auto wait_result = channel_.wait_for_control_or_inference();
      if (wait_result == WorkerChannelWaitResult::control_closed) {
        log(common::NativeLogEvent::control_eof,
            {common::NativeLogErrorCode::control_closed, transcription_request_id});
        cancellation_.request();
        inference.request_stop();
        inference.join();
        inference_stop.disarm();
        cancellation_.reset();
        throw CoreError(FailureCode::transcription_failed, "worker control channel closed");
      }
      if (wait_result == WorkerChannelWaitResult::inference_completed) {
        inference.join();
        inference_stop.disarm();
        cancellation_.reset();
        if (inference_outcome.error != nullptr)
          std::rethrow_exception(inference_outcome.error);
        if (terminal.state() != InferenceTerminal::succeeded ||
            !inference_outcome.transcript.has_value()) {
          throw CoreError(FailureCode::transcription_failed,
                          "inference completed without transcript");
        }
        channel_.send_control({{"type", "transcript"},
                               {"protocolVersion", 1},
                               {"requestId", transcription_request_id},
                               {"text", *inference_outcome.transcript}});
        log(common::NativeLogEvent::inference_completed, {std::nullopt, transcription_request_id});
        log(common::NativeLogEvent::request_completed, {std::nullopt, transcription_request_id});
        log(common::NativeLogEvent::state_warmed);
        continue;
      }

      auto cancel = channel_.read_control();
      require_exact_keys(cancel, {"type", "protocolVersion", "requestId", "targetRequestId"});
      require_protocol(cancel, "cancel");
      const auto cancel_request_id = request_id(cancel);
      if (require_string(cancel, "targetRequestId", 128U) != transcription_request_id) {
        cancellation_.request();
        inference.request_stop();
        static_cast<void>(terminal.cancel());
        inference.join();
        inference_stop.disarm();
        cancellation_.reset();
        throw CoreError(FailureCode::invalid_settings, "cancellation target mismatch");
      }
      const bool cancellation_won = terminal.cancel();
      if (cancellation_won) {
        cancellation_.request();
        inference.request_stop();
      }
      inference.join();
      inference_stop.disarm();
      cancellation_.reset();
      if (cancellation_won) {
        current_request_id_ = cancel_request_id;
        channel_.send_control({{"type", "cancelled"},
                               {"protocolVersion", 1},
                               {"requestId", *current_request_id_},
                               {"targetRequestId", transcription_request_id}});
        log(common::NativeLogEvent::request_cancelled, {std::nullopt, transcription_request_id});
        log(common::NativeLogEvent::state_warmed);
        continue;
      }
      if (inference_outcome.error != nullptr)
        std::rethrow_exception(inference_outcome.error);
      if (terminal.state() != InferenceTerminal::succeeded ||
          !inference_outcome.transcript.has_value()) {
        throw CoreError(FailureCode::transcription_failed,
                        "inference completed without terminal outcome");
      }
      channel_.send_control({{"type", "transcript"},
                             {"protocolVersion", 1},
                             {"requestId", transcription_request_id},
                             {"text", *inference_outcome.transcript}});
      log(common::NativeLogEvent::inference_completed, {std::nullopt, transcription_request_id});
      log(common::NativeLogEvent::request_completed, {std::nullopt, transcription_request_id});
      current_request_id_ = cancel_request_id;
      channel_.send_control({{"type", "cancelTooLate"},
                             {"protocolVersion", 1},
                             {"requestId", *current_request_id_},
                             {"targetRequestId", transcription_request_id}});
      log(common::NativeLogEvent::request_cancel_too_late,
          {std::nullopt, transcription_request_id});
      log(common::NativeLogEvent::state_warmed);
      continue;
    }
    if (type == "unload") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "unload");
      cleanup_engine();
      channel_.send_control(
          {{"type", "unloaded"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      continue;
    }
    if (type == "shutdown") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "shutdown");
      if (engine_.loaded())
        cleanup_engine();
      channel_.send_control(
          {{"type", "shutdownAck"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      log(common::NativeLogEvent::state_stopping);
      return 0;
    }
    throw CoreError(FailureCode::invalid_settings, "unsupported worker state transition");
  }
}

} // namespace local_whisper::whisper_cpp
