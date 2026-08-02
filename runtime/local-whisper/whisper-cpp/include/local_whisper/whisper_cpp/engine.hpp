#pragma once

#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include <cstdint>
#include <memory>
#include <span>
#include <string>

namespace local_whisper::whisper_cpp {

enum class DecodingStrategy { greedy, beam_search, best_of_sampling };

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

  virtual void load(ExactModelReader& reader, const std::string& family,
                    const std::string& variant) = 0;
  virtual void warm_up(std::uint32_t cpu_threads) = 0;
  [[nodiscard]] virtual std::string transcribe(std::span<const float> samples,
                                               const TranscriptionOptions& options) = 0;
  virtual void unload() noexcept = 0;
  [[nodiscard]] virtual bool loaded() const noexcept = 0;
};

class WhisperCppEngine final : public SpeechEngine {
public:
  WhisperCppEngine();
  ~WhisperCppEngine() noexcept override;

  WhisperCppEngine(const WhisperCppEngine&) = delete;
  WhisperCppEngine& operator=(const WhisperCppEngine&) = delete;

  void load(ExactModelReader& reader, const std::string& family,
            const std::string& variant) override;
  void warm_up(std::uint32_t cpu_threads) override;
  [[nodiscard]] std::string transcribe(std::span<const float> samples,
                                       const TranscriptionOptions& options) override;
  void unload() noexcept override;
  [[nodiscard]] bool loaded() const noexcept override;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::whisper_cpp
