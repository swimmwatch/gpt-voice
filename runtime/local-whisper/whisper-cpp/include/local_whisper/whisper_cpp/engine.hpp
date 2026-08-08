#pragma once

#include "local_whisper/common/device_proof.hpp"
#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/device_authority.hpp"
#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include <cstdint>
#include <memory>
#include <optional>
#include <span>
#include <string>

namespace local_whisper::whisper_cpp {

enum class DecodingStrategy { greedy, beam_search, best_of_sampling };
enum class EngineBackend { cpu, cuda, hip, vulkan };

struct DeviceOperationAuthority final {
  DeviceProofAuthority proof_authority;
  std::string challenge;
  std::string registry_fingerprint;
  std::uint16_t selected_ordinal;
};

struct DeviceProbeEvidence final {
  std::uint16_t activated_ordinal;
  std::string actual_native_identity;
  std::string primary_execution_native_identity;
  std::string registry_fingerprint;
  std::string probe_proof;
};

struct DeviceLoadEvidence final {
  std::uint16_t activated_ordinal;
  std::string actual_native_identity;
  std::string primary_execution_native_identity;
  std::string registry_fingerprint;
  std::uint64_t selected_device_model_weight_bytes;
  std::string load_proof;
};

struct TranscriptionOptions final {
  std::string language;
  std::string initial_prompt;
  std::uint32_t temperature_hundredths;
  DecodingStrategy strategy;
  std::uint32_t candidate_count;
  std::uint32_t cpu_threads;
};

class SpeechEngine {
public:
  virtual ~SpeechEngine() = default;

  [[nodiscard]] virtual EngineBackend backend() const noexcept = 0;
  [[nodiscard]] virtual DeviceProbeEvidence probe_device(const DeviceOperationAuthority& authority,
                                                         const CancellationToken& cancellation) = 0;
  virtual void load(ExactModelReader& reader, const std::string& family, const std::string& variant,
                    const std::optional<DeviceOperationAuthority>& authority,
                    const CancellationToken& cancellation) = 0;
  virtual void warm_up(std::uint32_t cpu_threads, const CancellationToken& cancellation) = 0;
  [[nodiscard]] virtual DeviceLoadEvidence
  load_evidence(const DeviceOperationAuthority& authority) const = 0;
  [[nodiscard]] virtual std::string transcribe(std::span<const float> samples,
                                               const TranscriptionOptions& options,
                                               const CancellationToken& cancellation) = 0;
  virtual void unload() noexcept = 0;
  [[nodiscard]] virtual bool loaded() const noexcept = 0;
};

class WhisperCppEngine final : public SpeechEngine {
public:
  WhisperCppEngine();
  ~WhisperCppEngine() noexcept override;

  WhisperCppEngine(const WhisperCppEngine&) = delete;
  WhisperCppEngine& operator=(const WhisperCppEngine&) = delete;

  [[nodiscard]] local_whisper::common::DeviceRegistry capture_device_registry();
  [[nodiscard]] EngineBackend backend() const noexcept override;
  [[nodiscard]] DeviceProbeEvidence probe_device(const DeviceOperationAuthority& authority,
                                                 const CancellationToken& cancellation) override;
  void load(ExactModelReader& reader, const std::string& family, const std::string& variant,
            const std::optional<DeviceOperationAuthority>& authority,
            const CancellationToken& cancellation) override;
  void warm_up(std::uint32_t cpu_threads, const CancellationToken& cancellation) override;
  [[nodiscard]] DeviceLoadEvidence
  load_evidence(const DeviceOperationAuthority& authority) const override;
  [[nodiscard]] std::string transcribe(std::span<const float> samples,
                                       const TranscriptionOptions& options,
                                       const CancellationToken& cancellation) override;
  void unload() noexcept override;
  [[nodiscard]] bool loaded() const noexcept override;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::whisper_cpp
