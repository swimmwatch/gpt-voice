#include "local_whisper/common/sha256.hpp"

#include "sha256_internal.hpp"

#include <algorithm>
#include <array>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace local_whisper::common {

Sha256::Sha256() : Sha256(detail::default_sha256_transform()) {}

Sha256::Sha256(const BlockTransform transform) noexcept
    : transform_(transform), state_(detail::kSha256InitialState) {}

#if defined(LOCAL_WHISPER_SHA256_TESTING)
Sha256::Sha256(const Sha256DispatchMode mode)
    : Sha256(mode == Sha256DispatchMode::automatic
                 ? detail::default_sha256_transform()
                 : detail::sha256_transform_for_support(mode == Sha256DispatchMode::accelerated)) {}

Sha256DispatchTarget Sha256::dispatch_target_for_testing() const noexcept {
  return transform_ == &detail::sha256_transform_x86 ? Sha256DispatchTarget::accelerated
                                                     : Sha256DispatchTarget::scalar;
}

bool sha256_acceleration_supported_for_testing() noexcept {
  return detail::sha256_x86_runtime_supported();
}
#endif

void Sha256::update(std::span<const std::uint8_t> bytes) {
  if (finished_ ||
      !can_extend_sha256_input(total_bytes_, static_cast<std::uint64_t>(bytes.size()))) {
    throw std::runtime_error("invalid sha256 update");
  }
  total_bytes_ += static_cast<std::uint64_t>(bytes.size());
  while (!bytes.empty()) {
    const std::size_t copied = std::min(bytes.size(), buffer_.size() - buffered_bytes_);
    std::copy_n(bytes.begin(), copied,
                buffer_.begin() + static_cast<std::ptrdiff_t>(buffered_bytes_));
    buffered_bytes_ += copied;
    bytes = bytes.subspan(copied);
    if (buffered_bytes_ == buffer_.size()) {
      transform_(state_, buffer_.data());
      buffered_bytes_ = 0;
    }
  }
}

std::array<std::uint8_t, 32> Sha256::finish() {
  if (finished_)
    throw std::runtime_error("sha256 already finished");
  const std::uint64_t bit_length = total_bytes_ * 8U;
  buffer_.at(buffered_bytes_++) = 0x80U;
  if (buffered_bytes_ > 56) {
    std::fill(buffer_.begin() + static_cast<std::ptrdiff_t>(buffered_bytes_), buffer_.end(),
              static_cast<std::uint8_t>(0));
    transform_(state_, buffer_.data());
    buffered_bytes_ = 0;
  }
  std::fill(buffer_.begin() + static_cast<std::ptrdiff_t>(buffered_bytes_), buffer_.begin() + 56,
            static_cast<std::uint8_t>(0));
  for (std::size_t index = 0; index < 8; ++index)
    buffer_.at(63 - index) = static_cast<std::uint8_t>(bit_length >> (index * 8U));
  transform_(state_, buffer_.data());
  finished_ = true;

  std::array<std::uint8_t, 32> digest{};
  for (std::size_t index = 0; index < state_.size(); ++index) {
    for (std::size_t byte = 0; byte < 4; ++byte)
      digest.at(index * 4 + byte) =
          static_cast<std::uint8_t>(state_.at(index) >> ((3U - byte) * 8U));
  }
  return digest;
}

void detail::sha256_transform_scalar(Sha256State& state, const std::uint8_t* block) noexcept {
  std::array<std::uint32_t, 64> words{};
  for (std::size_t index = 0; index < 16; ++index) {
    const std::size_t offset = index * 4;
    words[index] = (static_cast<std::uint32_t>(block[offset]) << 24U) |
                   (static_cast<std::uint32_t>(block[offset + 1]) << 16U) |
                   (static_cast<std::uint32_t>(block[offset + 2]) << 8U) |
                   static_cast<std::uint32_t>(block[offset + 3]);
  }
  for (std::size_t index = 16; index < words.size(); ++index) {
    const std::uint32_t s0 = rotate_right(words[index - 15], 7) ^
                             rotate_right(words[index - 15], 18) ^ (words[index - 15] >> 3U);
    const std::uint32_t s1 = rotate_right(words[index - 2], 17) ^
                             rotate_right(words[index - 2], 19) ^ (words[index - 2] >> 10U);
    words[index] = words[index - 16] + s0 + words[index - 7] + s1;
  }
  std::array<std::uint32_t, 8> working = state;
  for (std::size_t index = 0; index < words.size(); ++index) {
    const std::uint32_t choice = (working[4] & working[5]) ^ ((~working[4]) & working[6]);
    const std::uint32_t majority =
        (working[0] & working[1]) ^ (working[0] & working[2]) ^ (working[1] & working[2]);
    const std::uint32_t upper_sigma =
        rotate_right(working[4], 6) ^ rotate_right(working[4], 11) ^ rotate_right(working[4], 25);
    const std::uint32_t lower_sigma =
        rotate_right(working[0], 2) ^ rotate_right(working[0], 13) ^ rotate_right(working[0], 22);
    const std::uint32_t temporary1 =
        working[7] + upper_sigma + choice + kSha256RoundConstants[index] + words[index];
    const std::uint32_t temporary2 = lower_sigma + majority;
    working[7] = working[6];
    working[6] = working[5];
    working[5] = working[4];
    working[4] = working[3] + temporary1;
    working[3] = working[2];
    working[2] = working[1];
    working[1] = working[0];
    working[0] = temporary1 + temporary2;
  }
  for (std::size_t index = 0; index < state.size(); ++index)
    state[index] += working[index];
}

std::array<std::uint8_t, 32> sha256(std::span<const std::uint8_t> bytes) {
  Sha256 digest;
  digest.update(bytes);
  return digest.finish();
}

std::string to_lower_hex(std::span<const std::uint8_t> bytes) {
  std::ostringstream output;
  output << std::hex << std::setfill('0');
  for (const std::uint8_t value : bytes)
    output << std::setw(2) << static_cast<unsigned int>(value);
  return output.str();
}

std::string hex_sha256(std::span<const std::uint8_t> bytes) { return to_lower_hex(sha256(bytes)); }

} // namespace local_whisper::common
