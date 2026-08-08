#include "local_whisper/whisper_cpp/worker_application.hpp"

#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "test_model_source.hpp"

#include <gtest/gtest.h>

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
};

class FakeEngine final : public SpeechEngine {
public:
  [[nodiscard]] EngineBackend backend() const noexcept override { return EngineBackend::cpu; }
  [[nodiscard]] DeviceProbeEvidence probe_device(const DeviceOperationAuthority&,
                                                 const CancellationToken&) override {
    throw std::logic_error("CPU fake cannot probe a GPU");
  }
  void load(ExactModelReader& reader, const std::string& family, const std::string& variant,
            const std::optional<DeviceOperationAuthority>& authority,
            const CancellationToken&) override {
    EXPECT_EQ(family, "tiny");
    EXPECT_EQ(variant, "full");
    EXPECT_FALSE(authority.has_value());
    reader.skip_exact(reader.expected_bytes());
    reader.verify_complete();
    reader.close();
    loaded_ = true;
    ++load_calls;
  }

  void warm_up(std::uint32_t cpu_threads, const CancellationToken&) override {
    EXPECT_TRUE(loaded_);
    EXPECT_EQ(cpu_threads, 1U);
    ++warm_up_calls;
  }

  [[nodiscard]] std::string transcribe(std::span<const float> samples,
                                       const TranscriptionOptions& options,
                                       const CancellationToken& cancellation) override {
    EXPECT_TRUE(loaded_);
    EXPECT_FALSE(samples.empty());
    EXPECT_EQ(options.language, "en");
    ++transcribe_calls;
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
  std::atomic_bool release_delayed_failure = false;
  std::deque<std::string> transcripts;

private:
  bool loaded_ = false;
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

std::vector<std::uint8_t> wav_fixture() {
  std::vector<std::uint8_t> bytes(46U);
  for (const auto& [offset, text] : {std::pair<std::size_t, const char*>(0U, "RIFF"),
                                     {8U, "WAVE"},
                                     {12U, "fmt "},
                                     {36U, "data"}}) {
    for (std::size_t index = 0; index < 4U; ++index)
      bytes[offset + index] = static_cast<std::uint8_t>(text[index]);
  }
  write_u32(bytes, 4U, 38U);
  write_u32(bytes, 16U, 16U);
  write_u16(bytes, 20U, 1U);
  write_u16(bytes, 22U, 1U);
  write_u32(bytes, 24U, 16'000U);
  write_u32(bytes, 28U, 32'000U);
  write_u16(bytes, 32U, 2U);
  write_u16(bytes, 34U, 16U);
  write_u32(bytes, 40U, 2U);
  write_u16(bytes, 44U, 1U);
  return bytes;
}

nlohmann::json hello() { return {{"type", "hello"}, {"protocolVersion", 1}}; }

nlohmann::json load_message() {
  return {
      {"type", "load"},
      {"protocolVersion", 1},
      {"requestId", "load-test"},
      {"authorityId", kAuthorityId},
      {"deviceBinding", {{"kind", "cpu"}}},
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
        {"resolvedCpuThreads", 1U}}},
  };
}

nlohmann::json transcribe_message(std::size_t audio_bytes, std::string request_id = "tx-test") {
  return {{"type", "transcribe"},
          {"protocolVersion", 1},
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
  Fixture() : authority({1U, 2U, 3U, 4U}) {}

  [[nodiscard]] int run() {
    CpuProbe probe;
    WorkerApplication application(WorkerRunMode::load, channel, engine, probe, clock, cancellation,
                                  &authority, nullptr);
    return application.run();
  }

  FakeChannel channel;
  FakeEngine engine;
  FakeClock clock;
  CancellationController cancellation;
  FakeAuthority authority;
};

TEST(WorkerApplication, RunsLoadWarmupTranscriptionUnloadAndShutdownStateMachine) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.channel.controls = {
      hello(),
      load_message(),
      {{"type", "warmup"}, {"protocolVersion", 1}, {"requestId", "warm-test"}},
      transcribe_message(wav.size()),
      {{"type", "unload"}, {"protocolVersion", 1}, {"requestId", "unload-test"}},
      {{"type", "shutdown"}, {"protocolVersion", 1}, {"requestId", "shutdown-test"}},
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
}

TEST(WorkerApplication, RejectsMalformedSettingsBeforeReadingAudioOrInference) {
  Fixture fixture;
  auto malformed = transcribe_message(wav_fixture().size());
  malformed["options"]["temperatureHundredths"] = 5U;
  fixture.channel.controls = {hello(), load_message(), std::move(malformed)};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.channel.audio_reads, 0U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 0U);
  ASSERT_FALSE(fixture.channel.sent.empty());
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, RejectsMalformedAudioBeforeInference) {
  Fixture fixture;
  fixture.channel.controls = {hello(), load_message(), transcribe_message(1U)};
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
      transcribe_message(wav.size()),
      {{"type", "cancel"},
       {"protocolVersion", 1},
       {"requestId", "cancel-test"},
       {"targetRequestId", "tx-test"}},
      {{"type", "unload"}, {"protocolVersion", 1}, {"requestId", "unload-test"}},
      {{"type", "shutdown"}, {"protocolVersion", 1}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 5U);
  EXPECT_EQ(fixture.channel.sent[0].at("type"), "helloAck");
  EXPECT_EQ(fixture.channel.sent[1].at("type"), "loaded");
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "cancelled");
  EXPECT_EQ(fixture.channel.sent[2].at("targetRequestId"), "tx-test");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "unloaded");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "shutdownAck");
}

TEST(WorkerApplication, TranscriptCommitBeforeCancellationEmitsTranscriptAndCancelTooLate) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.channel.wait_for_inference_before_control = true;
  fixture.channel.controls = {
      hello(),
      load_message(),
      transcribe_message(wav.size(), "tx-first"),
      {{"type", "cancel"},
       {"protocolVersion", 1},
       {"requestId", "cancel-first"},
       {"targetRequestId", "tx-first"}},
      transcribe_message(wav.size(), "tx-second"),
      {{"type", "shutdown"}, {"protocolVersion", 1}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio = {{"tx-first", 0U, true, wav}, {"tx-second", 0U, true, wav}};
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready,
                           WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 6U);
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[2].at("requestId"), "tx-first");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "cancelTooLate");
  EXPECT_EQ(fixture.channel.sent[3].size(), 4U);
  EXPECT_EQ(fixture.channel.sent[3].at("requestId"), "cancel-first");
  EXPECT_EQ(fixture.channel.sent[3].at("targetRequestId"), "tx-first");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[4].at("requestId"), "tx-second");
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
      transcribe_message(wav.size()),
      {{"type", "cancel"}, {"protocolVersion", 1}, {"requestId", "cancel-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_ready};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_TRUE(fixture.cancellation.requested());
  ASSERT_EQ(fixture.channel.sent.size(), 3U);
  EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
  EXPECT_EQ(fixture.channel.sent.back().at("code"), "INVALID_SETTINGS");
}

TEST(WorkerApplication, ControlClosureStopsAndJoinsBlockedInference) {
  Fixture fixture;
  fixture.engine.block_until_cancel = true;
  const auto wav = wav_fixture();
  fixture.channel.controls = {hello(), load_message(), transcribe_message(wav.size())};
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
  fixture.channel.waits = {WorkerChannelWaitResult::control_closed};

  EXPECT_EQ(fixture.run(), 10);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 3U);
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
    fixture.channel.controls = {hello(), load_message(), transcribe_message(wav.size())};
    fixture.channel.audio.push_back({"tx-test", 0U, true, wav});
    fixture.channel.waits = {WorkerChannelWaitResult::inference_completed};

    EXPECT_EQ(fixture.run(), 10) << (delayed ? "delayed" : "immediate");
    ASSERT_EQ(fixture.channel.sent.size(), 3U) << (delayed ? "delayed" : "immediate");
    EXPECT_EQ(fixture.channel.sent.back().at("type"), "failure");
    EXPECT_EQ(fixture.channel.sent.back().at("code"), "TRANSCRIPTION_FAILED");
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
      transcribe_message(wav.size(), "tx-split"),
      transcribe_message(wav.size(), "tx-second"),
      {{"type", "shutdown"}, {"protocolVersion", 1}, {"requestId", "shutdown-test"}},
  };
  fixture.channel.audio = {{"tx-split", 0U, true, wav}, {"tx-second", 0U, true, wav}};
  fixture.channel.waits = {WorkerChannelWaitResult::inference_completed,
                           WorkerChannelWaitResult::inference_completed};

  EXPECT_EQ(fixture.run(), 0);
  ASSERT_EQ(fixture.channel.sent.size(), 5U);
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "transcript");
  EXPECT_NE(fixture.channel.serialized[2].find("\xef\xbf\xbd"), std::string::npos);
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[3].at("text"), "second transcript");
  EXPECT_EQ(fixture.engine.transcribe_calls, 2U);
}

} // namespace
} // namespace local_whisper::whisper_cpp
