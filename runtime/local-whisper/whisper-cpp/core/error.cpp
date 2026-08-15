#include "local_whisper/whisper_cpp/error.hpp"

namespace local_whisper::whisper_cpp {

CoreError::CoreError(FailureCode code, const char* safe_message)
    : std::runtime_error(safe_message), code_(code) {}

FailureCode CoreError::code() const noexcept { return code_; }

std::string_view failure_code_name(FailureCode code) noexcept {
  switch (code) {
  case FailureCode::runtime_prerequisite_missing:
    return "RUNTIME_PREREQUISITE_MISSING";
  case FailureCode::device_not_allowlisted:
    return "DEVICE_NOT_ALLOWLISTED";
  case FailureCode::device_not_found:
    return "DEVICE_NOT_FOUND";
  case FailureCode::device_feature_missing:
    return "DEVICE_FEATURE_MISSING";
  case FailureCode::device_proof_failed:
    return "DEVICE_PROOF_FAILED";
  case FailureCode::backend_unsupported:
    return "BACKEND_UNSUPPORTED";
  case FailureCode::target_unsupported:
    return "TARGET_UNSUPPORTED";
  case FailureCode::driver_incompatible:
    return "DRIVER_INCOMPATIBLE";
  case FailureCode::gpu_permission_denied:
    return "GPU_PERMISSION_DENIED";
  case FailureCode::backend_init_failed:
    return "BACKEND_INIT_FAILED";
  case FailureCode::model_authority_invalid:
    return "MODEL_AUTHORITY_INVALID";
  case FailureCode::model_corrupt:
    return "MODEL_CORRUPT";
  case FailureCode::model_load_failed:
    return "MODEL_LOAD_FAILED";
  case FailureCode::warmup_failed:
    return "WARMUP_FAILED";
  case FailureCode::allocation_failed:
    return "ALLOCATION_FAILED";
  case FailureCode::invalid_settings:
    return "INVALID_SETTINGS";
  case FailureCode::audio_format_unsupported:
    return "AUDIO_FORMAT_UNSUPPORTED";
  case FailureCode::transcription_failed:
    return "TRANSCRIPTION_FAILED";
  case FailureCode::not_ready:
    return "NOT_READY";
  case FailureCode::cleanup_failed:
    return "CLEANUP_FAILED";
  case FailureCode::cancelled:
    return "CANCELLED";
  }
  return "TRANSCRIPTION_FAILED";
}

} // namespace local_whisper::whisper_cpp
