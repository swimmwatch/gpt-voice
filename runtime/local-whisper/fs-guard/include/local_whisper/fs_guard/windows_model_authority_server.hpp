#pragma once

#ifdef _WIN32

#include "local_whisper/common/model_authority.hpp"

#define NOMINMAX
#include <windows.h>

namespace local_whisper::fs_guard {

class WindowsModelAuthorityServer final {
public:
  [[nodiscard]] static local_whisper::common::AuthorityTransfer
  duplicate_to_launcher(HANDLE guarded_model_handle, HANDLE launcher_process,
                        const local_whisper::common::AuthorityBinding& binding);
};

} // namespace local_whisper::fs_guard

#endif
