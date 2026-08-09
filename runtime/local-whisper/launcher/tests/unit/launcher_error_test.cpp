#include "local_whisper/common/process_exit_codes.hpp"
#include "local_whisper/launcher/launcher_error.hpp"

#include <gtest/gtest.h>

#include <array>
#include <exception>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace local_whisper::launcher {
namespace {

TEST(LauncherErrorTest, MapsEveryTypedFailureToItsFrozenWindowsAcknowledgment) {
  constexpr std::array<std::pair<LauncherErrorCode, std::string_view>, 17> cases = {
      std::pair{LauncherErrorCode::kPathInvalid, "PATH_INVALID"},
      std::pair{LauncherErrorCode::kWorkerPathInvalid, "WORKER_PATH_INVALID"},
      std::pair{LauncherErrorCode::kVolumeOpenFailed, "VOLUME_OPEN_FAILED"},
      std::pair{LauncherErrorCode::kDirectoryOpenFailed, "DIRECTORY_OPEN_FAILED"},
      std::pair{LauncherErrorCode::kIdentityRejected, "IDENTITY_REJECTED"},
      std::pair{LauncherErrorCode::kWorkerOpenFailed, "WORKER_OPEN_FAILED"},
      std::pair{LauncherErrorCode::kDigestRejected, "DIGEST_REJECTED"},
      std::pair{LauncherErrorCode::kWorkerCreationFailed, "WORKER_CREATION_FAILED"},
      std::pair{LauncherErrorCode::kJobOwnershipFailed, "JOB_OWNERSHIP_FAILED"},
      std::pair{LauncherErrorCode::kModelAuthorityRejected, "MODEL_AUTHORITY_REJECTED"},
      std::pair{LauncherErrorCode::kWorkerProcessIdentityRejected,
                "WORKER_PROCESS_IDENTITY_REJECTED"},
      std::pair{LauncherErrorCode::kInheritedHandleRejected, "INHERITED_HANDLE_REJECTED"},
      std::pair{LauncherErrorCode::kPipeIoFailed, "PIPE_IO_FAILED"},
      std::pair{LauncherErrorCode::kWorkerResumeFailed, "WORKER_RESUME_FAILED"},
      std::pair{LauncherErrorCode::kHandlePolicyFailed, "HANDLE_POLICY_FAILED"},
      std::pair{LauncherErrorCode::kAcknowledgmentFailed, "ACKNOWLEDGMENT_FAILED"},
      std::pair{LauncherErrorCode::kBootstrapRejected, "BOOTSTRAP_REJECTED"},
  };

  for (const auto& [code, acknowledgment] : cases) {
    const LauncherFailurePolicy policy = launcher_failure_policy(code);
    EXPECT_EQ(policy.acknowledgment, acknowledgment);
    EXPECT_EQ("FAILED\\t" + std::string(policy.acknowledgment) + "\\n",
              "FAILED\\t" + std::string(acknowledgment) + "\\n");
    EXPECT_EQ(policy.exit_code, common::kLauncherBootstrapFailureExitCode);
  }
}

TEST(LauncherErrorTest, DiagnosticWordingDoesNotChangePolicy) {
  const LauncherError initial(LauncherErrorCode::kDigestRejected, "initial safe diagnostic");
  const LauncherError revised(LauncherErrorCode::kDigestRejected, "revised safe diagnostic");

  EXPECT_EQ(initial.code(), revised.code());
  EXPECT_NE(std::string_view(initial.what()), std::string_view(revised.what()));
  EXPECT_EQ(launcher_failure_policy(initial.code()).acknowledgment,
            launcher_failure_policy(revised.code()).acknowledgment);
  EXPECT_EQ(launcher_failure_policy(initial.code()).exit_code,
            launcher_failure_policy(revised.code()).exit_code);
}

TEST(LauncherErrorTest, ClassifiesTypedStandardAndNonstandardExceptionsWithoutDiagnosticMatching) {
  std::exception_ptr typed;
  std::exception_ptr standard;
  std::exception_ptr nonstandard;
  try {
    throw LauncherError(LauncherErrorCode::kDigestRejected, "first safe diagnostic");
  } catch (...) {
    typed = std::current_exception();
  }
  try {
    throw std::runtime_error("changed standard diagnostic");
  } catch (...) {
    standard = std::current_exception();
  }
  try {
    throw 17;
  } catch (...) {
    nonstandard = std::current_exception();
  }

  EXPECT_EQ(launcher_exception_failure_policy(typed).acknowledgment, "DIGEST_REJECTED");
  EXPECT_EQ(launcher_exception_failure_policy(standard).acknowledgment, "BOOTSTRAP_REJECTED");
  EXPECT_EQ(launcher_exception_failure_policy(nonstandard).acknowledgment, "BOOTSTRAP_REJECTED");
}

TEST(LauncherErrorTest, ExposesNamedProcessExitContracts) {
  EXPECT_EQ(common::kInvalidInvocationExitCode, 2);
  EXPECT_EQ(common::kLauncherBootstrapFailureExitCode, 10);
  EXPECT_EQ(common::kModelLaunchFailureExitCode, 20);
  EXPECT_EQ(common::kChildExecBootstrapFailureExitCode, 126);
  EXPECT_EQ(common::kChildStatusUnavailableExitCode, 1);
  EXPECT_EQ(common::kChildSignalExitCodeBase, 128);
  EXPECT_EQ(common::kForcedJobTerminationExitCode, 1);
}

} // namespace
} // namespace local_whisper::launcher
