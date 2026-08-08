#include "local_whisper/whisper_cpp/cancellation.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <thread>

namespace local_whisper::whisper_cpp {
namespace {

TEST(CancellationController, PublishesRequestAndSupportsExplicitOperationReset) {
  CancellationController cancellation;
  EXPECT_FALSE(cancellation.requested());
  cancellation.request();
  EXPECT_TRUE(cancellation.requested());
  EXPECT_THROW(cancellation.checkpoint(), CoreError);
  cancellation.reset();
  EXPECT_FALSE(cancellation.requested());
}

TEST(InferenceTerminalArbiter, CancellationBeatsLaterNativeSuccess) {
  InferenceTerminalArbiter terminal;
  EXPECT_TRUE(terminal.cancel());
  EXPECT_FALSE(terminal.try_succeed());
  EXPECT_EQ(terminal.state(), InferenceTerminal::cancelled);
}

TEST(InferenceTerminalArbiter, ExactlyOneConcurrentTerminalOutcomeWins) {
  InferenceTerminalArbiter terminal;
  std::thread cancellation([&terminal] { static_cast<void>(terminal.cancel()); });
  std::thread success([&terminal] { static_cast<void>(terminal.try_succeed()); });
  cancellation.join();
  success.join();
  EXPECT_NE(terminal.state(), InferenceTerminal::running);
}

} // namespace
} // namespace local_whisper::whisper_cpp
