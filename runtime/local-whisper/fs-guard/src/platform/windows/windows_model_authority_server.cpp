#include "local_whisper/fs_guard/windows_model_authority_server.hpp"

#ifdef _WIN32

#include <cstdint>
#include <stdexcept>

namespace local_whisper::fs_guard {

local_whisper::common::AuthorityTransfer WindowsModelAuthorityServer::duplicate_to_launcher(
    HANDLE guarded_model_handle, HANDLE launcher_process,
    const local_whisper::common::AuthorityBinding& binding) {
  if (guarded_model_handle == nullptr || guarded_model_handle == INVALID_HANDLE_VALUE ||
      launcher_process == nullptr || launcher_process == INVALID_HANDLE_VALUE) {
    throw std::runtime_error("invalid Windows model authority handle");
  }
  FILE_STANDARD_INFO information{};
  if (!GetFileInformationByHandleEx(guarded_model_handle, FileStandardInfo, &information,
                                    sizeof(information)) ||
      information.Directory !=
          (binding.artifact_kind == local_whisper::common::AuthorityArtifactKind::directory)) {
    throw std::runtime_error("Windows model authority type changed");
  }
  HANDLE launcher_handle = INVALID_HANDLE_VALUE;
  if (!DuplicateHandle(GetCurrentProcess(), guarded_model_handle, launcher_process,
                       &launcher_handle, 0, FALSE, DUPLICATE_SAME_ACCESS) ||
      launcher_handle == nullptr || launcher_handle == INVALID_HANDLE_VALUE) {
    throw std::runtime_error("Windows model authority duplication failed");
  }
  return {binding, 1, local_whisper::common::AuthorityCarrierKind::windows_launcher_handle,
          static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(launcher_handle))};
}

} // namespace local_whisper::fs_guard

#endif
