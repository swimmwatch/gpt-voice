#include "local_whisper/common/device_proof.hpp"
#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/engine.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/exact_model_reader.hpp"
#include "local_whisper/whisper_cpp/pcm_audio.hpp"
#include "local_whisper/whisper_cpp/qualification_protocol.hpp"

#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include <unistd.h>

namespace {

using local_whisper::whisper_cpp::CoreError;
using local_whisper::whisper_cpp::DeviceOperationAuthority;
using local_whisper::whisper_cpp::FailureCode;
using local_whisper::whisper_cpp::QualificationCommand;
using local_whisper::whisper_cpp::WhisperCppEngine;

constexpr std::string_view kQualificationAuthorityId = "UVFRUVFRUVFRUVFRUVFRUQ";
constexpr std::string_view kQualificationChallenge = "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE";

std::vector<std::uint8_t> read_command() {
  std::vector<std::uint8_t> bytes;
  bytes.reserve(local_whisper::whisper_cpp::kQualificationCommandMaxBytes);
  std::array<std::uint8_t, 1024U> buffer{};
  while (true) {
    const ssize_t count = read(STDIN_FILENO, buffer.data(), buffer.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count < 0)
      throw CoreError(FailureCode::invalid_settings, "qualification command read failed");
    if (count == 0)
      break;
    if (bytes.size() + static_cast<std::size_t>(count) >
        local_whisper::whisper_cpp::kQualificationCommandMaxBytes) {
      throw CoreError(FailureCode::invalid_settings, "qualification command is too large");
    }
    bytes.insert(bytes.end(), buffer.begin(), buffer.begin() + static_cast<std::ptrdiff_t>(count));
  }
  return bytes;
}

void write_exact(int descriptor, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = write(descriptor, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw CoreError(FailureCode::transcription_failed, "qualification output failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

std::optional<DeviceOperationAuthority>
device_authority(WhisperCppEngine& engine, const QualificationCommand& command,
                 const local_whisper::whisper_cpp::CancellationToken& cancellation) {
  const bool gpu_backend = engine.backend() != local_whisper::whisper_cpp::EngineBackend::cpu;
  if (gpu_backend != command.selected_ordinal.has_value())
    throw CoreError(FailureCode::invalid_settings,
                    "qualification backend and selected device differ");
  if (!gpu_backend)
    return std::nullopt;
  const auto registry = engine.capture_device_registry();
  const auto fingerprint = local_whisper::common::registry_fingerprint(registry);
  DeviceOperationAuthority authority{{std::string(kQualificationAuthorityId), 1U, 1U},
                                     std::string(kQualificationChallenge),
                                     fingerprint,
                                     *command.selected_ordinal};
  const auto probe = engine.probe_device(authority, cancellation);
  if (probe.activated_ordinal != *command.selected_ordinal ||
      probe.registry_fingerprint != fingerprint)
    throw CoreError(FailureCode::device_proof_failed,
                    "qualification device proof did not match selection");
  return authority;
}

int run() {
  const auto command_bytes = read_command();
  const auto command = local_whisper::whisper_cpp::parse_qualification_command(command_bytes);
  local_whisper::whisper_cpp::QualificationModelSource source(
      local_whisper::whisper_cpp::kQualificationModelDescriptor);
  local_whisper::whisper_cpp::ExactModelReader model(source, command.model_size_bytes,
                                                     command.model_sha256);
  const auto wav = local_whisper::whisper_cpp::read_qualification_wav(
      local_whisper::whisper_cpp::kQualificationWavDescriptor, command.wav_size_bytes,
      command.wav_sha256);
  const auto audio = local_whisper::whisper_cpp::PcmAudio::from_canonical_wav(wav);
  local_whisper::whisper_cpp::CancellationController cancellation;
  WhisperCppEngine engine;
  const auto authority = device_authority(engine, command, cancellation);
  engine.load(model, command.family, command.variant, authority, cancellation);
  engine.warm_up(command.cpu_threads, cancellation);
  if (authority.has_value())
    static_cast<void>(engine.load_evidence(*authority));
  const local_whisper::whisper_cpp::TranscriptionOptions options{
      command.language,   "", 0U, local_whisper::whisper_cpp::DecodingStrategy::greedy, 1U,
      command.cpu_threads};
  const auto transcript = engine.transcribe(audio.samples(), options, cancellation);
  engine.unload();
  write_exact(STDOUT_FILENO,
              std::span<const std::uint8_t>(
                  reinterpret_cast<const std::uint8_t*>(transcript.data()), transcript.size()));
  return 0;
}

void write_failure(std::string_view code) noexcept {
  static_cast<void>(std::fprintf(stderr,
                                 "{\"schemaVersion\":1,\"status\":\"error\",\"code\":\"%.*s\"}\n",
                                 static_cast<int>(code.size()), code.data()));
}

} // namespace

int main() {
  try {
    return run();
  } catch (const CoreError& error) {
    write_failure(local_whisper::whisper_cpp::failure_code_name(error.code()));
    return 20;
  } catch (...) {
    write_failure("INTERNAL_ERROR");
    return 21;
  }
}
