#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include "local_whisper/whisper_cpp/checked_arithmetic.hpp"

#include <algorithm>
#include <array>

namespace local_whisper::whisper_cpp {

ExactModelReader::ExactModelReader(RandomAccessModelSource& source, std::uint64_t expected_bytes,
                                   std::array<std::uint8_t, 32> expected_sha256)
    : source_(source), expected_bytes_(expected_bytes), expected_sha256_(expected_sha256) {
  if (!source_.is_read_only_regular() || source_.initial_offset() != 0U || expected_bytes_ == 0U ||
      source_.size_bytes() != expected_bytes_ ||
      std::all_of(expected_sha256_.begin(), expected_sha256_.end(),
                  [](std::uint8_t byte) { return byte == 0U; })) {
    throw CoreError(FailureCode::model_authority_invalid, "invalid model authority evidence");
  }
}

void ExactModelReader::read_exact(std::span<std::uint8_t> destination) {
  if (closed_)
    throw CoreError(FailureCode::model_corrupt, "read after model reader close");
  const auto requested_end = checked_add(offset_, destination.size());
  if (requested_end > expected_bytes_)
    throw CoreError(FailureCode::model_corrupt, "model read exceeds authenticated size");
  while (!destination.empty()) {
    const auto count = source_.read_at(offset_, destination);
    if (!count.has_value() || *count == 0U || *count > destination.size())
      throw CoreError(FailureCode::model_corrupt, "partial or failed authenticated model read");
    const auto consumed = destination.first(*count);
    digest_.update(consumed);
    offset_ = checked_add(offset_, *count);
    destination = destination.subspan(*count);
  }
}

bool ExactModelReader::read_optional_record_prefix(std::span<std::uint8_t> destination) {
  if (offset_ == expected_bytes_)
    return false;
  read_exact(destination);
  return true;
}

void ExactModelReader::skip_exact(std::uint64_t bytes) {
  std::array<std::uint8_t, 64U * 1024U> buffer{};
  while (bytes > 0U) {
    const auto count = std::min<std::uint64_t>(bytes, buffer.size());
    read_exact(std::span<std::uint8_t>(buffer.data(), static_cast<std::size_t>(count)));
    bytes -= count;
  }
}

void ExactModelReader::verify_complete() {
  if (verified_ || offset_ != expected_bytes_ || source_.size_bytes() != expected_bytes_) {
    throw CoreError(FailureCode::model_corrupt, "authenticated model completion mismatch");
  }
  std::array<std::uint8_t, 1> eof_probe{};
  const auto eof_count = source_.read_at(expected_bytes_, eof_probe);
  if (!eof_count.has_value() || *eof_count != 0U || digest_.finish() != expected_sha256_)
    throw CoreError(FailureCode::model_corrupt, "authenticated model completion mismatch");
  verified_ = true;
}

void ExactModelReader::rewind_after_verified_pass() {
  if (!verified_ || closed_)
    throw CoreError(FailureCode::model_corrupt, "unverified model reader rewind");
  digest_ = local_whisper::common::Sha256();
  offset_ = 0;
  verified_ = false;
}

void ExactModelReader::close() noexcept {
  if (closed_)
    return;
  closed_ = true;
  ++close_count_;
}

bool ExactModelReader::eof() const noexcept { return offset_ == expected_bytes_; }
bool ExactModelReader::closed() const noexcept { return closed_; }
std::uint64_t ExactModelReader::offset() const noexcept { return offset_; }
std::uint64_t ExactModelReader::expected_bytes() const noexcept { return expected_bytes_; }
std::size_t ExactModelReader::close_count() const noexcept { return close_count_; }

} // namespace local_whisper::whisper_cpp
