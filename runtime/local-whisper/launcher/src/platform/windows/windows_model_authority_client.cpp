#include "local_whisper/launcher/windows_model_authority_client.hpp"

#ifdef _WIN32

#include <cstdint>
#include <stdexcept>

namespace local_whisper::launcher {

local_whisper::common::AuthorityTransfer WindowsModelAuthorityClient::duplicate_to_worker(
    const local_whisper::common::AuthorityTransfer& launcher_transfer, HANDLE launcher_model_handle,
    HANDLE worker_process) {
  const auto launcher_value =
      static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(launcher_model_handle));
  if (launcher_transfer.hop != 1U ||
      launcher_transfer.carrier_kind !=
          local_whisper::common::AuthorityCarrierKind::windows_launcher_handle ||
      launcher_transfer.carrier_value != launcher_value || launcher_value == 0U ||
      worker_process == nullptr || worker_process == INVALID_HANDLE_VALUE) {
    throw std::runtime_error("invalid Windows launcher model authority");
  }
  FILE_STANDARD_INFO information{};
  if (!GetFileInformationByHandleEx(launcher_model_handle, FileStandardInfo, &information,
                                    sizeof(information)) ||
      information.Directory != (launcher_transfer.binding.artifact_kind ==
                                local_whisper::common::AuthorityArtifactKind::directory)) {
    throw std::runtime_error("Windows launcher model authority type changed");
  }
  HANDLE worker_model_handle = INVALID_HANDLE_VALUE;
  if (!DuplicateHandle(GetCurrentProcess(), launcher_model_handle, worker_process,
                       &worker_model_handle, 0, TRUE, DUPLICATE_SAME_ACCESS) ||
      worker_model_handle == nullptr || worker_model_handle == INVALID_HANDLE_VALUE) {
    throw std::runtime_error("Windows worker model authority duplication failed");
  }
  return {launcher_transfer.binding, 2,
          local_whisper::common::AuthorityCarrierKind::windows_worker_handle,
          static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(worker_model_handle))};
}

void WindowsModelAuthorityClient::close_unconfirmed_worker_duplicate(
    const local_whisper::common::AuthorityTransfer& worker_transfer,
    HANDLE worker_process) noexcept {
  if (worker_transfer.hop != 2U ||
      worker_transfer.carrier_kind !=
          local_whisper::common::AuthorityCarrierKind::windows_worker_handle ||
      worker_transfer.carrier_value == 0U || worker_process == nullptr ||
      worker_process == INVALID_HANDLE_VALUE) {
    return;
  }
  HANDLE local_duplicate = INVALID_HANDLE_VALUE;
  const HANDLE worker_model =
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(worker_transfer.carrier_value));
  if (DuplicateHandle(worker_process, worker_model, GetCurrentProcess(), &local_duplicate, 0, FALSE,
                      DUPLICATE_SAME_ACCESS | DUPLICATE_CLOSE_SOURCE) &&
      local_duplicate != nullptr && local_duplicate != INVALID_HANDLE_VALUE) {
    static_cast<void>(CloseHandle(local_duplicate));
  }
}

void WindowsModelAuthorityClient::validate_worker_acknowledgment(
    const local_whisper::common::AuthorityAcknowledgment& acknowledgment,
    const local_whisper::common::AuthorityBinding& binding, HANDLE worker_model_handle,
    DWORD worker_pid) {
  const auto worker_value =
      static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(worker_model_handle));
  if (acknowledgment.binding != binding ||
      acknowledgment.carrier_kind !=
          local_whisper::common::AuthorityCarrierKind::windows_worker_handle ||
      acknowledgment.carrier_value != worker_value || worker_value == 0U ||
      acknowledgment.worker_pid != worker_pid) {
    throw std::runtime_error("invalid Windows worker authority acknowledgment");
  }
}

} // namespace local_whisper::launcher

#endif
