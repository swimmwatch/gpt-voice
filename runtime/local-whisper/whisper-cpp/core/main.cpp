#include "local_whisper/whisper_cpp/cancellation.hpp"
#include "local_whisper/whisper_cpp/cpu_probe.hpp"
#include "local_whisper/whisper_cpp/device_authority.hpp"
#include "local_whisper/whisper_cpp/engine.hpp"
#include "local_whisper/whisper_cpp/model_authority.hpp"
#include "local_whisper/whisper_cpp/worker_application.hpp"
#include "local_whisper/whisper_cpp/worker_protocol.hpp"

#include <cstdio>
#include <optional>
#include <string_view>

int main(int argc, char** argv) {
  if (argc != 2)
    return 2;
  const std::string_view mode(argv[1]);
  try {
    local_whisper::whisper_cpp::CpuProbe probe;
    if (mode == "--self-test") {
      const auto evidence = probe.run(1U);
      if (evidence.compute_digest == 0U)
        return 3;
      std::fputs("LOCAL_WHISPER_CPP_CPU_SELF_TEST_OK\n", stdout);
      return 0;
    }
    if (mode != "--probe" && mode != "--load")
      return 2;
    std::optional<local_whisper::whisper_cpp::DeviceAuthority> device_authority;
    if constexpr (std::string_view(LOCAL_WHISPER_BACKEND_ID) == "cuda")
      device_authority.emplace(
          local_whisper::whisper_cpp::DeviceAuthority::receive_from_standard_channel());
    std::optional<local_whisper::whisper_cpp::ModelAuthority> authority;
    if (mode == "--load")
      authority.emplace(
          local_whisper::whisper_cpp::ModelAuthority::receive_from_standard_channels());
    local_whisper::whisper_cpp::NativeWorkerChannel channel;
    local_whisper::whisper_cpp::WhisperCppEngine engine;
    local_whisper::whisper_cpp::SteadyWorkerClock clock;
    local_whisper::whisper_cpp::CancellationController cancellation;
    local_whisper::whisper_cpp::WorkerApplication application(
        mode == "--probe" ? local_whisper::whisper_cpp::WorkerRunMode::probe
                          : local_whisper::whisper_cpp::WorkerRunMode::load,
        channel, engine, probe, clock, cancellation,
        authority.has_value() ? &authority.value() : nullptr,
        device_authority.has_value() ? &device_authority->proof() : nullptr);
    return application.run();
  } catch (...) {
    return 20;
  }
}
