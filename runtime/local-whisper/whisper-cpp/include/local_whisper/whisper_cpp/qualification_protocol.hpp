#pragma once

#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::whisper_cpp {

inline constexpr int kQualificationModelDescriptor = 3;
inline constexpr int kQualificationWavDescriptor = 4;
inline constexpr std::size_t kQualificationCommandMaxBytes = 8U * 1024U;
inline constexpr std::uint64_t kQualificationWavMaxBytes = 256U * 1024U * 1024U;

struct QualificationCommand final {
  std::string family;
  std::string variant;
  std::uint64_t model_size_bytes;
  std::array<std::uint8_t, 32> model_sha256;
  std::uint64_t wav_size_bytes;
  std::array<std::uint8_t, 32> wav_sha256;
  std::string language;
  std::uint32_t cpu_threads;
  std::optional<std::uint16_t> selected_ordinal;
};

[[nodiscard]] QualificationCommand parse_qualification_command(std::span<const std::uint8_t> bytes);

class QualificationModelSource final : public RandomAccessModelSource {
public:
  explicit QualificationModelSource(int descriptor);
  ~QualificationModelSource() noexcept override;

  QualificationModelSource(const QualificationModelSource&) = delete;
  QualificationModelSource& operator=(const QualificationModelSource&) = delete;

  [[nodiscard]] bool is_read_only_regular() const noexcept override;
  [[nodiscard]] std::uint64_t size_bytes() const override;
  [[nodiscard]] std::uint64_t initial_offset() const override;
  [[nodiscard]] std::optional<std::size_t> read_at(std::uint64_t offset,
                                                   std::span<std::uint8_t> destination) override;

private:
  int descriptor_;
  std::uint64_t initial_size_;
  std::uint64_t initial_device_;
  std::uint64_t initial_inode_;
  bool valid_;
};

[[nodiscard]] std::vector<std::uint8_t>
read_qualification_wav(int descriptor, std::uint64_t expected_bytes,
                       const std::array<std::uint8_t, 32>& expected_sha256);

} // namespace local_whisper::whisper_cpp
