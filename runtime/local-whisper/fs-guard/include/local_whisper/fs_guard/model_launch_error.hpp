#pragma once

#include <exception>
#include <stdexcept>
#include <string_view>

namespace local_whisper::fs_guard {

enum class ModelLaunchErrorCode {
  kPathInvalid,
  kDirectoryOpenFailed,
  kFileOpenFailed,
  kIdentityRejected,
  kDigestRejected,
  kLauncherCreationFailed,
  kJobOwnershipFailed,
  kHandlePolicyFailed,
  kPipeIoFailed,
  kLauncherResumeFailed,
  kModelAuthorityRejected,
  kBootstrapRejected,
};

struct ModelLaunchFailurePolicy final {
  std::string_view acknowledgment;
  int exit_code;
};

class ModelLaunchError final : public std::runtime_error {
public:
  ModelLaunchError(ModelLaunchErrorCode code, std::string_view diagnostic);

  [[nodiscard]] ModelLaunchErrorCode code() const noexcept;

private:
  ModelLaunchErrorCode code_;
};

[[nodiscard]] ModelLaunchFailurePolicy
model_launch_failure_policy(ModelLaunchErrorCode code) noexcept;
[[nodiscard]] ModelLaunchFailurePolicy model_launch_unknown_failure_policy() noexcept;
[[nodiscard]] ModelLaunchFailurePolicy
model_launch_exception_failure_policy(std::exception_ptr exception) noexcept;

} // namespace local_whisper::fs_guard
