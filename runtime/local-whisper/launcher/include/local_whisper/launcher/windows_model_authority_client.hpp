#pragma once

#ifdef _WIN32

#include "local_whisper/common/model_authority.hpp"

#define NOMINMAX
#include <windows.h>

namespace local_whisper::launcher {

class WindowsModelAuthorityClient final {
public:
  [[nodiscard]] static local_whisper::common::AuthorityTransfer
  duplicate_to_worker(const local_whisper::common::AuthorityTransfer& launcher_transfer,
                      HANDLE launcher_model_handle, HANDLE worker_process);

  static void close_unconfirmed_worker_duplicate(
      const local_whisper::common::AuthorityTransfer& worker_transfer,
      HANDLE worker_process) noexcept;

  static void validate_worker_acknowledgment(
      const local_whisper::common::AuthorityAcknowledgment& acknowledgment,
      const local_whisper::common::AuthorityBinding& binding, HANDLE worker_model_handle,
      DWORD worker_pid);
};

} // namespace local_whisper::launcher

#endif
