#pragma once

#include <cstdint>

namespace local_whisper::common {

// FILE_SHARE_READ without a windows.h dependency. A verified executable stays open with this
// policy until CreateProcessW has selected its image, preventing concurrent byte or name changes.
inline constexpr std::uint32_t kVerifiedExecutableShareMode = 0x00000001U;

} // namespace local_whisper::common
