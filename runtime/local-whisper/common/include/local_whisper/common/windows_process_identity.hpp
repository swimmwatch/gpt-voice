#pragma once

#ifdef _WIN32

#define NOMINMAX
#include <windows.h>

#include <array>
#include <cstdint>

namespace local_whisper::common {

[[nodiscard]] std::array<std::uint8_t, 32> windows_process_start_identity_sha256(HANDLE process);
[[nodiscard]] std::array<std::uint8_t, 32> windows_process_start_identity_sha256(DWORD process_id);

} // namespace local_whisper::common

#endif
