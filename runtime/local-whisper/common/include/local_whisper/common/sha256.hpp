#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <string>

namespace local_whisper::common {

inline constexpr std::uint64_t kMaxSha256InputBytes =
    std::numeric_limits<std::uint64_t>::max() / 8U;

[[nodiscard]] constexpr bool
can_extend_sha256_input(const std::uint64_t accumulated_bytes,
                        const std::uint64_t additional_bytes) noexcept {
  return accumulated_bytes <= kMaxSha256InputBytes &&
         additional_bytes <= kMaxSha256InputBytes - accumulated_bytes;
}

class Sha256 final {
public:
  Sha256();
  Sha256(const Sha256&) = delete;
  Sha256& operator=(const Sha256&) = delete;
  Sha256(Sha256&&) noexcept = default;
  Sha256& operator=(Sha256&&) noexcept = default;

  void update(std::span<const std::uint8_t> bytes);
  [[nodiscard]] std::array<std::uint8_t, 32> finish();

private:
  void transform(const std::uint8_t* block);

  std::array<std::uint32_t, 8> state_{};
  std::array<std::uint8_t, 64> buffer_{};
  std::uint64_t total_bytes_ = 0;
  std::size_t buffered_bytes_ = 0;
  bool finished_ = false;
};

[[nodiscard]] std::array<std::uint8_t, 32> sha256(std::span<const std::uint8_t> bytes);
[[nodiscard]] std::string hex_sha256(std::span<const std::uint8_t> bytes);
[[nodiscard]] std::string to_lower_hex(std::span<const std::uint8_t> bytes);

} // namespace local_whisper::common
