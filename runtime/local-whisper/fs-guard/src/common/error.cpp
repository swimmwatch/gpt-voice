#include "local_whisper/fs_guard/error.hpp"

#include <string>

namespace local_whisper::fs_guard {

std::string_view to_string(const ErrorCode code) noexcept {
  switch (code) {
  case ErrorCode::kConflict:
    return "CONFLICT";
  case ErrorCode::kIdentityChanged:
    return "IDENTITY_CHANGED";
  case ErrorCode::kInvalidInput:
    return "INVALID_INPUT";
  case ErrorCode::kIoFailed:
    return "IO_FAILED";
  case ErrorCode::kUnsafeEntry:
    return "UNSAFE_ENTRY";
  case ErrorCode::kUnsupported:
    return "UNSUPPORTED";
  }
  return "IO_FAILED";
}

ErrorCode normalize_error_code(const std::string_view code) noexcept {
  if (code == "CONFLICT")
    return ErrorCode::kConflict;
  if (code == "IDENTITY_CHANGED")
    return ErrorCode::kIdentityChanged;
  if (code == "INVALID_INPUT")
    return ErrorCode::kInvalidInput;
  if (code == "UNSAFE_ENTRY")
    return ErrorCode::kUnsafeEntry;
  if (code == "UNSUPPORTED")
    return ErrorCode::kUnsupported;
  return ErrorCode::kIoFailed;
}

GuardError::GuardError(const ErrorCode code)
    : std::runtime_error(std::string(to_string(code))), code_(code) {}

GuardError::GuardError(const std::string_view code) : GuardError(normalize_error_code(code)) {}

std::string_view GuardError::code() const noexcept { return to_string(code_); }

} // namespace local_whisper::fs_guard
