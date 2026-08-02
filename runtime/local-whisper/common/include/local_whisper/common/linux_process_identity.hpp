#pragma once

#include <array>
#include <cstdint>

#include <sys/types.h>

namespace local_whisper::common {

[[nodiscard]] std::array<std::uint8_t, 32> linux_process_start_identity_sha256(pid_t process_id);

} // namespace local_whisper::common
