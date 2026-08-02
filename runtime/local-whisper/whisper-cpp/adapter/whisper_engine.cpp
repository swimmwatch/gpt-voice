#include "local_whisper/whisper_cpp/engine.hpp"

#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/loader_limits.hpp"
#include "local_whisper/whisper_cpp/model_format_preflight.hpp"

#include <whisper.h>

#include <cstddef>
#include <cstdint>
#include <limits>
#include <memory>
#include <new>
#include <span>
#include <string>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

void discard_upstream_log(enum ggml_log_level, const char*, void*) {}

std::size_t exact_loader_read(void* context, void* output, std::size_t size) {
  auto& reader = *static_cast<ExactModelReader*>(context);
  reader.read_exact(std::span<std::uint8_t>(static_cast<std::uint8_t*>(output), size));
  return size;
}

bool exact_loader_eof(void* context) { return static_cast<ExactModelReader*>(context)->eof(); }

void exact_loader_close(void* context) { static_cast<ExactModelReader*>(context)->close(); }

class ContextOwner final {
public:
  explicit ContextOwner(whisper_context* context = nullptr) noexcept : context_(context) {}
  ~ContextOwner() noexcept { reset(); }

  ContextOwner(const ContextOwner&) = delete;
  ContextOwner& operator=(const ContextOwner&) = delete;

  [[nodiscard]] whisper_context* get() const noexcept { return context_; }
  void reset(whisper_context* context = nullptr) noexcept {
    if (context_ != nullptr)
      whisper_free(context_);
    context_ = context;
  }

private:
  whisper_context* context_;
};

whisper_sampling_strategy native_strategy(DecodingStrategy strategy) {
  return strategy == DecodingStrategy::beam_search ? WHISPER_SAMPLING_BEAM_SEARCH
                                                   : WHISPER_SAMPLING_GREEDY;
}

whisper_full_params inference_parameters(const TranscriptionOptions& options) {
  if (options.cpu_threads == 0U || options.cpu_threads > 256U ||
      options.temperature_hundredths > 100U || options.temperature_hundredths % 5U != 0U ||
      options.candidate_count == 0U || options.candidate_count > 20U ||
      (!options.language.empty() && options.language != "auto" &&
       whisper_lang_id(options.language.c_str()) < 0)) {
    throw CoreError(FailureCode::invalid_settings, "invalid engine transcription settings");
  }
  auto parameters = whisper_full_default_params(native_strategy(options.strategy));
  parameters.n_threads = static_cast<int>(options.cpu_threads);
  parameters.translate = false;
  parameters.no_context = true;
  parameters.no_timestamps = true;
  parameters.single_segment = false;
  parameters.print_special = false;
  parameters.print_progress = false;
  parameters.print_realtime = false;
  parameters.print_timestamps = false;
  parameters.token_timestamps = false;
  parameters.debug_mode = false;
  parameters.tdrz_enable = false;
  parameters.initial_prompt =
      options.initial_prompt.empty() ? nullptr : options.initial_prompt.c_str();
  parameters.carry_initial_prompt = false;
  parameters.language = options.language.empty() ? nullptr : options.language.c_str();
  parameters.detect_language = options.language.empty() || options.language == "auto";
  parameters.temperature = static_cast<float>(options.temperature_hundredths) / 100.0F;
  parameters.temperature_inc = 0.0F;
  parameters.vad = false;
  parameters.vad_model_path = nullptr;
  if (options.strategy == DecodingStrategy::beam_search)
    parameters.beam_search.beam_size = static_cast<int>(options.candidate_count);
  else
    parameters.greedy.best_of = static_cast<int>(options.candidate_count);
  return parameters;
}

} // namespace

class WhisperCppEngine::Impl final {
public:
  void load(ExactModelReader& reader, const std::string& family, const std::string& variant) {
    if (context_.get() != nullptr)
      throw CoreError(FailureCode::model_load_failed, "engine already loaded");
    ModelFormatPreflight preflight{LoaderLimits()};
    static_cast<void>(preflight.validate(reader, family, variant));
    reader.rewind_after_verified_pass();
    whisper_log_set(discard_upstream_log, nullptr);
    whisper_context_params parameters = whisper_context_default_params();
    parameters.use_gpu = false;
    parameters.flash_attn = false;
    parameters.gpu_device = 0;
    parameters.dtw_token_timestamps = false;
    whisper_model_loader loader{&reader, exact_loader_read, exact_loader_eof, exact_loader_close};
    whisper_context* loaded = whisper_init_with_params(&loader, parameters);
    if (loaded == nullptr) {
      if (reader.offset() != reader.expected_bytes())
        throw CoreError(FailureCode::model_corrupt,
                        "model loader stopped before authenticated EOF");
      reader.verify_complete();
      throw CoreError(FailureCode::model_load_failed, "Whisper.cpp rejected validated model");
    }
    try {
      reader.verify_complete();
    } catch (...) {
      whisper_free(loaded);
      throw;
    }
    if (reader.close_count() != 1U) {
      whisper_free(loaded);
      throw CoreError(FailureCode::model_corrupt, "model loader close contract failed");
    }
    context_.reset(loaded);
  }

  void warm_up(std::uint32_t cpu_threads) {
    if (context_.get() == nullptr)
      throw CoreError(FailureCode::model_load_failed, "warm-up requires loaded model");
    constexpr std::size_t kWarmupSamples = 1'600U;
    const std::vector<float> silence(kWarmupSamples, 0.0F);
    const TranscriptionOptions options{"en", "", 0U, DecodingStrategy::greedy, 1U, cpu_threads};
    const auto parameters = inference_parameters(options);
    if (whisper_full(context_.get(), parameters, silence.data(),
                     static_cast<int>(silence.size())) != 0) {
      throw CoreError(FailureCode::model_load_failed, "fixed CPU warm-up failed");
    }
  }

  std::string transcribe(std::span<const float> samples, const TranscriptionOptions& options) {
    if (context_.get() == nullptr || samples.empty() ||
        samples.size() > static_cast<std::size_t>(std::numeric_limits<int>::max())) {
      throw CoreError(FailureCode::transcription_failed, "invalid engine transcription state");
    }
    const auto parameters = inference_parameters(options);
    if (whisper_full(context_.get(), parameters, samples.data(),
                     static_cast<int>(samples.size())) != 0) {
      throw CoreError(FailureCode::transcription_failed, "CPU inference failed");
    }
    std::string text;
    const int segments = whisper_full_n_segments(context_.get());
    if (segments < 0)
      throw CoreError(FailureCode::transcription_failed, "invalid engine segment count");
    for (int index = 0; index < segments; ++index) {
      const char* segment = whisper_full_get_segment_text(context_.get(), index);
      if (segment == nullptr)
        throw CoreError(FailureCode::transcription_failed, "invalid engine transcript segment");
      text += segment;
    }
    return text;
  }

  void unload() noexcept { context_.reset(); }
  [[nodiscard]] bool loaded() const noexcept { return context_.get() != nullptr; }

private:
  ContextOwner context_;
};

WhisperCppEngine::WhisperCppEngine() : impl_(std::make_unique<Impl>()) {}
WhisperCppEngine::~WhisperCppEngine() noexcept = default;
void WhisperCppEngine::load(ExactModelReader& reader, const std::string& family,
                            const std::string& variant) {
  try {
    impl_->load(reader, family, variant);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "engine allocation failed");
  }
}
void WhisperCppEngine::warm_up(std::uint32_t cpu_threads) {
  try {
    impl_->warm_up(cpu_threads);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "warm-up allocation failed");
  }
}
std::string WhisperCppEngine::transcribe(std::span<const float> samples,
                                         const TranscriptionOptions& options) {
  try {
    return impl_->transcribe(samples, options);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "inference allocation failed");
  }
}
void WhisperCppEngine::unload() noexcept { impl_->unload(); }
bool WhisperCppEngine::loaded() const noexcept { return impl_->loaded(); }

} // namespace local_whisper::whisper_cpp
