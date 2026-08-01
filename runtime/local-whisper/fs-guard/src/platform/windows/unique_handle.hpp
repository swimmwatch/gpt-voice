#pragma once

#define NOMINMAX
#include <windows.h>

#include <utility>

namespace local_whisper::fs_guard {

class UniqueHandle final {
public:
  UniqueHandle() noexcept = default;
  UniqueHandle(HANDLE handle) noexcept // NOLINT(google-explicit-constructor)
      : handle_(handle) {}
  ~UniqueHandle() noexcept { reset(); }

  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;

  UniqueHandle(UniqueHandle&& other) noexcept : handle_(other.release()) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }

  UniqueHandle& operator=(HANDLE handle) noexcept {
    reset(handle);
    return *this;
  }

  [[nodiscard]] HANDLE get() const noexcept { return handle_; }
  [[nodiscard]] bool valid() const noexcept {
    return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE;
  }
  operator HANDLE() const noexcept { // NOLINT(google-explicit-constructor)
    return handle_;
  }

  [[nodiscard]] HANDLE release() noexcept { return std::exchange(handle_, INVALID_HANDLE_VALUE); }
  void reset(HANDLE handle = INVALID_HANDLE_VALUE) noexcept {
    if (valid())
      CloseHandle(handle_);
    handle_ = handle;
  }

private:
  HANDLE handle_ = INVALID_HANDLE_VALUE;
};

} // namespace local_whisper::fs_guard
