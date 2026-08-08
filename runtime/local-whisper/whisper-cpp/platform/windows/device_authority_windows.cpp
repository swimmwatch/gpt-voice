#include "local_whisper/whisper_cpp/device_authority.hpp"

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <span>

namespace local_whisper::whisper_cpp {

DeviceAuthority DeviceAuthority::receive_from_standard_channel() {
  std::array<std::uint8_t, kDeviceAuthorityRecordBytes> record{};
  std::span<std::uint8_t> remaining(record);
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  while (!remaining.empty()) {
    DWORD count = 0U;
    if (!ReadFile(input, remaining.data(), static_cast<DWORD>(remaining.size()), &count, nullptr) ||
        count == 0U)
      throw CoreError(FailureCode::device_proof_failed, "Windows device authority read failed");
    remaining = remaining.subspan(count);
  }
  return decode(record);
}

} // namespace local_whisper::whisper_cpp

#endif
