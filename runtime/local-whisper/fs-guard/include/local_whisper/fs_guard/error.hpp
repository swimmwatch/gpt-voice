#pragma once

#include <stdexcept>
#include <string>
#include <string_view>

namespace local_whisper::fs_guard {

enum class ErrorCode {
  kConflict,
  kIdentityChanged,
  kInvalidInput,
  kIoFailed,
  kUnsafeEntry,
  kUnsupported,
};

[[nodiscard]] std::string_view to_string(ErrorCode code) noexcept;
[[nodiscard]] ErrorCode normalize_error_code(std::string_view code) noexcept;

class GuardError final : public std::runtime_error {
public:
  explicit GuardError(ErrorCode code);
  GuardError(ErrorCode code, std::string_view diagnostic);
  explicit GuardError(std::string_view code);

  [[nodiscard]] std::string_view code() const noexcept;
  [[nodiscard]] std::string_view diagnostic() const noexcept;

private:
  ErrorCode code_;
  std::string diagnostic_;
};

} // namespace local_whisper::fs_guard
