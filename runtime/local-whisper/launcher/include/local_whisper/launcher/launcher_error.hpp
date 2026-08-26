#pragma once

#include <exception>
#include <stdexcept>
#include <string_view>

namespace local_whisper::launcher {

enum class LauncherErrorCode {
  kPathInvalid,
  kWorkerPathInvalid,
  kVolumeOpenFailed,
  kDirectoryOpenFailed,
  kIdentityRejected,
  kWorkerOpenFailed,
  kDigestRejected,
  kWorkerCreationFailed,
  kJobOwnershipFailed,
  kModelAuthorityRejected,
  kWorkerProcessIdentityRejected,
  kInheritedHandleRejected,
  kPipeIoFailed,
  kWorkerResumeFailed,
  kHandlePolicyFailed,
  kAcknowledgmentFailed,
  kBootstrapRejected,
};

struct LauncherFailurePolicy final {
  std::string_view acknowledgment;
  int exit_code;
};

class LauncherError final : public std::runtime_error {
public:
  LauncherError(LauncherErrorCode code, std::string_view diagnostic);

  [[nodiscard]] LauncherErrorCode code() const noexcept;

private:
  LauncherErrorCode code_;
};

[[nodiscard]] LauncherFailurePolicy launcher_failure_policy(LauncherErrorCode code) noexcept;
[[nodiscard]] LauncherFailurePolicy launcher_unknown_failure_policy() noexcept;
[[nodiscard]] LauncherFailurePolicy
launcher_exception_failure_policy(std::exception_ptr exception) noexcept;

} // namespace local_whisper::launcher
