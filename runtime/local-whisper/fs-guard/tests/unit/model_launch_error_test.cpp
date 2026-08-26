#include "local_whisper/common/process_exit_codes.hpp"
#include "local_whisper/fs_guard/model_launch_error.hpp"

#include <gtest/gtest.h>

#include <array>
#include <exception>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace local_whisper::fs_guard {
namespace {

TEST(ModelLaunchErrorTest, MapsEveryTypedFailureToItsFrozenWindowsAcknowledgment) {
  constexpr std::array<std::pair<ModelLaunchErrorCode, std::string_view>, 12> cases = {
      std::pair{ModelLaunchErrorCode::kPathInvalid, "MODEL_PATH_INVALID"},
      std::pair{ModelLaunchErrorCode::kDirectoryOpenFailed, "MODEL_DIRECTORY_OPEN_FAILED"},
      std::pair{ModelLaunchErrorCode::kFileOpenFailed, "MODEL_FILE_OPEN_FAILED"},
      std::pair{ModelLaunchErrorCode::kIdentityRejected, "MODEL_IDENTITY_REJECTED"},
      std::pair{ModelLaunchErrorCode::kDigestRejected, "MODEL_DIGEST_REJECTED"},
      std::pair{ModelLaunchErrorCode::kLauncherCreationFailed, "MODEL_LAUNCHER_CREATION_FAILED"},
      std::pair{ModelLaunchErrorCode::kJobOwnershipFailed, "MODEL_JOB_OWNERSHIP_FAILED"},
      std::pair{ModelLaunchErrorCode::kHandlePolicyFailed, "MODEL_HANDLE_POLICY_FAILED"},
      std::pair{ModelLaunchErrorCode::kPipeIoFailed, "MODEL_PIPE_IO_FAILED"},
      std::pair{ModelLaunchErrorCode::kLauncherResumeFailed, "MODEL_LAUNCHER_RESUME_FAILED"},
      std::pair{ModelLaunchErrorCode::kModelAuthorityRejected, "MODEL_BOOTSTRAP_REJECTED"},
      std::pair{ModelLaunchErrorCode::kBootstrapRejected, "MODEL_BOOTSTRAP_REJECTED"},
  };

  for (const auto& [code, acknowledgment] : cases) {
    const ModelLaunchFailurePolicy policy = model_launch_failure_policy(code);
    EXPECT_EQ(policy.acknowledgment, acknowledgment);
    EXPECT_EQ("FAILED\\t" + std::string(policy.acknowledgment) + "\\n",
              "FAILED\\t" + std::string(acknowledgment) + "\\n");
    EXPECT_EQ(policy.exit_code, common::kModelLaunchFailureExitCode);
  }
}

TEST(ModelLaunchErrorTest, DiagnosticWordingDoesNotChangePolicy) {
  const ModelLaunchError initial(ModelLaunchErrorCode::kIdentityRejected,
                                 "initial safe diagnostic");
  const ModelLaunchError revised(ModelLaunchErrorCode::kIdentityRejected,
                                 "revised safe diagnostic");

  EXPECT_EQ(initial.code(), revised.code());
  EXPECT_NE(std::string_view(initial.what()), std::string_view(revised.what()));
  EXPECT_EQ(model_launch_failure_policy(initial.code()).acknowledgment,
            model_launch_failure_policy(revised.code()).acknowledgment);
  EXPECT_EQ(model_launch_failure_policy(initial.code()).exit_code,
            model_launch_failure_policy(revised.code()).exit_code);
}

TEST(ModelLaunchErrorTest,
     ClassifiesTypedStandardAndNonstandardExceptionsWithoutDiagnosticMatching) {
  std::exception_ptr typed;
  std::exception_ptr standard;
  std::exception_ptr nonstandard;
  try {
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected, "first safe diagnostic");
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

  EXPECT_EQ(model_launch_exception_failure_policy(typed).acknowledgment, "MODEL_DIGEST_REJECTED");
  EXPECT_EQ(model_launch_exception_failure_policy(standard).acknowledgment,
            "MODEL_BOOTSTRAP_REJECTED");
  EXPECT_EQ(model_launch_exception_failure_policy(nonstandard).acknowledgment,
            "MODEL_BOOTSTRAP_REJECTED");
}

} // namespace
} // namespace local_whisper::fs_guard
