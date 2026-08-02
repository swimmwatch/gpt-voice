#include "local_whisper/whisper_cpp/worker_application.hpp"

#include "local_whisper/common/canonical_wav.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/exact_model_reader.hpp"
#include "local_whisper/whisper_cpp/pcm_audio.hpp"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <array>
#include <chrono>
#include <cstddef>
#include <cstdint>
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

std::string protocol_failure(FailureCode code) {
  switch (code) {
  case FailureCode::model_corrupt:
    return "MODEL_CORRUPT";
  case FailureCode::model_load_failed:
    return "MODEL_LOAD_FAILED";
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
  }
  return "TRANSCRIPTION_FAILED";
}

void require_cpu_binding(const nlohmann::json& value) {
  if (!value.is_object() || value.size() != 1U || value.value("kind", "") != "cpu")
    throw CoreError(FailureCode::invalid_settings, "CPU worker received non-CPU binding");
}

struct LoadContract final {
  std::string authority_id;
  std::string request_id;
  std::string family;
  std::string variant;
  std::uint32_t cpu_threads;
  nlohmann::json residency;
  nlohmann::json model;
};

LoadContract parse_load(const nlohmann::json& value) {
  require_exact_keys(
      value, {"type", "protocolVersion", "requestId", "authorityId", "deviceBinding", "residency"});
  require_protocol(value, "load");
  require_cpu_binding(value.at("deviceBinding"));
  auto residency = value.at("residency");
  require_exact_keys(residency, {"engine", "runtimePackRevision", "target", "backend", "deviceId",
                                 "model", "precision", "resolvedCpuThreads"});
  if (residency.value("engine", "") != "whisperCpp" || residency.value("target", "") != "cpu" ||
      residency.value("backend", "") != "cpu" || !residency.at("deviceId").is_null() ||
      !residency.at("precision").is_null() ||
      residency.value("runtimePackRevision", "") != kRuntimeRevision ||
      !residency.at("resolvedCpuThreads").is_number_unsigned()) {
    throw CoreError(FailureCode::invalid_settings, "invalid CPU residency");
  }
  const auto threads = residency.at("resolvedCpuThreads").get<std::uint64_t>();
  if (threads == 0U || threads > 256U)
    throw CoreError(FailureCode::invalid_settings, "invalid CPU thread count");
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
  return {require_string(value, "authorityId", 22U), request_id(value),    family,          variant,
          static_cast<std::uint32_t>(threads),       std::move(residency), std::move(model)};
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
bool ProcessCancellation::requested() const noexcept { return false; }

WorkerApplication::WorkerApplication(WorkerRunMode mode, WorkerChannel& channel,
                                     SpeechEngine& engine, CpuProbe& probe, WorkerClock& clock,
                                     WorkerCancellation& cancellation,
                                     ModelAuthorityView* authority)
    : mode_(mode), channel_(channel), engine_(engine), probe_(probe), clock_(clock),
      cancellation_(cancellation), authority_(authority) {}

void WorkerApplication::require_not_cancelled() const {
  if (cancellation_.requested())
    throw CoreError(FailureCode::cancelled, "worker operation cancelled");
}

int WorkerApplication::run() noexcept {
  try {
    return run_checked();
  } catch (const CoreError& error) {
    engine_.unload();
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
    engine_.unload();
    return 11;
  }
}

int WorkerApplication::run_checked() {
  const auto hello = channel_.read_control();
  require_exact_keys(hello, {"type", "protocolVersion"});
  require_protocol(hello, "hello");
  channel_.send_control({{"type", "helloAck"},
                         {"protocolVersion", 1},
                         {"engine", "whisperCpp"},
                         {"runtimeRevision", kRuntimeRevision},
                         {"runtimeBuildDigest", LOCAL_WHISPER_RUNTIME_BUILD_DIGEST},
                         {"backend", "cpu"},
                         {"capabilities", {"cpu-baseline", "exact-model-authority"}},
                         {"maxControlFrameBytes", 1'048'576},
                         {"maxAudioChunkBytes", 1'048'576}});

  if (mode_ == WorkerRunMode::probe) {
    const auto message = channel_.read_control();
    require_exact_keys(message,
                       {"type", "protocolVersion", "requestId", "authorityId", "deviceBinding"});
    require_protocol(message, "probe");
    require_cpu_binding(message.at("deviceBinding"));
    current_request_id_ = request_id(message);
    require_not_cancelled();
    const auto evidence = probe_.run(4U);
    channel_.send_control({{"type", "probed"},
                           {"protocolVersion", 1},
                           {"requestId", *current_request_id_},
                           {"authorityId", require_string(message, "authorityId", 22U)},
                           {"deviceBinding", {{"kind", "cpu"}}}});
    return evidence.compute_digest == 0U ? 12 : 0;
  }

  if (authority_ == nullptr)
    throw CoreError(FailureCode::model_authority_invalid, "load worker lacks model authority");
  const auto load = parse_load(channel_.read_control());
  current_request_id_ = load.request_id;
  if (load.authority_id != base64url(authority_->binding().operation_nonce))
    throw CoreError(FailureCode::model_authority_invalid, "model authority ID mismatch");
  require_not_cancelled();
  const auto started = clock_.now_ticks();
  const auto probe_evidence = probe_.run(load.cpu_threads);
  ExactModelReader reader(authority_->source(), authority_->binding().expected_artifact_bytes,
                          authority_->binding().artifact_content_sha256);
  engine_.load(reader, load.family, load.variant);
  engine_.warm_up(probe_evidence.resolved_threads);
  if (clock_.now_ticks() < started)
    throw CoreError(FailureCode::model_load_failed, "worker clock moved backwards");
  channel_.send_control({{"type", "loaded"},
                         {"protocolVersion", 1},
                         {"requestId", load.request_id},
                         {"authorityId", load.authority_id},
                         {"deviceBinding", {{"kind", "cpu"}}},
                         {"residency", load.residency},
                         {"effectiveBackend", "cpu"},
                         {"effectivePrecision", nullptr},
                         {"model", load.model},
                         {"modelSha256", hex_digest(authority_->binding().artifact_content_sha256)},
                         {"primaryStateOwnership", "worker"}});

  while (true) {
    const auto message = channel_.read_control();
    current_request_id_ = request_id(message);
    const auto type = require_string(message, "type", 32U);
    require_not_cancelled();
    if (type == "warmup") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "warmup");
      if (!engine_.loaded())
        throw CoreError(FailureCode::model_load_failed, "warm-up requires loaded worker");
      channel_.send_control(
          {{"type", "warmed"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      continue;
    }
    if (type == "transcribe") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId", "settingsEpoch",
                                   "audioByteLength", "options"});
      require_protocol(message, "transcribe");
      if (!message.at("settingsEpoch").is_number_unsigned() ||
          !message.at("audioByteLength").is_number_unsigned()) {
        throw CoreError(FailureCode::invalid_settings, "invalid transcription envelope");
      }
      const auto declared_bytes = message.at("audioByteLength").get<std::uint64_t>();
      if (declared_bytes > local_whisper::common::kCanonicalWavMaxTotalBytes)
        throw CoreError(FailureCode::audio_format_unsupported, "audio declaration exceeds limit");
      const auto options = parse_options(message.at("options"), probe_evidence.resolved_threads);
      std::vector<std::uint8_t> wav;
      try {
        local_whisper::common::WavAccumulator accumulator(*current_request_id_, declared_bytes);
        while (true) {
          auto chunk = channel_.read_audio();
          if (accumulator.append(chunk.request_id, chunk.sequence, chunk.final, chunk.bytes))
            break;
        }
        wav = accumulator.take();
      } catch (const CoreError&) {
        throw;
      } catch (...) {
        throw CoreError(FailureCode::audio_format_unsupported, "invalid streamed audio");
      }
      const auto audio = PcmAudio::from_canonical_wav(wav);
      const auto text = engine_.transcribe(audio.samples(), options);
      channel_.send_control({{"type", "transcript"},
                             {"protocolVersion", 1},
                             {"requestId", *current_request_id_},
                             {"text", text}});
      continue;
    }
    if (type == "unload") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "unload");
      engine_.unload();
      channel_.send_control(
          {{"type", "unloaded"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      return 0;
    }
    if (type == "shutdown") {
      require_exact_keys(message, {"type", "protocolVersion", "requestId"});
      require_protocol(message, "shutdown");
      engine_.unload();
      channel_.send_control(
          {{"type", "shutdownAck"}, {"protocolVersion", 1}, {"requestId", *current_request_id_}});
      return 0;
    }
    throw CoreError(FailureCode::invalid_settings, "unsupported worker state transition");
  }
}

} // namespace local_whisper::whisper_cpp
