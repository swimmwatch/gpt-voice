#pragma once

#include <cstdint>

namespace local_whisper::whisper_cpp {

struct CpuProbeEvidence final {
  std::uint32_t logical_processors;
  std::uint32_t resolved_threads;
  std::uint64_t compute_digest;
};

class CpuProbe final {
public:
  [[nodiscard]] CpuProbeEvidence run(std::uint32_t requested_threads) const;
};

} // namespace local_whisper::whisper_cpp
