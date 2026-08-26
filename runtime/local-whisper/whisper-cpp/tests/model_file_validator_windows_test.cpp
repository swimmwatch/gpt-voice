#include "local_whisper/whisper_cpp/model_file_validator.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <cstdint>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace local_whisper::whisper_cpp {
namespace {

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE handle = INVALID_HANDLE_VALUE) noexcept : handle_(handle) {}
  ~UniqueHandle() noexcept {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE)
      static_cast<void>(CloseHandle(handle_));
  }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept
      : handle_(std::exchange(other.handle_, INVALID_HANDLE_VALUE)) {}
  UniqueHandle& operator=(UniqueHandle&&) = delete;
  [[nodiscard]] bool valid() const noexcept {
    return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE;
  }
  [[nodiscard]] HANDLE get() const noexcept { return handle_; }

private:
  HANDLE handle_;
};

class ValidatedTemporaryRoot final {
public:
  ValidatedTemporaryRoot() {
    const auto base = std::filesystem::temp_directory_path();
    const auto nonce =
        std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64());
    for (std::uint32_t attempt = 0U; attempt < 128U; ++attempt) {
      path_ = base / (L"local-whisper-model-validator-" + nonce + L"-" + std::to_wstring(attempt));
      std::error_code error;
      if (std::filesystem::create_directory(path_, error))
        return;
    }
    throw std::runtime_error("temporary root unavailable");
  }

  ~ValidatedTemporaryRoot() noexcept {
    std::error_code error;
    static_cast<void>(std::filesystem::remove_all(path_, error));
  }

  ValidatedTemporaryRoot(const ValidatedTemporaryRoot&) = delete;
  ValidatedTemporaryRoot& operator=(const ValidatedTemporaryRoot&) = delete;

  [[nodiscard]] std::filesystem::path child(std::wstring_view name) const { return path_ / name; }
  [[nodiscard]] const std::filesystem::path& path() const noexcept { return path_; }

private:
  std::filesystem::path path_;
};

void write_exact_file(const std::filesystem::path& path, std::string_view contents) {
  const UniqueHandle handle(CreateFileW(path.c_str(), GENERIC_WRITE, 0U, nullptr, CREATE_NEW,
                                        FILE_ATTRIBUTE_NORMAL, nullptr));
  if (!handle.valid())
    throw std::runtime_error("fixture file unavailable");
  DWORD written = 0U;
  if (!WriteFile(handle.get(), contents.data(), static_cast<DWORD>(contents.size()), &written,
                 nullptr) ||
      written != contents.size()) {
    throw std::runtime_error("fixture write failed");
  }
}

std::string utf8_path(const std::filesystem::path& path) {
  const auto value = path.u8string();
  return {reinterpret_cast<const char*>(value.data()), value.size()};
}

TEST(ModelFileValidatorWindows, AcceptsOnlyExactCanonicalRegularFileMetadata) {
  const ValidatedTemporaryRoot root;
  const auto model = root.child(L"model.bin");
  write_exact_file(model, "model-data");
  const PlatformModelFileValidator validator;

  EXPECT_NO_THROW(validator.validate(utf8_path(model), 10U));
  EXPECT_THROW(validator.validate(utf8_path(model), 9U), CoreError);
  EXPECT_THROW(validator.validate(utf8_path(model), 0U), CoreError);
  EXPECT_THROW(validator.validate("relative-model.bin", 10U), CoreError);
  EXPECT_THROW(validator.validate(utf8_path(root.path() / L"." / L"model.bin"), 10U), CoreError);
  EXPECT_THROW(validator.validate(utf8_path(model) + "\n", 10U), CoreError);
  EXPECT_THROW(validator.validate(std::string("\xff"), 10U), CoreError);
  EXPECT_THROW(validator.validate(utf8_path(root.path()), 10U), CoreError);
}

TEST(ModelFileValidatorWindows, RejectsFinalReparsePointsWithoutDisclosingPath) {
  const ValidatedTemporaryRoot root;
  const auto model = root.child(L"private-model-marker.bin");
  const auto link = root.child(L"model-link.bin");
  write_exact_file(model, "model-data");
  constexpr DWORD kAllowUnprivilegedCreate = 0x2U;
  if (!CreateSymbolicLinkW(link.c_str(), model.c_str(), kAllowUnprivilegedCreate))
    GTEST_SKIP() << "symbolic-link fixture unavailable";
  const PlatformModelFileValidator validator;

  try {
    validator.validate(utf8_path(link), 10U);
    FAIL() << "reparse-point model path accepted";
  } catch (const CoreError& error) {
    EXPECT_EQ(std::string(error.what()).find(utf8_path(root.path())), std::string::npos);
    EXPECT_EQ(std::string(error.what()).find("private-model-marker"), std::string::npos);
  }
}

} // namespace
} // namespace local_whisper::whisper_cpp

#endif
