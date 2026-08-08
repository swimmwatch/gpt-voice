#pragma once

#include <cstddef>
#include <istream>
#include <string>

namespace local_whisper::fs_guard {

enum class LineReadStatus { kLine, kEnd, kOverflow };

struct LineReadResult final {
  LineReadStatus status;
  std::string payload;
};

/** Reads one request without retaining or draining an attacker-sized line. */
class BoundedLineReader final {
public:
  explicit BoundedLineReader(std::size_t maximum_payload_bytes) noexcept;

  [[nodiscard]] LineReadResult read(std::istream& input) const;

private:
  std::size_t maximum_payload_bytes_;
};

} // namespace local_whisper::fs_guard
