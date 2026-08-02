#include "local_whisper/whisper_cpp/engine.hpp"

#include "local_whisper/common/device_proof.hpp"
#include "local_whisper/whisper_cpp/device_registry.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/loader_limits.hpp"
#include "local_whisper/whisper_cpp/model_format_preflight.hpp"

#include <ggml-backend.h>
#include <ggml.h>
#include <whisper.h>

#include <array>
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

constexpr std::string_view kEngineId = "whisperCpp";
constexpr std::string_view kBackendId = LOCAL_WHISPER_BACKEND_ID;
constexpr std::string_view kRuntimeDigest = LOCAL_WHISPER_RUNTIME_BUILD_DIGEST;
constexpr bool kGpuWorker = kBackendId != "cpu";

constexpr std::string_view backend_registry_name() {
  if (kBackendId == "cuda")
    return "CUDA";
  if (kBackendId == "hip")
    return "ROCm";
  if (kBackendId == "vulkan")
    return "Vulkan";
  return {};
}

constexpr EngineBackend engine_backend() {
  if (kBackendId == "cuda")
    return EngineBackend::cuda;
  if (kBackendId == "hip")
    return EngineBackend::hip;
  if (kBackendId == "vulkan")
    return EngineBackend::vulkan;
  return EngineBackend::cpu;
}

void discard_upstream_log(enum ggml_log_level, const char*, void*) {}

std::size_t exact_loader_read(void* context, void* output, std::size_t size) {
  auto& reader = *static_cast<ExactModelReader*>(context);
  reader.read_exact(std::span<std::uint8_t>(static_cast<std::uint8_t*>(output), size));
  return size;
}

bool exact_loader_eof(void* context) { return static_cast<ExactModelReader*>(context)->eof(); }
void exact_loader_close(void* context) { static_cast<ExactModelReader*>(context)->close(); }

bool abort_requested(void* context) noexcept {
  return static_cast<const CancellationToken*>(context)->requested();
}

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

class BackendOwner final {
public:
  explicit BackendOwner(ggml_backend_t backend = nullptr) noexcept : backend_(backend) {}
  ~BackendOwner() noexcept {
    if (backend_ != nullptr)
      ggml_backend_free(backend_);
  }
  BackendOwner(const BackendOwner&) = delete;
  BackendOwner& operator=(const BackendOwner&) = delete;
  [[nodiscard]] ggml_backend_t get() const noexcept { return backend_; }

private:
  ggml_backend_t backend_;
};

class GgmlContextOwner final {
public:
  explicit GgmlContextOwner(ggml_context* context) noexcept : context_(context) {}
  ~GgmlContextOwner() noexcept {
    if (context_ != nullptr)
      ggml_free(context_);
  }
  GgmlContextOwner(const GgmlContextOwner&) = delete;
  GgmlContextOwner& operator=(const GgmlContextOwner&) = delete;
  [[nodiscard]] ggml_context* get() const noexcept { return context_; }

private:
  ggml_context* context_;
};

class BufferOwner final {
public:
  explicit BufferOwner(ggml_backend_buffer_t buffer) noexcept : buffer_(buffer) {}
  ~BufferOwner() noexcept {
    if (buffer_ != nullptr)
      ggml_backend_buffer_free(buffer_);
  }
  BufferOwner(const BufferOwner&) = delete;
  BufferOwner& operator=(const BufferOwner&) = delete;
  [[nodiscard]] ggml_backend_buffer_t get() const noexcept { return buffer_; }

private:
  ggml_backend_buffer_t buffer_;
};

class AbortInstallation final {
public:
  AbortInstallation(whisper_context* context, const CancellationToken& cancellation)
      : context_(context) {
    if (!whisper_local_set_abort_callback(context_, abort_requested,
                                          const_cast<CancellationToken*>(&cancellation)))
      throw CoreError(FailureCode::backend_init_failed,
                      "execution backend lacks cooperative abort support");
  }
  ~AbortInstallation() noexcept {
    static_cast<void>(whisper_local_set_abort_callback(context_, nullptr, nullptr));
  }
  AbortInstallation(const AbortInstallation&) = delete;
  AbortInstallation& operator=(const AbortInstallation&) = delete;

private:
  whisper_context* context_;
};

class GgmlDeviceDiscovery final : public NativeDeviceDiscovery {
public:
  [[nodiscard]] std::vector<NativeDevice> enumerate() override {
    std::vector<NativeDevice> result;
    for (std::size_t index = 0; index < ggml_backend_dev_count(); ++index) {
      ggml_backend_dev_t device = ggml_backend_dev_get(index);
      const auto type = ggml_backend_dev_type(device);
      if (type != GGML_BACKEND_DEVICE_TYPE_GPU && type != GGML_BACKEND_DEVICE_TYPE_IGPU)
        continue;
      ggml_backend_reg_t registry = ggml_backend_dev_backend_reg(device);
      const char* registry_name = registry == nullptr ? nullptr : ggml_backend_reg_name(registry);
      if (registry_name == nullptr || std::string_view(registry_name) != backend_registry_name())
        continue;
      ggml_backend_dev_props properties{};
      ggml_backend_dev_get_props(device, &properties);
      result.push_back({type == GGML_BACKEND_DEVICE_TYPE_GPU
                            ? local_whisper::common::RegistryDeviceType::gpu
                            : local_whisper::common::RegistryDeviceType::integrated_gpu,
                        std::string(kBackendId),
                        properties.device_id == nullptr ? std::string() : properties.device_id,
                        reinterpret_cast<std::uintptr_t>(device)});
    }
    return result;
  }
};

whisper_sampling_strategy native_strategy(DecodingStrategy strategy) {
  return strategy == DecodingStrategy::beam_search ? WHISPER_SAMPLING_BEAM_SEARCH
                                                   : WHISPER_SAMPLING_GREEDY;
}

whisper_full_params inference_parameters(const TranscriptionOptions& options,
                                         const CancellationToken& cancellation) {
  if (options.cpu_threads == 0U || options.cpu_threads > 256U ||
      options.temperature_hundredths > 100U || options.temperature_hundredths % 5U != 0U ||
      options.candidate_count == 0U || options.candidate_count > 20U ||
      (!options.language.empty() && options.language != "auto" &&
       whisper_lang_id(options.language.c_str()) < 0))
    throw CoreError(FailureCode::invalid_settings, "invalid engine transcription settings");
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
  parameters.abort_callback = abort_requested;
  parameters.abort_callback_user_data = const_cast<CancellationToken*>(&cancellation);
  if (options.strategy == DecodingStrategy::beam_search)
    parameters.beam_search.beam_size = static_cast<int>(options.candidate_count);
  else
    parameters.greedy.best_of = static_cast<int>(options.candidate_count);
  return parameters;
}

local_whisper::common::DeviceProofInput proof_input(const DeviceOperationAuthority& authority,
                                                    const DeviceProbeEvidence& evidence,
                                                    std::uint64_t model_weight_bytes) {
  return {authority.proof_authority.authority_id,
          authority.challenge,
          authority.proof_authority.configuration_epoch,
          authority.proof_authority.topology_generation,
          std::string(kEngineId),
          std::string(kRuntimeDigest),
          std::string(kBackendId),
          evidence.registry_fingerprint,
          authority.selected_ordinal,
          evidence.activated_ordinal,
          evidence.actual_native_identity,
          evidence.primary_execution_native_identity,
          model_weight_bytes};
}

DeviceProbeEvidence base_evidence(const SelectedDevice& selection, std::string primary_identity) {
  return {selection.ordinal,
          selection.native_identity,
          std::move(primary_identity),
          selection.registry_fingerprint,
          {}};
}

void deterministic_device_dispatch(ggml_backend_t backend, ggml_backend_dev_t device,
                                   const CancellationToken& cancellation) {
  if (cancellation.requested())
    throw CoreError(FailureCode::cancelled, "accelerator probe cancelled before dispatch");
  constexpr std::size_t kMetadataBytes = 16U * 1024U;
  ggml_init_params parameters{kMetadataBytes, nullptr, true};
  GgmlContextOwner context(ggml_init(parameters));
  if (context.get() == nullptr)
    throw CoreError(FailureCode::allocation_failed, "accelerator probe graph allocation failed");
  ggml_tensor* left = ggml_new_tensor_1d(context.get(), GGML_TYPE_F32, 2);
  ggml_tensor* right = ggml_new_tensor_1d(context.get(), GGML_TYPE_F32, 2);
  ggml_tensor* sum = ggml_add(context.get(), left, right);
  BufferOwner buffer(ggml_backend_alloc_ctx_tensors_from_buft(
      context.get(), ggml_backend_dev_buffer_type(device)));
  if (buffer.get() == nullptr)
    throw CoreError(FailureCode::allocation_failed, "accelerator probe buffer allocation failed");
  const std::array<float, 2> left_values{1.0F, 2.0F};
  const std::array<float, 2> right_values{3.0F, 4.0F};
  std::array<float, 2> result{};
  ggml_backend_tensor_set(left, left_values.data(), 0U, sizeof(left_values));
  ggml_backend_tensor_set(right, right_values.data(), 0U, sizeof(right_values));
  ggml_cgraph* graph = ggml_new_graph_custom(context.get(), 8U, false);
  ggml_build_forward_expand(graph, sum);
  if (cancellation.requested() || ggml_backend_graph_compute(backend, graph) != GGML_STATUS_SUCCESS)
    throw CoreError(cancellation.requested() ? FailureCode::cancelled
                                             : FailureCode::backend_init_failed,
                    "accelerator probe dispatch failed");
  ggml_backend_tensor_get(sum, result.data(), 0U, sizeof(result));
  if (result != std::array<float, 2>{4.0F, 6.0F})
    throw CoreError(FailureCode::backend_init_failed, "accelerator probe readback mismatch");
}

} // namespace

class WhisperCppEngine::Impl final {
public:
  Impl()
      : registry_(discovery_, std::string(kEngineId), std::string(kRuntimeDigest),
                  std::string(kBackendId)) {}

  [[nodiscard]] EngineBackend backend() const noexcept { return engine_backend(); }

  [[nodiscard]] DeviceProbeEvidence probe_device(const DeviceOperationAuthority& authority,
                                                 const CancellationToken& cancellation) {
    if (!kGpuWorker)
      throw CoreError(FailureCode::invalid_settings, "CPU worker cannot probe an accelerator");
    const auto selected =
        registry_.resolve(authority.selected_ordinal, authority.registry_fingerprint);
    auto* device = reinterpret_cast<ggml_backend_dev_t>(selected.native_token);
    BackendOwner activated(ggml_backend_dev_init(device, nullptr));
    if (activated.get() == nullptr)
      throw CoreError(FailureCode::backend_init_failed,
                      "selected accelerator backend activation failed");
    if (ggml_backend_get_device(activated.get()) != device)
      throw CoreError(FailureCode::device_proof_failed, "activated accelerator device changed");
    deterministic_device_dispatch(activated.get(), device, cancellation);
    auto evidence = base_evidence(selected, selected.native_identity);
    evidence.probe_proof = local_whisper::common::device_proof(
        local_whisper::common::DeviceProofDomain::probe, proof_input(authority, evidence, 0U));
    return evidence;
  }

  void load(ExactModelReader& reader, const std::string& family, const std::string& variant,
            const std::optional<DeviceOperationAuthority>& authority,
            const CancellationToken& cancellation) {
    if (context_.get() != nullptr)
      throw CoreError(FailureCode::model_load_failed, "engine already loaded");
    if (kGpuWorker != authority.has_value())
      throw CoreError(FailureCode::invalid_settings, "worker backend and load authority differ");
    cancellation_checkpoint(cancellation);
    ModelFormatPreflight preflight{LoaderLimits()};
    static_cast<void>(preflight.validate(reader, family, variant));
    reader.rewind_after_verified_pass();
    whisper_log_set(discard_upstream_log, nullptr);
    whisper_context_params parameters = whisper_context_default_params();
    parameters.use_gpu = kGpuWorker;
    parameters.flash_attn = false;
    parameters.gpu_device = authority.has_value() ? authority->selected_ordinal : 0;
    parameters.local_whisper_require_gpu = kGpuWorker;
    if (authority.has_value()) {
      selected_ = registry_.resolve(authority->selected_ordinal, authority->registry_fingerprint);
      parameters.local_whisper_selected_device = reinterpret_cast<void*>(selected_->native_token);
    } else {
      parameters.local_whisper_selected_device = nullptr;
    }
    parameters.dtw_token_timestamps = false;
    whisper_model_loader loader{&reader, exact_loader_read, exact_loader_eof, exact_loader_close};
    whisper_context* loaded = whisper_init_with_params(&loader, parameters);
    if (loaded == nullptr) {
      selected_.reset();
      if (reader.offset() != reader.expected_bytes())
        throw CoreError(FailureCode::model_corrupt,
                        "model loader stopped before authenticated EOF");
      reader.verify_complete();
      throw CoreError(kGpuWorker ? FailureCode::backend_init_failed
                                 : FailureCode::model_load_failed,
                      "Whisper.cpp rejected validated model or exact backend");
    }
    try {
      reader.verify_complete();
      cancellation_checkpoint(cancellation);
    } catch (...) {
      whisper_free(loaded);
      selected_.reset();
      throw;
    }
    if (reader.close_count() != 1U) {
      whisper_free(loaded);
      selected_.reset();
      throw CoreError(FailureCode::model_corrupt, "model loader close contract failed");
    }
    context_.reset(loaded);
  }

  void warm_up(std::uint32_t cpu_threads, const CancellationToken& cancellation) {
    if (context_.get() == nullptr)
      throw CoreError(FailureCode::model_load_failed, "warm-up requires loaded model");
    constexpr std::size_t kWarmupSamples = 16'000U;
    const std::vector<float> silence(kWarmupSamples, 0.0F);
    const TranscriptionOptions options{"en", "", 0U, DecodingStrategy::greedy, 1U, cpu_threads};
    const auto parameters = inference_parameters(options, cancellation);
    AbortInstallation abort(context_.get(), cancellation);
    const int result =
        whisper_full(context_.get(), parameters, silence.data(), static_cast<int>(silence.size()));
    if (cancellation.requested())
      throw CoreError(FailureCode::cancelled, "warm-up cancelled");
    if (result != 0)
      throw CoreError(FailureCode::model_load_failed, "fixed backend warm-up failed");
  }

  [[nodiscard]] DeviceLoadEvidence load_evidence(const DeviceOperationAuthority& authority) const {
    if (!kGpuWorker || context_.get() == nullptr || !selected_.has_value())
      throw CoreError(FailureCode::device_proof_failed, "accelerator model evidence unavailable");
    whisper_local_device_evidence native{};
    if (!whisper_local_get_device_evidence(context_.get(), &native) ||
        native.activated_device_id == nullptr || native.primary_state_device_id == nullptr)
      throw CoreError(FailureCode::device_proof_failed, "accelerator model ownership proof failed");
    const auto validated = validate_device_load_observation(
        *selected_, authority.selected_ordinal, authority.registry_fingerprint,
        {native.activated_device_id, native.primary_state_device_id, native.model_weight_bytes,
         native.single_gpu_model_owner});
    DeviceProbeEvidence base{selected_->ordinal,
                             validated.activated_native_identity,
                             validated.primary_state_native_identity,
                             selected_->registry_fingerprint,
                             {}};
    const auto proof = local_whisper::common::device_proof(
        local_whisper::common::DeviceProofDomain::load,
        proof_input(authority, base, validated.model_weight_bytes));
    return {selected_->ordinal,
            validated.activated_native_identity,
            validated.primary_state_native_identity,
            selected_->registry_fingerprint,
            validated.model_weight_bytes,
            proof};
  }

  std::string transcribe(std::span<const float> samples, const TranscriptionOptions& options,
                         const CancellationToken& cancellation) {
    if (context_.get() == nullptr || samples.empty() ||
        samples.size() > static_cast<std::size_t>(std::numeric_limits<int>::max()))
      throw CoreError(FailureCode::transcription_failed, "invalid engine transcription state");
    cancellation_checkpoint(cancellation);
    const auto parameters = inference_parameters(options, cancellation);
    AbortInstallation abort(context_.get(), cancellation);
    const int result =
        whisper_full(context_.get(), parameters, samples.data(), static_cast<int>(samples.size()));
    if (cancellation.requested())
      throw CoreError(FailureCode::cancelled, "inference cancelled");
    if (result != 0)
      throw CoreError(FailureCode::transcription_failed, "backend inference failed");
    std::string text;
    const int segments = whisper_full_n_segments(context_.get());
    if (segments < 0)
      throw CoreError(FailureCode::transcription_failed, "invalid engine segment count");
    for (int index = 0; index < segments; ++index) {
      cancellation_checkpoint(cancellation);
      const char* segment = whisper_full_get_segment_text(context_.get(), index);
      if (segment == nullptr)
        throw CoreError(FailureCode::transcription_failed, "invalid engine transcript segment");
      text += segment;
    }
    cancellation_checkpoint(cancellation);
    return text;
  }

  void unload() noexcept {
    context_.reset();
    selected_.reset();
  }
  [[nodiscard]] bool loaded() const noexcept { return context_.get() != nullptr; }

private:
  static void cancellation_checkpoint(const CancellationToken& cancellation) {
    if (cancellation.requested())
      throw CoreError(FailureCode::cancelled, "engine operation cancelled");
  }

  GgmlDeviceDiscovery discovery_;
  DeviceRegistry registry_;
  ContextOwner context_;
  std::optional<SelectedDevice> selected_;
};

WhisperCppEngine::WhisperCppEngine() : impl_(std::make_unique<Impl>()) {}
WhisperCppEngine::~WhisperCppEngine() noexcept = default;
EngineBackend WhisperCppEngine::backend() const noexcept { return impl_->backend(); }
DeviceProbeEvidence WhisperCppEngine::probe_device(const DeviceOperationAuthority& authority,
                                                   const CancellationToken& cancellation) {
  try {
    return impl_->probe_device(authority, cancellation);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "device probe allocation failed");
  }
}
void WhisperCppEngine::load(ExactModelReader& reader, const std::string& family,
                            const std::string& variant,
                            const std::optional<DeviceOperationAuthority>& authority,
                            const CancellationToken& cancellation) {
  try {
    impl_->load(reader, family, variant, authority, cancellation);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "engine allocation failed");
  }
}
void WhisperCppEngine::warm_up(std::uint32_t cpu_threads, const CancellationToken& cancellation) {
  try {
    impl_->warm_up(cpu_threads, cancellation);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "warm-up allocation failed");
  }
}
DeviceLoadEvidence
WhisperCppEngine::load_evidence(const DeviceOperationAuthority& authority) const {
  return impl_->load_evidence(authority);
}
std::string WhisperCppEngine::transcribe(std::span<const float> samples,
                                         const TranscriptionOptions& options,
                                         const CancellationToken& cancellation) {
  try {
    return impl_->transcribe(samples, options, cancellation);
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "inference allocation failed");
  }
}
void WhisperCppEngine::unload() noexcept { impl_->unload(); }
bool WhisperCppEngine::loaded() const noexcept { return impl_->loaded(); }

} // namespace local_whisper::whisper_cpp
