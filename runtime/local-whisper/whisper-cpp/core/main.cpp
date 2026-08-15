#include "local_whisper/common/native_logger.hpp"
#include "local_whisper/common/nlohmann_json.hpp"
#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/cpu_probe.hpp"
#include "local_whisper/whisper_cpp/device_authority.hpp"
#include "local_whisper/whisper_cpp/engine.hpp"
#include "local_whisper/whisper_cpp/model_authority.hpp"
#include "local_whisper/whisper_cpp/worker_application.hpp"
#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#include <cstdio>
#include <iostream>
#include <optional>
#include <string_view>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

int main(int argc, char** argv) {
  auto logger = local_whisper::common::make_native_logger_from_environment();
  if (logger)
    logger->emit(local_whisper::common::NativeLogComponent::whisper_worker,
                 local_whisper::common::NativeLogEvent::process_started);
  const auto finish = [&logger](const int result) {
    if (logger) {
      logger->emit(local_whisper::common::NativeLogComponent::whisper_worker,
                   result == 0 ? local_whisper::common::NativeLogEvent::process_stopped
                               : local_whisper::common::NativeLogEvent::native_failure,
                   result == 0 ? local_whisper::common::NativeLogFields{}
                               : local_whisper::common::NativeLogFields{
                                     local_whisper::common::NativeLogErrorCode::runtime_failure,
                                     std::nullopt});
      logger->shutdown();
    }
    return result;
  };
  if (argc != 2)
    return finish(2);
#ifdef _WIN32
  if (_setmode(_fileno(stdin), _O_BINARY) == -1 || _setmode(_fileno(stdout), _O_BINARY) == -1)
    return finish(20);
#endif
  const std::string_view mode(argv[1]);
  try {
    local_whisper::whisper_cpp::CpuProbe probe;
    if (mode == "--self-test") {
      const auto evidence = probe.run(1U);
      if (evidence.compute_digest == 0U)
        return finish(3);
      std::fputs("LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK\n", stdout);
      return finish(0);
    }
    if (mode != "--probe" && mode != "--load" && mode != "--registry")
      return finish(2);
    local_whisper::whisper_cpp::WhisperCppEngine engine;
    if (mode == "--registry") {
      const auto registry = engine.capture_device_registry();
      nlohmann::json entries = nlohmann::json::array();
      for (const auto& entry : registry.entries) {
        entries.push_back(
            {{"ordinal", entry.ordinal},
             {"type",
              entry.type == local_whisper::common::RegistryDeviceType::gpu ? "gpu" : "igpu"},
             {"backendId", entry.backend_id},
             {"nativeIdentity", entry.native_identity}});
      }
      const nlohmann::json document = {{"schemaVersion", 1},
                                       {"engineId", registry.engine_id},
                                       {"runtimeBuildDigest", registry.runtime_build_digest},
                                       {"backendId", registry.backend_id},
                                       {"entries", std::move(entries)}};
      std::cout << document.dump() << '\n';
      return finish(std::cout ? 0 : 21);
    }
    std::optional<local_whisper::whisper_cpp::DeviceAuthority> device_authority;
    if constexpr (std::string_view(LOCAL_WHISPER_BACKEND_ID) != "cpu")
      device_authority.emplace(
          local_whisper::whisper_cpp::DeviceAuthority::receive_from_standard_channel());
    std::optional<local_whisper::whisper_cpp::ModelAuthority> authority;
    if (mode == "--load")
      authority.emplace(
          local_whisper::whisper_cpp::ModelAuthority::receive_from_standard_channels());
    local_whisper::whisper_cpp::NativeWorkerChannel channel;
    local_whisper::whisper_cpp::SteadyWorkerClock clock;
    local_whisper::whisper_cpp::CancellationController cancellation;
    local_whisper::whisper_cpp::CanonicalPcmAudioConverter pcm_converter;
    local_whisper::whisper_cpp::WorkerApplication application(
        mode == "--probe" ? local_whisper::whisper_cpp::WorkerRunMode::probe
                          : local_whisper::whisper_cpp::WorkerRunMode::load,
        channel, engine, pcm_converter, probe, clock, cancellation,
        authority.has_value() ? &authority.value() : nullptr,
        device_authority.has_value() ? &device_authority->proof() : nullptr, logger.get());
    return finish(application.run());
  } catch (...) {
    return finish(20);
  }
}
