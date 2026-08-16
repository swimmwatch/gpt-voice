#include "local_whisper/whisper_cpp/worker_application.hpp"

#include "local_whisper/common/canonical_wav.hpp"
#include "local_whisper/common/native_logger.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "test_model_source.hpp"

#include <gtest/gtest.h>

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

using test_support::MemoryModelSource;

constexpr std::string_view kAuthorityId = "AAAAAAAAAAAAAAAAAAAAAA";
constexpr int kProtocolVersion = 2;

class FakeAuthority final : public ModelAuthorityView {
public:
  explicit FakeAuthority(std::vector<std::uint8_t> bytes) : source_(bytes) {
    binding_.expected_artifact_bytes = bytes.size();
    binding_.artifact_content_sha256 = local_whisper::common::sha256(bytes);
    binding_.artifact_kind = local_whisper::common::AuthorityArtifactKind::regular_file;
    binding_.expected_launcher_pid = 1U;
    binding_.expected_guard_pid = 1U;
  }

  [[nodiscard]] const local_whisper::common::AuthorityBinding& binding() const noexcept override {
    return binding_;
  }
  [[nodiscard]] RandomAccessModelSource& source() noexcept override { return source_; }

private:
  local_whisper::common::AuthorityBinding binding_{};
  MemoryModelSource source_;
};

class FakeChannel final : public WorkerChannel {
public:
  explicit FakeChannel(std::vector<std::string>* trace = nullptr) : trace_(trace) {}

  [[nodiscard]] nlohmann::json read_control() override {
    if (controls.empty())
      throw std::runtime_error("missing test control");
    auto value = std::move(controls.front());
    controls.pop_front();
    return value;
  }

  [[nodiscard]] WorkerAudioChunk read_audio() override {
    ++audio_reads;
    if (audio.empty())
      throw std::runtime_error("missing test audio");
    auto value = std::move(audio.front());
    audio.pop_front();
    return value;
  }

  [[nodiscard]] WorkerChannelWaitResult wait_for_control_or_inference() override {
    if (waits.empty())
      throw std::runtime_error("missing test wait result");
    const auto result = waits.front();
    waits.pop_front();
    if (result == WorkerChannelWaitResult::control_ready && wait_for_inference_before_control) {
      while (!inference_completion_notified.load(std::memory_order_acquire))
        std::this_thread::yield();
    }
    if (signal_on_wait != nullptr)
      signal_on_wait->store(true, std::memory_order_release);
    return result;
  }

  void notify_inference_complete() noexcept override {
    inference_completion_notified.store(true, std::memory_order_release);
    ++inference_completion_signals;
  }

  void send_control(const nlohmann::json& value) override {
    if (trace_ != nullptr)
      trace_->push_back("send:" + value.value("type", "missing"));
    sent.push_back(value);
    serialized.push_back(value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace));
  }

  std::deque<nlohmann::json> controls;
  std::deque<WorkerAudioChunk> audio;
  std::deque<WorkerChannelWaitResult> waits;
  std::vector<nlohmann::json> sent;
  std::vector<std::string> serialized;
  std::size_t audio_reads = 0U;
  std::atomic_bool inference_completion_notified = false;
  std::atomic_bool* signal_on_wait = nullptr;
  std::size_t inference_completion_signals = 0U;
  bool wait_for_inference_before_control = false;

private:
  std::vector<std::string>* trace_;
};

class FakePcmAudioConverter final : public PcmAudioConverter {
public:
  [[nodiscard]] PcmAudio convert_canonical_wav(std::span<const std::uint8_t> bytes) override {
    ++calls;
    if (fail_conversion)
      throw CoreError(FailureCode::allocation_failed, "fake PCM conversion failed");
    return PcmAudio::from_canonical_wav(bytes);
  }

  std::size_t calls = 0U;
  bool fail_conversion = false;
};

class RecordingAudioLifetimeObserver final : public WorkerAudioLifetimeObserver {
public:
  void source_wav_released(WavBufferReleaseEvidence evidence) noexcept override {
    const auto index = wav_release_count.load(std::memory_order_relaxed);
    if (index < wav_releases.size())
      wav_releases[index] = evidence;
    wav_release_count.store(index + 1U, std::memory_order_release);
  }

  void inference_pcm_released(std::size_t sample_count) noexcept override {
    const auto index = pcm_release_count.load(std::memory_order_relaxed);
    if (index < pcm_sample_counts.size())
      pcm_sample_counts[index] = sample_count;
    pcm_release_count.store(index + 1U, std::memory_order_release);
  }

  std::array<WavBufferReleaseEvidence, 4U> wav_releases{};
  std::array<std::size_t, 4U> pcm_sample_counts{};
  std::atomic_size_t wav_release_count = 0U;
  std::atomic_size_t pcm_release_count = 0U;
};

class FakeEngine final : public SpeechEngine {
public:
  explicit FakeEngine(std::vector<std::string>* trace = nullptr,
                      RecordingAudioLifetimeObserver* lifetime_observer = nullptr)
      : trace_(trace), lifetime_observer_(lifetime_observer) {}

  [[nodiscard]] EngineBackend backend() const noexcept override { return EngineBackend::cpu; }
  [[nodiscard]] DeviceProbeEvidence probe_device(const DeviceOperationAuthority&,
                                                 const CancellationToken&) override {
    throw std::logic_error("CPU fake cannot probe a GPU");
  }
  void load(const std::string& model_path, std::uint64_t expected_model_bytes,
            const std::optional<DeviceOperationAuthority>& authority,
            const CancellationToken&) override {
    EXPECT_EQ(model_path, "/managed/models/model.bin");
    EXPECT_EQ(expected_model_bytes, 4U);
    EXPECT_FALSE(authority.has_value());
    loaded_ = true;
    ++load_calls;
    if (trace_ != nullptr)
      trace_->push_back("engine:load");
  }

  void warm_up(std::uint32_t cpu_threads, const CancellationToken&) override {
    EXPECT_TRUE(loaded_);
    EXPECT_EQ(cpu_threads, 1U);
    ++warm_up_calls;
    if (trace_ != nullptr)
      trace_->push_back("engine:warmup");
    if (fail_warm_up)
      throw CoreError(FailureCode::warmup_failed, "fake warm-up failed");
  }

  [[nodiscard]] std::string transcribe(std::span<const float> samples,
                                       const TranscriptionOptions& options,
                                       const CancellationToken& cancellation) override {
    EXPECT_TRUE(loaded_);
    EXPECT_FALSE(samples.empty());
    EXPECT_EQ(options.language, "en");
    ++transcribe_calls;
    if (lifetime_observer_ != nullptr &&
        (lifetime_observer_->wav_release_count.load(std::memory_order_acquire) < transcribe_calls ||
         lifetime_observer_->pcm_release_count.load(std::memory_order_acquire) + 1U !=
             transcribe_calls)) {
      lifetime_order_valid.store(false, std::memory_order_release);
    }
    if (fail_transcription) {
      while (delay_failure && !release_delayed_failure.load(std::memory_order_acquire))
        std::this_thread::yield();
      throw CoreError(FailureCode::transcription_failed, "fake inference failed");
    }
    while (block_until_cancel && !cancellation.requested())
      std::this_thread::yield();
    if (cancellation.requested())
      throw CoreError(FailureCode::cancelled, "fake inference cancelled");
    if (transcripts.empty())
      return "test transcript";
    auto transcript = std::move(transcripts.front());
    transcripts.pop_front();
    return transcript;
  }

  void unload() noexcept override {
    loaded_ = false;
    ++unload_calls;
  }
  [[nodiscard]] bool loaded() const noexcept override { return loaded_; }
  [[nodiscard]] DeviceLoadEvidence load_evidence(const DeviceOperationAuthority&) const override {
    throw std::logic_error("CPU fake has no GPU load evidence");
  }

  std::size_t load_calls = 0U;
  std::size_t warm_up_calls = 0U;
  std::size_t transcribe_calls = 0U;
  std::size_t unload_calls = 0U;
  bool block_until_cancel = false;
  bool delay_failure = false;
  bool fail_transcription = false;
  bool fail_warm_up = false;
  std::atomic_bool release_delayed_failure = false;
  std::atomic_bool lifetime_order_valid = true;
  std::deque<std::string> transcripts;

private:
  std::vector<std::string>* trace_;
  RecordingAudioLifetimeObserver* lifetime_observer_;
  bool loaded_ = false;
};

class RecordingNativeLogger final : public common::NativeLogger {
public:
  explicit RecordingNativeLogger(std::vector<std::string>& trace) : trace_(trace) {}

  void emit(common::NativeLogComponent, common::NativeLogEvent event,
            common::NativeLogFields) noexcept override {
    trace_.emplace_back(common::native_log_event_name(event));
  }

  void shutdown() noexcept override {}

private:
  std::vector<std::string>& trace_;
};

class FakeClock final : public WorkerClock {
public:
  [[nodiscard]] std::uint64_t now_ticks() const noexcept override { return ticks_++; }

private:
  mutable std::uint64_t ticks_ = 1U;
};

void write_u16(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint16_t value) {
  bytes[offset] = static_cast<std::uint8_t>(value);
  bytes[offset + 1U] = static_cast<std::uint8_t>(value >> 8U);
}

void write_u32(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint32_t value) {
  for (std::size_t index = 0; index < 4U; ++index)
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
}

std::vector<std::uint8_t> wav_fixture(std::size_t sample_count = 1U) {
  std::vector<std::uint8_t> bytes(local_whisper::common::kCanonicalWavHeaderBytes +
                                  sample_count * 2U);
  for (const auto& [offset, text] : {std::pair<std::size_t, const char*>(0U, "RIFF"),
                                     {8U, "WAVE"},
                                     {12U, "fmt "},
                                     {36U, "data"}}) {
    for (std::size_t index = 0; index < 4U; ++index)
      bytes[offset + index] = static_cast<std::uint8_t>(text[index]);
  }
  write_u32(bytes, 4U, static_cast<std::uint32_t>(bytes.size() - 8U));
  write_u32(bytes, 16U, 16U);
  write_u16(bytes, 20U, 1U);
  write_u16(bytes, 22U, 1U);
  write_u32(bytes, 24U, 16'000U);
  write_u32(bytes, 28U, 32'000U);
  write_u16(bytes, 32U, 2U);
  write_u16(bytes, 34U, 16U);
  write_u32(bytes, 40U, static_cast<std::uint32_t>(sample_count * 2U));
  write_u16(bytes, 44U, 1U);
  return bytes;
}

nlohmann::json hello() { return {{"type", "hello"}, {"protocolVersion", kProtocolVersion}}; }

nlohmann::json load_message() {
  return {
      {"type", "load"},
      {"protocolVersion", kProtocolVersion},
      {"requestId", "load-test"},
      {"authorityId", kAuthorityId},
      {"deviceBinding", {{"kind", "cpu"}}},
      {"modelPath", "/managed/models/model.bin"},
      {"expectedModelBytes", 4U},
      {"residency",
       {{"engine", "whisperCpp"},
        {"runtimePackRevision", LOCAL_WHISPER_RUNTIME_REVISION},
        {"target", "cpu"},
        {"backend", "cpu"},
        {"deviceId", nullptr},
        {"model",
         {{"engine", "whisperCpp"},
          {"logicalModel", "tiny"},
          {"sourceCheckpointRevision", "test-source"},
          {"artifactRevision", "test-artifact"},
          {"nativeFormat", "ggml"},
          {"variant", "full"}}},
        {"configuredGpuCpuThreads", nullptr},
        {"resolvedCpuThreads", 1U},
        {"logicalProcessorTopologyGeneration", 3U},
        {"configurationEpoch", 7U}}},
  };
}

nlohmann::json warmup_message() {
  return {{"type", "warmup"}, {"protocolVersion", kProtocolVersion}, {"requestId", "warm-test"}};
}

nlohmann::json transcribe_message(std::size_t audio_bytes, std::string request_id = "tx-test") {
  return {{"type", "transcribe"},
          {"protocolVersion", kProtocolVersion},
          {"requestId", std::move(request_id)},
          {"settingsEpoch", 1U},
          {"audioByteLength", audio_bytes},
          {"options",
           {{"language", "en"},
            {"initialPrompt", ""},
            {"temperatureHundredths", 0U},
            {"strategy", "greedy"},
            {"candidateCount", nullptr}}}};
}

struct Fixture final {
  Fixture()
      : channel(&trace), engine(&trace, &audio_lifetime), authority({1U, 2U, 3U, 4U}),
        logger(trace) {}

  [[nodiscard]] int run() {
    CpuProbe probe;
    WorkerApplication application(WorkerRunMode::load, channel, engine, pcm_converter, probe, clock,
                                  cancellation, &authority, nullptr, &logger, &audio_lifetime);
    return application.run();
  }

  std::vector<std::string> trace;
  FakeChannel channel;
  RecordingAudioLifetimeObserver audio_lifetime;
  FakeEngine engine;
  FakePcmAudioConverter pcm_converter;
  FakeClock clock;
  CancellationController cancellation;
  FakeAuthority authority;
  RecordingNativeLogger logger;
};

std::size_t trace_index(const std::vector<std::string>& trace, std::string_view value) {
  for (std::size_t index = 0; index < trace.size(); ++index) {
    if (trace[index] == value)
      return index;
  }
  ADD_FAILURE() << "missing trace entry: " << value;
  return trace.size();
}

bool trace_contains(const std::vector<std::string>& trace, std::string_view value) {
  for (const auto& entry : trace) {
    if (entry == value)
      return true;
  }
  return false;
}

TEST(WorkerApplication, RejectsInconsistentResidencyThreadIdentityBeforeModelLoad) {
  Fixture fixture;
  auto invalid_load = load_message();
  invalid_load["residency"]["configuredGpuCpuThreads"] = "auto";
  fixture.channel.controls = {hello(), std::move(invalid_load)};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.load_calls, 0U);
  ASSERT_FALSE(fixture.channel.sent.empty());
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, RunsLoadWarmupTranscriptionUnloadAndShutdownStateMachine) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(wav.size()),
      {{"type", "unload"}, {"protocolVersion", kProtocolVersion}, {"requestId", "unload-test"}},
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  EXPECT_EQ(fixture.engine.load_calls, 1U);
  EXPECT_EQ(fixture.engine.warm_up_calls, 1U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 6U);
  EXPECT_EQ(fixture.channel.sent[0].at("type"), "helloAck");
  EXPECT_EQ(fixture.channel.sent[1].at("type"), "loaded");
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "warmed");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[3].at("text"), "test transcript");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "unloaded");
  EXPECT_EQ(fixture.channel.sent[5].at("type"), "shutdownAck");
  EXPECT_EQ(fixture.channel.sent[5].at("requestId"), "shutdown-test");
  EXPECT_EQ(common::kNativeRuntimeLogSchemaVersion, 1U);
  EXPECT_EQ(fixture.channel.sent[1].at("protocolVersion"), kProtocolVersion);
  EXPECT_EQ(fixture.channel.sent[2].at("protocolVersion"), kProtocolVersion);
  const auto loaded = trace_index(fixture.trace, "send:loaded");
  const auto model_load_completed = trace_index(fixture.trace, "modelLoadCompleted");
  const auto state_warming = trace_index(fixture.trace, "stateWarming");
  const auto warmup = trace_index(fixture.trace, "engine:warmup");
  const auto warmed = trace_index(fixture.trace, "send:warmed");
  const auto state_warmed = trace_index(fixture.trace, "stateWarmed");
  EXPECT_LT(loaded, state_warming);
  EXPECT_LT(model_load_completed, state_warming);
  EXPECT_LT(state_warming, warmup);
  EXPECT_LT(warmup, warmed);
  EXPECT_LT(warmed, state_warmed);
  EXPECT_EQ(fixture.audio_lifetime.wav_release_count.load(std::memory_order_acquire), 1U);
  EXPECT_EQ(fixture.audio_lifetime.pcm_release_count.load(std::memory_order_acquire), 1U);
  EXPECT_TRUE(fixture.engine.lifetime_order_valid.load(std::memory_order_acquire));
}

TEST(WorkerApplication, ReleasesMaximumWavStorageBeforeInferenceAndPcmBeforeNextRequest) {
  Fixture fixture;
  auto maximum_wav = wav_fixture(local_whisper::common::kCanonicalWavMaxSamples);
  const auto maximum_wav_bytes = maximum_wav.size();
  auto second_wav = wav_fixture();
  const auto second_wav_bytes = second_wav.size();
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(maximum_wav_bytes, "tx-maximum"),
      transcribe_message(second_wav_bytes, "tx-second"),
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio = {{"tx-maximum", 0U, true, std::move(maximum_wav)},
                           {"tx-second", 0U, true, std::move(second_wav)}};
  fixture.channel.waits = {WorkerChannelWaitResult::inference_completed,
                           WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  EXPECT_EQ(fixture.pcm_converter.calls, 2U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 2U);
  EXPECT_TRUE(fixture.engine.lifetime_order_valid.load(std::memory_order_acquire));
  ASSERT_EQ(fixture.audio_lifetime.wav_release_count.load(std::memory_order_acquire), 2U);
  ASSERT_EQ(fixture.audio_lifetime.pcm_release_count.load(std::memory_order_acquire), 2U);
  const auto maximum_release = fixture.audio_lifetime.wav_releases[0];
  EXPECT_EQ(maximum_release.byte_length, maximum_wav_bytes);
  EXPECT_GE(maximum_release.capacity_before_release, maximum_wav_bytes);
  EXPECT_EQ(maximum_release.capacity_after_release, 0U);
  const auto second_release = fixture.audio_lifetime.wav_releases[1];
  EXPECT_EQ(second_release.byte_length, second_wav_bytes);
  EXPECT_GE(second_release.capacity_before_release, second_wav_bytes);
  EXPECT_EQ(second_release.capacity_after_release, 0U);
  EXPECT_EQ(fixture.audio_lifetime.pcm_sample_counts[0],
            local_whisper::common::kCanonicalWavMaxSamples);
  EXPECT_EQ(fixture.audio_lifetime.pcm_sample_counts[1], 1U);
}

TEST(WorkerApplication, ReleasesWavStorageWhenPcmConversionFailsBeforeCleanRetry) {
  Fixture failed;
  failed.pcm_converter.fail_conversion = true;
  auto failed_wav = wav_fixture();
  const auto failed_wav_bytes = failed_wav.size();
  failed.channel.controls = {hello(), load_message(), warmup_message(),
                             transcribe_message(failed_wav_bytes)};
  failed.channel.audio.push_back({"tx-test", 0U, true, std::move(failed_wav)});

  EXPECT_EQ(failed.run(), 10);
  EXPECT_EQ(failed.pcm_converter.calls, 1U);
  EXPECT_EQ(failed.engine.transcribe_calls, 0U);
  EXPECT_EQ(failed.engine.unload_calls, 1U);
  ASSERT_EQ(failed.audio_lifetime.wav_release_count.load(std::memory_order_acquire), 1U);
  EXPECT_EQ(failed.audio_lifetime.pcm_release_count.load(std::memory_order_acquire), 0U);
  EXPECT_EQ(failed.audio_lifetime.wav_releases[0].byte_length, failed_wav_bytes);
  EXPECT_GE(failed.audio_lifetime.wav_releases[0].capacity_before_release, failed_wav_bytes);
  EXPECT_EQ(failed.audio_lifetime.wav_releases[0].capacity_after_release, 0U);
  ASSERT_FALSE(failed.channel.sent.empty());
  EXPECT_EQ(failed.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(failed.channel.sent.back().at("code"), "ALLOCATION_FAILED");

  Fixture retry;
  const auto retry_wav = wav_fixture();
  retry.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(retry_wav.size()),
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  retry.channel.audio.push_back({"tx-test", 0U, true, retry_wav});
  retry.channel.waits = {WorkerChannelWaitResult::inference_completed};
  EXPECT_EQ(retry.run(), 0);
  EXPECT_EQ(retry.engine.transcribe_calls, 1U);
  EXPECT_TRUE(retry.engine.lifetime_order_valid.load(std::memory_order_acquire));
}

TEST(WorkerApplication, RejectsTranscriptionBeforeExplicitWarmup) {
  Fixture fixture;
  fixture.channel.controls = {hello(), load_message(), transcribe_message(wav_fixture().size())};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.load_calls, 1U);
  EXPECT_EQ(fixture.engine.warm_up_calls, 0U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 0U);
  EXPECT_EQ(fixture.channel.audio_reads, 0U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 3U);
  EXPECT_EQ(fixture.channel.sent[1].at("type"), "loaded");
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent[2].at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, RejectsDuplicateWarmupAfterOneSuccessfulTransition) {
  Fixture fixture;
  fixture.channel.controls = {hello(), load_message(), warmup_message(), warmup_message()};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.warm_up_calls, 1U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 4U);
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "warmed");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent[3].at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, WarmupFailureUnloadsAndReturnsTypedFailureBeforeCleanRetry) {
  Fixture failed;
  failed.engine.fail_warm_up = true;
  failed.channel.controls = {hello(), load_message(), warmup_message()};

  EXPECT_EQ(failed.run(), 10);
  EXPECT_EQ(failed.engine.load_calls, 1U);
  EXPECT_EQ(failed.engine.warm_up_calls, 1U);
  EXPECT_EQ(failed.engine.unload_calls, 1U);
  ASSERT_EQ(failed.channel.sent.size(), 3U);
  EXPECT_EQ(failed.channel.sent[2].at("type"), "failure");
  EXPECT_EQ(failed.channel.sent[2].at("code"), "WARMUP_FAILED");
  EXPECT_FALSE(trace_contains(failed.trace, "stateWarmed"));

  Fixture retry;
  retry.channel.controls = {hello(),
                            load_message(),
                            warmup_message(),
                            {{"type", "shutdown"},
                             {"protocolVersion", kProtocolVersion},
                             {"requestId", "shutdown-test"}}};
  EXPECT_EQ(retry.run(), 0);
  EXPECT_EQ(retry.engine.warm_up_calls, 1U);
  EXPECT_EQ(retry.channel.sent[2].at("type"), "warmed");
}

TEST(WorkerApplication, RejectsMalformedSettingsBeforeReadingAudioOrInference) {
  Fixture fixture;
  auto malformed = transcribe_message(wav_fixture().size());
  malformed["options"]["temperatureHundredths"] = 5U;
  fixture.channel.controls = {hello(), load_message(), warmup_message(), std::move(malformed)};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.channel.audio_reads, 0U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 0U);
  ASSERT_FALSE(fixture.channel.sent.empty());
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, RejectsMalformedAudioBeforeInference) {
  Fixture fixture;
  fixture.channel.controls = {hello(), load_message(), warmup_message(), transcribe_message(1U)};
  fixture.channel.audio.push_back({"tx-test", 0U, true, {0U}});

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.transcribe_calls, 0U);
  ASSERT_FALSE(fixture.channel.sent.empty());
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "AUDIO_FORMAT_UNSUPPORTED");
}

TEST(WorkerApplication, CooperativeCancellationEmitsNoTranscriptOrLateSuccess) {
  Fixture fixture;
  fixture.engine.block_until_cancel = true;
  const auto wav = wav_fixture();
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(wav.size()),
      {{"type", "cancel"},
       {"protocolVersion", kProtocolVersion},
       {"requestId", "cancel-test"},
       {"targetRequestId", "tx-test"}},
      {{"type", "unload"}, {"protocolVersion", kProtocolVersion}, {"requestId", "unload-test"}},
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 6U);
  EXPECT_EQ(fixture.channel.sent[0].at("type"), "helloAck");
  EXPECT_EQ(fixture.channel.sent[1].at("type"), "loaded");
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "warmed");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "cancelled");
  EXPECT_EQ(fixture.channel.sent[3].at("targetRequestId"), "tx-test");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "unloaded");
  EXPECT_EQ(fixture.channel.sent[5].at("type"), "shutdownAck");
  EXPECT_EQ(fixture.audio_lifetime.wav_release_count.load(std::memory_order_acquire), 1U);
  EXPECT_EQ(fixture.audio_lifetime.pcm_release_count.load(std::memory_order_acquire), 1U);
  EXPECT_TRUE(fixture.engine.lifetime_order_valid.load(std::memory_order_acquire));
}

TEST(WorkerApplication, TranscriptCommitBeforeCancellationEmitsTranscriptAndCancelTooLate) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.channel.wait_for_inference_before_control = true;
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(wav.size(), "tx-first"),
      {{"type", "cancel"},
       {"protocolVersion", kProtocolVersion},
       {"requestId", "cancel-first"},
       {"targetRequestId", "tx-first"}},
      transcribe_message(wav.size(), "tx-second"),
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio = {{"tx-first", 0U, true, wav}, {"tx-second", 0U, true, wav}};
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready,
                           WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 7U);
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[3].at("requestId"), "tx-first");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "cancelTooLate");
  EXPECT_EQ(fixture.channel.sent[4].size(), 4U);
  EXPECT_EQ(fixture.channel.sent[4].at("requestId"), "cancel-first");
  EXPECT_EQ(fixture.channel.sent[4].at("targetRequestId"), "tx-first");
  EXPECT_EQ(fixture.channel.sent[5].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[5].at("requestId"), "tx-second");
  EXPECT_EQ(fixture.engine.transcribe_calls, 2U);
  EXPECT_EQ(fixture.channel.inference_completion_signals, 2U);
}

TEST(WorkerApplication, InvalidCancellationStopsAndJoinsBlockedInference) {
  Fixture fixture;
  fixture.engine.block_until_cancel = true;
  const auto wav = wav_fixture();
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(wav.size()),
      {{"type", "cancel"}, {"protocolVersion", kProtocolVersion}, {"requestId", "cancel-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_TRUE(fixture.cancellation.requested());
  ASSERT_EQ(fixture.channel.sent.size(), 4U);
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, ControlClosureStopsAndJoinsBlockedInference) {
  Fixture fixture;
  fixture.engine.block_until_cancel = true;
  const auto wav = wav_fixture();
  fixture.channel.controls = {hello(), load_message(), warmup_message(),
                              transcribe_message(wav.size())};
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_closed};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 4U);
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "TRANSCRIPTION_FAILED");
  EXPECT_FALSE(fixture.cancellation.requested());
}

TEST(WorkerApplication,
     ImmediateAndDelayedInferenceFailuresEmitTypedFailureWithoutAnotherControlFrame) {
  for (const bool delayed : {false, true}) {
    Fixture fixture;
    fixture.engine.delay_failure = delayed;
    fixture.engine.fail_transcription = true;
    fixture.channel.signal_on_wait = delayed ? &fixture.engine.release_delayed_failure : nullptr;
    const auto wav = wav_fixture();
    fixture.channel.controls = {hello(), load_message(), warmup_message(),
                                transcribe_message(wav.size())};
    fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
    fixture.channel.waits = {WorkerChannelWaitResult::inference_completed};

    EXPECT_EQ(fixture.run(), 10) << (delayed ? "delayed" : "immediate");
    ASSERT_EQ(fixture.channel.sent.size(), 4U) << (delayed ? "delayed" : "immediate");
    EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
    EXPECT_EQ(fixture.channel.sent.back().at("code"), "TRANSCRIPTION_FAILED");
    EXPECT_EQ(fixture.audio_lifetime.wav_release_count.load(std::memory_order_acquire), 1U);
    EXPECT_EQ(fixture.audio_lifetime.pcm_release_count.load(std::memory_order_acquire), 1U);
    EXPECT_TRUE(fixture.engine.lifetime_order_valid.load(std::memory_order_acquire));
  }
}

TEST(WorkerApplication, ReplacesMalformedCommittedTranscriptTextAndKeepsWorkerWarmed) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.engine.transcripts = {std::string{"split "} + std::string{"\xe2\x82"},
                                "second transcript"};
  fixture.channel.controls = {
      hello(),
      load_message(),
      warmup_message(),
      transcribe_message(wav.size(), "tx-split"),
      transcribe_message(wav.size(), "tx-second"),
      {{"type", "shutdown"}, {"protocolVersion", kProtocolVersion}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio = {{"tx-split", 0U, true, wav}, {"tx-second", 0U, true, wav}};
  fixture.channel.waits = {WorkerChannelWaitResult::inference_completed,
                           WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 6U);
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "transcript");
  EXPECT_NE(fixture.channel.serialized[3].find("\xef\xbf\xbd"), std::string::npos);
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[4].at("text"), "second transcript");
  EXPECT_EQ(fixture.engine.transcribe_calls, 2U);
}

} // namespace
} // namespace local_whisper::whisper_cpp
