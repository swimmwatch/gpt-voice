#include "local_whisper/common/native_logger.hpp"
#include "test_support.hpp"

#include <gtest/gtest.h>

#include <atomic>
#include <charconv>
#include <fstream>
#include <memory>
#include <set>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace local_whisper::common {
namespace {

class FixedClock final : public NativeLogClock {
public:
  [[nodiscard]] std::uint64_t elapsed_milliseconds() const noexcept override { return value_; }
  void set(const std::uint64_t value) noexcept { value_ = value; }

private:
  std::uint64_t value_ = 0U;
};

class CapturingSink final : public NativeLogSink {
public:
  [[nodiscard]] bool write(const std::string_view line) noexcept override {
    lines.emplace_back(line);
    return true;
  }

  std::vector<std::string> lines;
};

class FailingSink final : public NativeLogSink {
public:
  [[nodiscard]] bool write(const std::string_view /*line*/) noexcept override {
    ++write_count;
    return false;
  }

  std::atomic<std::uint32_t> write_count = 0U;
};

class ReentrantSink final : public NativeLogSink {
public:
  [[nodiscard]] bool write(const std::string_view line) noexcept override {
    lines.emplace_back(line);
    if (logger != nullptr)
      logger->emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
    return true;
  }

  NativeLogger* logger = nullptr;
  std::vector<std::string> lines;
};

class CrossLoggerSink final : public NativeLogSink {
public:
  [[nodiscard]] bool write(const std::string_view line) noexcept override {
    lines.emplace_back(line);
    if (other_logger != nullptr)
      other_logger->emit(NativeLogComponent::launcher, NativeLogEvent::request_completed);
    return true;
  }

  NativeLogger* other_logger = nullptr;
  std::vector<std::string> lines;
};

[[nodiscard]] std::uint64_t sequence_from(const std::string_view line) {
  constexpr std::string_view marker = "\"sequence\":";
  const auto position = line.find(marker);
  EXPECT_NE(position, std::string_view::npos);
  std::uint64_t value = 0U;
  const auto first = line.data() + position + marker.size();
  const auto last = line.data() + line.size();
  const auto parsed = std::from_chars(first, last, value);
  EXPECT_EQ(parsed.ec, std::errc{});
  return value;
}

[[nodiscard]] std::string native_runtime_fixture(const std::string_view name) {
  const auto path = test_support::fixture_root().parent_path().parent_path() /
                    "native-runtime-log" / "v1" / std::string(name);
  std::ifstream input(path, std::ios::binary);
  EXPECT_TRUE(static_cast<bool>(input));
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

TEST(NativeJsonLoggerTest, SerializesCanonicalSchemaAndRatesFixedKeys) {
  FixedClock clock;
  auto sink = std::make_unique<CapturingSink>();
  CapturingSink* const captured = sink.get();
  NativeJsonLogger logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"}, clock,
                          std::move(sink));

  for (std::size_t index = 0U; index < 11U; ++index)
    logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);

  ASSERT_EQ(captured->lines.size(), 10U);
  EXPECT_EQ(captured->lines.front(),
            "{\"component\":\"whisperWorker\",\"elapsedMs\":0,\"event\":\"requestCompleted\","
            "\"level\":\"info\",\"processInstanceId\":\"11111111-1111-1111-8111-111111111111\","
            "\"schemaVersion\":1,\"sequence\":1}\n");
  clock.set(60'000U);
  logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  ASSERT_EQ(captured->lines.size(), 11U);
  EXPECT_NE(captured->lines.back().find("\"suppressedCount\":1"), std::string::npos);
}

TEST(NativeJsonLoggerTest, ReproducesTheSharedCanonicalSchemaFixture) {
  FixedClock clock;
  auto sink = std::make_unique<CapturingSink>();
  CapturingSink* const captured = sink.get();
  NativeJsonLogger logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"}, clock,
                          std::move(sink));

  logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_accepted,
              {std::nullopt, "fixture"});

  ASSERT_EQ(captured->lines.size(), 1U);
  EXPECT_EQ(captured->lines.front(), native_runtime_fixture("valid.jsonl"));
}

TEST(NativeJsonLoggerTest, FiltersDebugAndRejectsUnsafeRequestIds) {
  FixedClock clock;
  auto sink = std::make_unique<CapturingSink>();
  CapturingSink* const captured = sink.get();
  NativeJsonLogger logger({NativeLogLevel::info, "11111111-1111-1111-8111-111111111111"}, clock,
                          std::move(sink));

  logger.emit(NativeLogComponent::launcher, NativeLogEvent::request_accepted);
  logger.emit(NativeLogComponent::launcher, NativeLogEvent::request_completed,
              NativeLogFields{std::nullopt, std::string_view("bad\nidentifier")});
  logger.emit(NativeLogComponent::launcher, NativeLogEvent::request_completed);

  ASSERT_EQ(captured->lines.size(), 1U);
  EXPECT_NE(captured->lines.front().find("\"event\":\"requestCompleted\""), std::string::npos);
}

TEST(NativeJsonLoggerTest, SerializesConcurrentWritesWithoutDuplicateSequences) {
  constexpr std::size_t kThreadCount = 8U;
  constexpr std::size_t kRecordsPerThread = 32U;
  FixedClock clock;
  auto sink = std::make_unique<CapturingSink>();
  CapturingSink* const captured = sink.get();
  NativeJsonLogger logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"}, clock,
                          std::move(sink));
  std::vector<std::thread> threads;
  for (std::size_t thread_index = 0U; thread_index < kThreadCount; ++thread_index) {
    threads.emplace_back([thread_index, &logger]() {
      for (std::size_t record_index = 0U; record_index < kRecordsPerThread; ++record_index) {
        const std::size_t index = thread_index * kRecordsPerThread + record_index;
        logger.emit(
            static_cast<NativeLogComponent>(index % 4U),
            static_cast<NativeLogEvent>(index % static_cast<std::size_t>(NativeLogEvent::count)),
            {static_cast<NativeLogErrorCode>(index %
                                             static_cast<std::size_t>(NativeLogErrorCode::count)),
             std::nullopt});
      }
    });
  }
  for (auto& thread : threads)
    thread.join();

  ASSERT_EQ(captured->lines.size(), kThreadCount * kRecordsPerThread);
  std::set<std::uint64_t> sequences;
  for (const auto& line : captured->lines)
    sequences.insert(sequence_from(line));
  EXPECT_EQ(sequences.size(), captured->lines.size());
  EXPECT_EQ(*sequences.begin(), 1U);
  EXPECT_EQ(*sequences.rbegin(), kThreadCount * kRecordsPerThread);
}

TEST(NativeJsonLoggerTest, ContainsReentrantAndFailedSinksWithoutAffectingLaterCalls) {
  FixedClock clock;
  auto reentrant_sink = std::make_unique<ReentrantSink>();
  ReentrantSink* const reentrant = reentrant_sink.get();
  NativeJsonLogger reentrant_logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"},
                                    clock, std::move(reentrant_sink));
  reentrant->logger = &reentrant_logger;
  reentrant_logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  EXPECT_EQ(reentrant->lines.size(), 1U);

  auto failing_sink = std::make_unique<FailingSink>();
  FailingSink* const failed = failing_sink.get();
  NativeJsonLogger failing_logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"},
                                  clock, std::move(failing_sink));
  failing_logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  failing_logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  failing_logger.shutdown();
  EXPECT_EQ(failed->write_count.load(), 1U);
}

TEST(NativeJsonLoggerTest, ContainsCrossLoggerSinkReentryAndUnsafeSchemaIntegers) {
  FixedClock clock;
  auto target_sink = std::make_unique<CapturingSink>();
  CapturingSink* const target = target_sink.get();
  NativeJsonLogger target_logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"},
                                 clock, std::move(target_sink));
  auto source_sink = std::make_unique<CrossLoggerSink>();
  CrossLoggerSink* const source = source_sink.get();
  NativeJsonLogger source_logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"},
                                 clock, std::move(source_sink));
  source->other_logger = &target_logger;

  source_logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  EXPECT_EQ(source->lines.size(), 1U);
  EXPECT_TRUE(target->lines.empty());
  target_logger.emit(NativeLogComponent::launcher, NativeLogEvent::request_completed);
  EXPECT_EQ(target->lines.size(), 1U);

  clock.set(9'007'199'254'740'992U);
  source_logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);
  EXPECT_EQ(source->lines.size(), 1U);
}

TEST(NativeJsonLoggerTest, RejectsInvalidErrorCodesBeforeRateStateIndexing) {
  FixedClock clock;
  auto sink = std::make_unique<CapturingSink>();
  CapturingSink* const captured = sink.get();
  NativeJsonLogger logger({NativeLogLevel::debug, "11111111-1111-1111-8111-111111111111"}, clock,
                          std::move(sink));

  logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed,
              {static_cast<NativeLogErrorCode>(255U), std::nullopt});
  logger.emit(NativeLogComponent::whisper_worker, NativeLogEvent::request_completed);

  ASSERT_EQ(captured->lines.size(), 1U);
  EXPECT_EQ(sequence_from(captured->lines.front()), 1U);
}

} // namespace
} // namespace local_whisper::common
