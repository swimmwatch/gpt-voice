#include "local_whisper/launcher/launcher_error.hpp"

#include "local_whisper/common/process_exit_codes.hpp"

#include <string>

namespace local_whisper::launcher {
namespace {

constexpr LauncherFailurePolicy kBootstrapRejectedPolicy{"BOOTSTRAP_REJECTED",
                                                         common::kLauncherBootstrapFailureExitCode};

} // namespace

LauncherError::LauncherError(const LauncherErrorCode code, const std::string_view diagnostic)
    : std::runtime_error(std::string(diagnostic)), code_(code) {}

LauncherErrorCode LauncherError::code() const noexcept { return code_; }

LauncherFailurePolicy launcher_failure_policy(const LauncherErrorCode code) noexcept {
  switch (code) {
  case LauncherErrorCode::kPathInvalid:
    return {"PATH_INVALID", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kWorkerPathInvalid:
    return {"WORKER_PATH_INVALID", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kVolumeOpenFailed:
    return {"VOLUME_OPEN_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kDirectoryOpenFailed:
    return {"DIRECTORY_OPEN_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kIdentityRejected:
    return {"IDENTITY_REJECTED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kWorkerOpenFailed:
    return {"WORKER_OPEN_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kDigestRejected:
    return {"DIGEST_REJECTED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kWorkerCreationFailed:
    return {"WORKER_CREATION_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kJobOwnershipFailed:
    return {"JOB_OWNERSHIP_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kModelAuthorityRejected:
    return {"MODEL_AUTHORITY_REJECTED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kWorkerProcessIdentityRejected:
    return {"WORKER_PROCESS_IDENTITY_REJECTED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kInheritedHandleRejected:
    return {"INHERITED_HANDLE_REJECTED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kPipeIoFailed:
    return {"PIPE_IO_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kWorkerResumeFailed:
    return {"WORKER_RESUME_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kHandlePolicyFailed:
    return {"HANDLE_POLICY_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kAcknowledgmentFailed:
    return {"ACKNOWLEDGMENT_FAILED", common::kLauncherBootstrapFailureExitCode};
  case LauncherErrorCode::kBootstrapRejected:
    return kBootstrapRejectedPolicy;
  }
  return kBootstrapRejectedPolicy;
}

LauncherFailurePolicy launcher_unknown_failure_policy() noexcept {
  return kBootstrapRejectedPolicy;
}

LauncherFailurePolicy
launcher_exception_failure_policy(const std::exception_ptr exception) noexcept {
  try {
    if (exception)
      std::rethrow_exception(exception);
  } catch (const LauncherError& error) {
    return launcher_failure_policy(error.code());
  } catch (...) {
  }
  return launcher_unknown_failure_policy();
}

} // namespace local_whisper::launcher
