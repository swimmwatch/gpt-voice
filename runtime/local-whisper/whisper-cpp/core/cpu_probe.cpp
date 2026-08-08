#include "local_whisper/whisper_cpp/cpu_probe.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <new>
#include <thread>
#include <vector>

namespace local_whisper::whisper_cpp {

CpuProbeEvidence CpuProbe::run(std::uint32_t requested_threads) const {
#if !defined(__x86_64__) && !defined(_M_X64)
  throw CoreError(FailureCode::not_ready, "CPU baseline requires x64");
#endif
  const auto logical_processors = std::thread::hardware_concurrency();
  if (logical_processors == 0U || requested_threads == 0U || requested_threads > 256U)
    throw CoreError(FailureCode::not_ready, "CPU topology is unavailable");
  const auto resolved_threads = std::min(requested_threads, logical_processors);
  try {
    constexpr std::size_t kComputeElements = 16U * 1024U;
    std::vector<float> values(kComputeElements);
    std::uint64_t digest = 0xcbf29ce484222325ULL;
    for (std::size_t index = 0; index < values.size(); ++index) {
      values[index] = static_cast<float>((index * 17U) % 251U) / 251.0F;
      digest ^= std::bit_cast<std::uint32_t>(values[index] * values[index] + 0.25F);
      digest *= 0x100000001b3ULL;
    }
    if (digest == 0U)
      throw CoreError(FailureCode::not_ready, "CPU compute fixture failed");
    return {logical_processors, resolved_threads, digest};
  } catch (const std::bad_alloc&) {
    throw CoreError(FailureCode::allocation_failed, "CPU probe allocation failed");
  }
}

} // namespace local_whisper::whisper_cpp
