#include "local_whisper/whisper_cpp/model_file_validator.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cwctype>
#include <string>
#include <utility>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::size_t kMaximumModelPathBytes = 131'072U;

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

  [[nodiscard]] HANDLE get() const noexcept { return handle_; }
  [[nodiscard]] bool valid() const noexcept {
    return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE;
  }

private:
  HANDLE handle_;
};

[[nodiscard]] bool has_control_character(const std::string& value) {
  return std::any_of(value.begin(), value.end(),
                     [](const unsigned char byte) { return byte <= 0x1fU || byte == 0x7fU; });
}

[[nodiscard]] std::wstring utf8_to_wide(const std::string& value) {
  const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                        static_cast<int>(value.size()), nullptr, 0);
  if (count <= 0)
    throw CoreError(FailureCode::model_authority_invalid, "model path encoding invalid");
  std::wstring result(static_cast<std::size_t>(count), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), count) != count) {
    throw CoreError(FailureCode::model_authority_invalid, "model path encoding invalid");
  }
  return result;
}

[[nodiscard]] std::wstring canonical_extended_path(const std::wstring& path) {
  if (path.size() < 4U || std::iswalpha(path[0]) == 0 || path[1] != L':' || path[2] != L'\\' ||
      path.back() == L'\\') {
    throw CoreError(FailureCode::model_authority_invalid, "model path form invalid");
  }
  std::size_t component_start = 3U;
  while (component_start < path.size()) {
    const std::size_t component_end = path.find(L'\\', component_start);
    const auto component = path.substr(component_start, component_end == std::wstring::npos
                                                            ? std::wstring::npos
                                                            : component_end - component_start);
    if (component.empty() || component == L"." || component == L".." ||
        component.find_first_of(L":/") != std::wstring::npos || component.back() == L'.' ||
        component.back() == L' ') {
      throw CoreError(FailureCode::model_authority_invalid, "model path form invalid");
    }
    if (component_end == std::wstring::npos)
      break;
    component_start = component_end + 1U;
  }
  std::wstring result = L"\\\\?\\";
  result += path;
  return result;
}

} // namespace

void PlatformModelFileValidator::validate(const std::string& model_path,
                                          std::uint64_t expected_bytes) const {
  if (model_path.empty() || model_path.size() > kMaximumModelPathBytes ||
      has_control_character(model_path) || expected_bytes == 0U) {
    throw CoreError(FailureCode::model_authority_invalid, "model path metadata invalid");
  }
  const std::wstring path = canonical_extended_path(utf8_to_wide(model_path));
  const UniqueHandle handle(CreateFileW(
      path.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  FILE_STANDARD_INFO standard{};
  FILE_ATTRIBUTE_TAG_INFO attributes{};
  if (!handle.valid() || GetFileType(handle.get()) != FILE_TYPE_DISK ||
      !GetFileInformationByHandleEx(handle.get(), FileStandardInfo, &standard, sizeof(standard)) ||
      !GetFileInformationByHandleEx(handle.get(), FileAttributeTagInfo, &attributes,
                                    sizeof(attributes)) ||
      standard.Directory != FALSE || standard.EndOfFile.QuadPart <= 0 ||
      static_cast<std::uint64_t>(standard.EndOfFile.QuadPart) != expected_bytes ||
      (attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0U ||
      attributes.ReparseTag != 0U) {
    throw CoreError(FailureCode::model_authority_invalid, "model file metadata invalid");
  }
}

} // namespace local_whisper::whisper_cpp

#endif
