#include "local_whisper/fs_guard/bounded_line_reader.hpp"

#include <utility>

namespace local_whisper::fs_guard {

BoundedLineReader::BoundedLineReader(const std::size_t maximum_payload_bytes) noexcept
    : maximum_payload_bytes_(maximum_payload_bytes) {}

LineReadResult BoundedLineReader::read(std::istream& input) const {
  std::string payload;
  payload.reserve(maximum_payload_bytes_);
  char character = '\0';
  while (input.get(character)) {
    if (character == '\n')
      return {LineReadStatus::kLine, std::move(payload)};
    if (payload.size() == maximum_payload_bytes_)
      return {LineReadStatus::kOverflow, std::move(payload)};
    payload.push_back(character);
  }
  if (payload.empty())
    return {LineReadStatus::kEnd, {}};
  return {LineReadStatus::kLine, std::move(payload)};
}

} // namespace local_whisper::fs_guard
