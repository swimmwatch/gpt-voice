#pragma once

#include <stdexcept>
#include <string_view>

namespace local_whisper::whisper_cpp {

enum class FailureCode {
  model_authority_invalid,
  model_corrupt,
  model_load_failed,
  allocation_failed,
  invalid_settings,
  audio_format_unsupported,
  transcription_failed,
  not_ready,
  cancelled,
};

class CoreError final : public std::runtime_error {
public:
  CoreError(FailureCode code, const char* safe_message);

  [[nodiscard]] FailureCode code() const noexcept;

private:
  FailureCode code_;
};

[[nodiscard]] std::string_view failure_code_name(FailureCode code) noexcept;

} // namespace local_whisper::whisper_cpp
