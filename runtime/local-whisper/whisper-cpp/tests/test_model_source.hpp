#pragma once

#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <optional>
#include <span>
#include <vector>

namespace local_whisper::whisper_cpp::test_support {

class MemoryModelSource final : public RandomAccessModelSource {
public:
  explicit MemoryModelSource(std::vector<std::uint8_t> bytes,
                             std::size_t maximum_chunk = 64U * 1024U)
      : bytes_(std::move(bytes)), reported_size_(bytes_.size()), maximum_chunk_(maximum_chunk) {}

  [[nodiscard]] bool is_read_only_regular() const noexcept override { return valid_authority_; }
  [[nodiscard]] std::uint64_t size_bytes() const override { return reported_size_; }
  [[nodiscard]] std::uint64_t initial_offset() const override { return initial_offset_; }
  [[nodiscard]] std::optional<std::size_t> read_at(std::uint64_t offset,
                                                   std::span<std::uint8_t> destination) override {
    if (fail_reads_)
      return std::nullopt;
    if (tail_after_reported_size_ && offset == reported_size_ && !destination.empty()) {
      destination[0] = 0xffU;
      return 1U;
    }
    if (offset >= bytes_.size())
      return 0U;
    const auto count = std::min(
        {destination.size(), maximum_chunk_, bytes_.size() - static_cast<std::size_t>(offset)});
    std::memcpy(destination.data(), bytes_.data() + static_cast<std::size_t>(offset), count);
    return count;
  }

  void set_reported_size(std::uint64_t value) noexcept { reported_size_ = value; }
  void set_initial_offset(std::uint64_t value) noexcept { initial_offset_ = value; }
  void set_valid_authority(bool value) noexcept { valid_authority_ = value; }
  void set_fail_reads(bool value) noexcept { fail_reads_ = value; }
  void set_tail_after_reported_size(bool value) noexcept { tail_after_reported_size_ = value; }

private:
  std::vector<std::uint8_t> bytes_;
  std::uint64_t reported_size_;
  std::size_t maximum_chunk_;
  std::uint64_t initial_offset_ = 0;
  bool valid_authority_ = true;
  bool fail_reads_ = false;
  bool tail_after_reported_size_ = false;
};

} // namespace local_whisper::whisper_cpp::test_support
