#include "local_whisper/common/windows_process_identity.hpp"

#ifdef _WIN32

#include "local_whisper/common/sha256.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <stdexcept>

namespace local_whisper::common {
namespace {

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE value) noexcept : value_(value) {}
  ~UniqueHandle() noexcept {
    if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE)
      static_cast<void>(CloseHandle(value_));
  }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  [[nodiscard]] HANDLE get() const noexcept { return value_; }

private:
  HANDLE value_;
};

} // namespace

std::array<std::uint8_t, 32> windows_process_start_identity_sha256(HANDLE process) {
  // INVALID_HANDLE_VALUE is also the documented current-process pseudo-handle.
  if (process == nullptr)
    throw std::runtime_error("Windows process identity handle invalid");
  FILETIME creation{};
  FILETIME exit{};
  FILETIME kernel{};
  FILETIME user{};
  const DWORD process_id = GetProcessId(process);
  if (process_id == 0U || !GetProcessTimes(process, &creation, &exit, &kernel, &user))
    throw std::runtime_error("Windows process identity unavailable");
  const std::uint64_t ticks =
      (static_cast<std::uint64_t>(creation.dwHighDateTime) << 32U) | creation.dwLowDateTime;
  const std::uint64_t process_id_value = process_id;
  std::array<std::uint8_t, 20> input{};
  constexpr std::array<std::uint8_t, 4> domain = {'L', 'W', 'P', 'S'};
  std::copy(domain.begin(), domain.end(), input.begin());
  for (std::size_t index = 0; index < 8U; ++index) {
    input[4U + index] = static_cast<std::uint8_t>(process_id_value >> ((7U - index) * 8U));
    input[12U + index] = static_cast<std::uint8_t>(ticks >> ((7U - index) * 8U));
  }
  return sha256(input);
}

std::array<std::uint8_t, 32> windows_process_start_identity_sha256(DWORD process_id) {
  UniqueHandle process(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id));
  return windows_process_start_identity_sha256(process.get());
}

} // namespace local_whisper::common

#endif
