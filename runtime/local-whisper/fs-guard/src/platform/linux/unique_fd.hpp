#pragma once

#include <unistd.h>

#include <dirent.h>

#include <utility>

namespace local_whisper::fs_guard {

class UniqueFd final {
public:
  UniqueFd() noexcept = default;
  UniqueFd(int fd) noexcept : fd_(fd) {} // NOLINT(google-explicit-constructor)
  ~UniqueFd() noexcept { reset(); }

  UniqueFd(const UniqueFd&) = delete;
  UniqueFd& operator=(const UniqueFd&) = delete;

  UniqueFd(UniqueFd&& other) noexcept : fd_(other.release()) {}
  UniqueFd& operator=(UniqueFd&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }

  UniqueFd& operator=(int fd) noexcept {
    reset(fd);
    return *this;
  }

  [[nodiscard]] int get() const noexcept { return fd_; }
  [[nodiscard]] bool valid() const noexcept { return fd_ >= 0; }
  operator int() const noexcept { return fd_; } // NOLINT(google-explicit-constructor)

  [[nodiscard]] int release() noexcept { return std::exchange(fd_, -1); }
  void reset(int fd = -1) noexcept {
    if (fd_ >= 0)
      ::close(fd_);
    fd_ = fd;
  }

private:
  int fd_ = -1;
};

class UniqueDir final {
public:
  UniqueDir() noexcept = default;
  UniqueDir(DIR* directory) noexcept // NOLINT(google-explicit-constructor)
      : directory_(directory) {}
  ~UniqueDir() noexcept { reset(); }

  UniqueDir(const UniqueDir&) = delete;
  UniqueDir& operator=(const UniqueDir&) = delete;

  UniqueDir(UniqueDir&& other) noexcept : directory_(other.release()) {}
  UniqueDir& operator=(UniqueDir&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }

  [[nodiscard]] DIR* get() const noexcept { return directory_; }
  [[nodiscard]] bool valid() const noexcept { return directory_ != nullptr; }
  [[nodiscard]] DIR* release() noexcept { return std::exchange(directory_, nullptr); }
  void reset(DIR* directory = nullptr) noexcept {
    if (directory_ != nullptr)
      ::closedir(directory_);
    directory_ = directory;
  }

private:
  DIR* directory_ = nullptr;
};

} // namespace local_whisper::fs_guard
