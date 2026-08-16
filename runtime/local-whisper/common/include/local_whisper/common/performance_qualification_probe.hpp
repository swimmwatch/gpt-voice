#pragma once

#include <chrono>
#include <cstdint>
#include <string>
#include <string_view>

#if defined(__linux__)
#include <cerrno>
#include <unistd.h>
#endif

namespace local_whisper::common {

// The model guard receives the inherited Node event pipe at descriptor 5, but
// reuses that descriptor for its launcher authority socket. The derived
// qualification launch path moves the pipe to the worker-only descriptor
// before that hand-off.
inline constexpr int kPerformanceQualificationProbeSourceDescriptor = 5;
inline constexpr int kPerformanceQualificationProbeDescriptor = 7;

inline bool emit_performance_qualification_probe(std::string_view kind, std::string_view value,
                                                 std::uint64_t measurement) noexcept {
#if defined(__linux__)
  const std::string frame = "LWQP1\t" + std::string(kind) + "\t" + std::string(value) + "\t" +
                            std::to_string(measurement) + "\n";
  std::size_t offset = 0;
  while (offset < frame.size()) {
    const ssize_t written = write(kPerformanceQualificationProbeDescriptor, frame.data() + offset,
                                  frame.size() - offset);
    if (written < 0 && errno == EINTR)
      continue;
    if (written <= 0)
      return false;
    offset += static_cast<std::size_t>(written);
  }
  return true;
#else
  static_cast<void>(kind);
  static_cast<void>(value);
  static_cast<void>(measurement);
  return false;
#endif
}

class PerformanceQualificationTimer final {
public:
  explicit PerformanceQualificationTimer(std::string_view phase) noexcept
      : phase_(phase), started_(std::chrono::steady_clock::now()) {}

  [[nodiscard]] std::uint64_t elapsed_nanoseconds() const noexcept {
    const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::steady_clock::now() - started_);
    return static_cast<std::uint64_t>(elapsed.count() > 0 ? elapsed.count() : 1);
  }

  [[nodiscard]] bool emit() const noexcept {
    return emit_performance_qualification_probe("phase", phase_, elapsed_nanoseconds());
  }

private:
  std::string_view phase_;
  std::chrono::steady_clock::time_point started_;
};

} // namespace local_whisper::common
