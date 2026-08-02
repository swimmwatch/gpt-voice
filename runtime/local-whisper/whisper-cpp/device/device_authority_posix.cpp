#include "local_whisper/whisper_cpp/device_authority.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cerrno>
#include <span>

#include <unistd.h>

namespace local_whisper::whisper_cpp {

DeviceAuthority DeviceAuthority::receive_from_standard_channel() {
  std::array<std::uint8_t, kDeviceAuthorityRecordBytes> record{};
  std::span<std::uint8_t> remaining(record);
  while (!remaining.empty()) {
    const auto count = read(STDIN_FILENO, remaining.data(), remaining.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw CoreError(FailureCode::device_proof_failed, "device authority read failed");
    remaining = remaining.subspan(static_cast<std::size_t>(count));
  }
  return decode(record);
}

} // namespace local_whisper::whisper_cpp
