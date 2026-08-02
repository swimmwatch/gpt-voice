#include "local_whisper/whisper_cpp/worker_application.hpp"

#include "local_whisper/common/sha256.hpp"
#include "test_model_source.hpp"

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <deque>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
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

  void send_control(const nlohmann::json& value) override { sent.push_back(value); }

  std::deque<nlohmann::json> controls;
  std::deque<WorkerAudioChunk> audio;
  std::vector<nlohmann::json> sent;
  std::size_t audio_reads = 0U;
};

class FakeEngine final : public SpeechEngine {
public:
  void load(ExactModelReader& reader, const std::string& family,
            const std::string& variant) override {
    EXPECT_EQ(family, "tiny");
    EXPECT_EQ(variant, "full");
    reader.skip_exact(reader.expected_bytes());
    reader.verify_complete();
    reader.close();
    loaded_ = true;
    ++load_calls;
  }

  void warm_up(std::uint32_t cpu_threads) override {
    EXPECT_TRUE(loaded_);
    EXPECT_EQ(cpu_threads, 1U);
    ++warm_up_calls;
  }

  [[nodiscard]] std::string transcribe(std::span<const float> samples,
                                       const TranscriptionOptions& options) override {
    EXPECT_TRUE(loaded_);
    EXPECT_FALSE(samples.empty());
    EXPECT_EQ(options.language, "en");
    ++transcribe_calls;
    return "test transcript";
  }

  void unload() noexcept override {
    loaded_ = false;
    ++unload_calls;
  }
  [[nodiscard]] bool loaded() const noexcept override { return loaded_; }

  std::size_t load_calls = 0U;
  std::size_t warm_up_calls = 0U;
  std::size_t transcribe_calls = 0U;
  std::size_t unload_calls = 0U;

private:
  bool loaded_ = false;
};

class FakeClock final : public WorkerClock {
public:
  [[nodiscard]] std::uint64_t now_ticks() const noexcept override { return ticks_++; }

private:
  mutable std::uint64_t ticks_ = 1U;
};

class NeverCancelled final : public WorkerCancellation {
public:
  [[nodiscard]] bool requested() const noexcept override { return false; }
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
        {"runtimePackRevision", "whisper-cpp-linux-x64-cpu-baseline-v1"},
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
        {"precision", nullptr},
        {"resolvedCpuThreads", 1U}}},
  };
}

nlohmann::json transcribe_message(std::size_t audio_bytes) {
  return {{"type", "transcribe"},
          {"protocolVersion", 1},
          {"requestId", "tx-test"},
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
                                  &authority);
    return application.run();
  }

  FakeChannel channel;
  FakeEngine engine;
  FakeClock clock;
  NeverCancelled cancellation;
  FakeAuthority authority;
};

TEST(WorkerApplication, RunsLoadWarmupTranscriptionAndUnloadStateMachine) {
  Fixture fixture;
  const auto wav = wav_fixture();
  fixture.channel.controls = {
      hello(),
      load_message(),
      {{"type", "warmup"}, {"protocolVersion", 1}, {"requestId", "warm-test"}},
      transcribe_message(wav.size()),
      {{"type", "unload"}, {"protocolVersion", 1}, {"requestId", "unload-test"}},
  };
  fixture.channel.audio.push_back({"tx-test", 0U, true, wav});

  EXPECT_EQ(fixture.run(), 0);
  EXPECT_EQ(fixture.engine.load_calls, 1U);
  EXPECT_EQ(fixture.engine.warm_up_calls, 1U);
  EXPECT_EQ(fixture.engine.transcribe_calls, 1U);
  EXPECT_EQ(fixture.engine.unload_calls, 1U);
  ASSERT_EQ(fixture.channel.sent.size(), 5U);
  EXPECT_EQ(fixture.channel.sent[0].at("type"), "helloAck");
  EXPECT_EQ(fixture.channel.sent[1].at("type"), "loaded");
  EXPECT_EQ(fixture.channel.sent[2].at("type"), "warmed");
  EXPECT_EQ(fixture.channel.sent[3].at("type"), "transcript");
  EXPECT_EQ(fixture.channel.sent[3].at("text"), "test transcript");
  EXPECT_EQ(fixture.channel.sent[4].at("type"), "unloaded");
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

} // namespace
} // namespace local_whisper::whisper_cpp
