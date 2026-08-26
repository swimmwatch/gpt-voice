#include "local_whisper/fs_guard/model_launch_error.hpp"

#include "local_whisper/common/process_exit_codes.hpp"

#include <string>

namespace local_whisper::fs_guard {
namespace {

constexpr ModelLaunchFailurePolicy kBootstrapRejectedPolicy{"MODEL_BOOTSTRAP_REJECTED",
                                                            common::kModelLaunchFailureExitCode};

} // namespace

ModelLaunchError::ModelLaunchError(const ModelLaunchErrorCode code,
                                   const std::string_view diagnostic)
    : std::runtime_error(std::string(diagnostic)), code_(code) {}

ModelLaunchErrorCode ModelLaunchError::code() const noexcept { return code_; }

ModelLaunchFailurePolicy model_launch_failure_policy(const ModelLaunchErrorCode code) noexcept {
  switch (code) {
  case ModelLaunchErrorCode::kPathInvalid:
    return {"MODEL_PATH_INVALID", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kDirectoryOpenFailed:
    return {"MODEL_DIRECTORY_OPEN_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kFileOpenFailed:
    return {"MODEL_FILE_OPEN_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kIdentityRejected:
    return {"MODEL_IDENTITY_REJECTED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kDigestRejected:
    return {"MODEL_DIGEST_REJECTED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kLauncherCreationFailed:
    return {"MODEL_LAUNCHER_CREATION_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kJobOwnershipFailed:
    return {"MODEL_JOB_OWNERSHIP_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kHandlePolicyFailed:
    return {"MODEL_HANDLE_POLICY_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kPipeIoFailed:
    return {"MODEL_PIPE_IO_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kLauncherResumeFailed:
    return {"MODEL_LAUNCHER_RESUME_FAILED", common::kModelLaunchFailureExitCode};
  case ModelLaunchErrorCode::kModelAuthorityRejected:
  case ModelLaunchErrorCode::kBootstrapRejected:
    return kBootstrapRejectedPolicy;
  }
  return kBootstrapRejectedPolicy;
}

ModelLaunchFailurePolicy model_launch_unknown_failure_policy() noexcept {
  return kBootstrapRejectedPolicy;
}

ModelLaunchFailurePolicy
model_launch_exception_failure_policy(const std::exception_ptr exception) noexcept {
  try {
    if (exception)
      std::rethrow_exception(exception);
  } catch (const ModelLaunchError& error) {
    return model_launch_failure_policy(error.code());
  } catch (...) {
  }
  return model_launch_unknown_failure_policy();
}

} // namespace local_whisper::fs_guard
