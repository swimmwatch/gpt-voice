#include "local_whisper/whisper_cpp/model_authority.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>
#include <winnt.h>

#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <memory>
#include <optional>
#include <span>
#include <utility>
#include <variant>

namespace local_whisper::whisper_cpp {
namespace {

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE handle = INVALID_HANDLE_VALUE) noexcept : handle_(handle) {}
  ~UniqueHandle() noexcept { reset(); }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : handle_(other.release()) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }
  [[nodiscard]] HANDLE get() const noexcept { return handle_; }
  [[nodiscard]] HANDLE release() noexcept { return std::exchange(handle_, INVALID_HANDLE_VALUE); }
  void reset(HANDLE handle = INVALID_HANDLE_VALUE) noexcept {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE)
      static_cast<void>(CloseHandle(handle_));
    handle_ = handle;
  }

private:
  HANDLE handle_;
};

void read_exact(HANDLE handle, std::span<std::uint8_t> bytes) {
  while (!bytes.empty()) {
    DWORD count = 0;
    if (!ReadFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr) ||
        count == 0U) {
      throw CoreError(FailureCode::model_authority_invalid, "Windows authority read failed");
    }
    bytes = bytes.subspan(count);
  }
}

void write_exact(HANDLE handle, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    DWORD count = 0;
    if (!WriteFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr) ||
        count == 0U) {
      throw CoreError(FailureCode::model_authority_invalid, "Windows authority write failed");
    }
    bytes = bytes.subspan(count);
  }
}

std::array<std::uint8_t, 32> process_start_identity() {
  FILETIME creation{};
  FILETIME exit{};
  FILETIME kernel{};
  FILETIME user{};
  if (!GetProcessTimes(GetCurrentProcess(), &creation, &exit, &kernel, &user))
    throw CoreError(FailureCode::model_authority_invalid, "Windows process identity failed");
  std::array<std::uint8_t, 20> input{};
  const auto pid = static_cast<std::uint64_t>(GetCurrentProcessId());
  const auto ticks =
      (static_cast<std::uint64_t>(creation.dwHighDateTime) << 32U) | creation.dwLowDateTime;
  constexpr std::array<std::uint8_t, 4> domain = {'L', 'W', 'P', 'S'};
  std::copy(domain.begin(), domain.end(), input.begin());
  for (std::size_t index = 0; index < 8U; ++index) {
    input[4U + index] = static_cast<std::uint8_t>(pid >> ((7U - index) * 8U));
    input[12U + index] = static_cast<std::uint8_t>(ticks >> ((7U - index) * 8U));
  }
  return local_whisper::common::sha256(input);
}

class WindowsHandleSource final : public RandomAccessModelSource {
public:
  explicit WindowsHandleSource(UniqueHandle handle) : handle_(std::move(handle)) {
    FILE_STANDARD_INFO standard{};
    FILE_ACCESS_INFO access{};
    LARGE_INTEGER offset{};
    valid_ = GetFileInformationByHandleEx(handle_.get(), FileStandardInfo, &standard,
                                          sizeof(standard)) != FALSE &&
             GetFileInformationByHandleEx(handle_.get(), FileAccessInfo, &access, sizeof(access)) !=
                 FALSE &&
             SetFilePointerEx(handle_.get(), {}, &offset, FILE_CURRENT) != FALSE &&
             standard.Directory == FALSE && standard.EndOfFile.QuadPart > 0 &&
             (access.AccessFlags &
              (FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_ATTRIBUTES | FILE_WRITE_EA)) == 0U &&
             offset.QuadPart == 0;
  }

  [[nodiscard]] bool is_read_only_regular() const noexcept override { return valid_; }
  [[nodiscard]] std::uint64_t size_bytes() const override {
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(handle_.get(), &size) || size.QuadPart < 0)
      throw CoreError(FailureCode::model_corrupt, "Windows model size changed");
    return static_cast<std::uint64_t>(size.QuadPart);
  }
  [[nodiscard]] std::uint64_t initial_offset() const override { return 0U; }
  [[nodiscard]] std::optional<std::size_t> read_at(std::uint64_t offset,
                                                   std::span<std::uint8_t> destination) override {
    if (offset > static_cast<std::uint64_t>(std::numeric_limits<std::int64_t>::max()) ||
        destination.size() > std::numeric_limits<DWORD>::max()) {
      return std::nullopt;
    }
    OVERLAPPED operation{};
    operation.Offset = static_cast<DWORD>(offset);
    operation.OffsetHigh = static_cast<DWORD>(offset >> 32U);
    DWORD count = 0;
    if (!ReadFile(handle_.get(), destination.data(), static_cast<DWORD>(destination.size()), &count,
                  &operation)) {
      return GetLastError() == ERROR_HANDLE_EOF ? std::optional<std::size_t>(0U) : std::nullopt;
    }
    return static_cast<std::size_t>(count);
  }

private:
  UniqueHandle handle_;
  bool valid_ = false;
};

} // namespace

class ModelAuthority::Impl final {
public:
  Impl(local_whisper::common::AuthorityBinding binding, UniqueHandle handle)
      : binding_(std::move(binding)), source_(std::move(handle)) {}

  local_whisper::common::AuthorityBinding binding_;
  WindowsHandleSource source_;
};

ModelAuthority::ModelAuthority(std::unique_ptr<Impl> impl) : impl_(std::move(impl)) {}
ModelAuthority::~ModelAuthority() noexcept = default;
ModelAuthority::ModelAuthority(ModelAuthority&&) noexcept = default;
ModelAuthority& ModelAuthority::operator=(ModelAuthority&&) noexcept = default;

ModelAuthority ModelAuthority::receive_from_standard_channels() {
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  std::array<std::uint8_t, local_whisper::common::kAuthorityTransferBytes> bytes{};
  read_exact(input, bytes);
  const auto record = local_whisper::common::decode_authority_record(bytes);
  const auto* transfer = std::get_if<local_whisper::common::AuthorityTransfer>(&record);
  if (transfer == nullptr || transfer->hop != 2U ||
      transfer->carrier_kind !=
          local_whisper::common::AuthorityCarrierKind::windows_worker_handle ||
      transfer->carrier_value == 0U ||
      transfer->binding.artifact_kind !=
          local_whisper::common::AuthorityArtifactKind::regular_file) {
    throw CoreError(FailureCode::model_authority_invalid, "invalid Windows model authority");
  }
  UniqueHandle handle(
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(transfer->carrier_value)));
  const auto acknowledgment =
      local_whisper::common::encode_authority_record(local_whisper::common::AuthorityAcknowledgment{
          transfer->binding, local_whisper::common::AuthorityCarrierKind::windows_worker_handle,
          transfer->carrier_value, GetCurrentProcessId(), process_start_identity()});
  write_exact(output, acknowledgment);
  std::array<std::uint8_t, 1> release{};
  read_exact(input, release);
  if (release[0] != 1U)
    throw CoreError(FailureCode::model_authority_invalid, "invalid Windows authority release");
  return ModelAuthority(std::make_unique<Impl>(transfer->binding, std::move(handle)));
}

const local_whisper::common::AuthorityBinding& ModelAuthority::binding() const noexcept {
  return impl_->binding_;
}
RandomAccessModelSource& ModelAuthority::source() noexcept { return impl_->source_; }

} // namespace local_whisper::whisper_cpp

#endif
