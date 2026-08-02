#pragma once

#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace local_whisper::whisper_cpp {

class RandomAccessModelSource {
public:
  virtual ~RandomAccessModelSource() = default;

  [[nodiscard]] virtual bool is_read_only_regular() const noexcept = 0;
  [[nodiscard]] virtual std::uint64_t size_bytes() const = 0;
  [[nodiscard]] virtual std::uint64_t initial_offset() const = 0;
  [[nodiscard]] virtual std::optional<std::size_t> read_at(std::uint64_t offset,
                                                           std::span<std::uint8_t> destination) = 0;
};

class ExactModelReader final {
public:
  ExactModelReader(RandomAccessModelSource& source, std::uint64_t expected_bytes,
                   std::array<std::uint8_t, 32> expected_sha256);

  void read_exact(std::span<std::uint8_t> destination);
  [[nodiscard]] bool read_optional_record_prefix(std::span<std::uint8_t> destination);
  void skip_exact(std::uint64_t bytes);
  void verify_complete();
  void rewind_after_verified_pass();
  void close() noexcept;

  [[nodiscard]] bool eof() const noexcept;
  [[nodiscard]] bool closed() const noexcept;
  [[nodiscard]] std::uint64_t offset() const noexcept;
  [[nodiscard]] std::uint64_t expected_bytes() const noexcept;
  [[nodiscard]] std::size_t close_count() const noexcept;

private:
  RandomAccessModelSource& source_;
  std::uint64_t expected_bytes_;
  std::array<std::uint8_t, 32> expected_sha256_;
  local_whisper::common::Sha256 digest_;
  std::uint64_t offset_ = 0;
  std::size_t close_count_ = 0;
  bool verified_ = false;
  bool closed_ = false;
};

} // namespace local_whisper::whisper_cpp
