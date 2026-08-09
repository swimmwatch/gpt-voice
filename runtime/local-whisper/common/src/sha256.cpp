#include "local_whisper/common/sha256.hpp"

#include <algorithm>
#include <array>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace local_whisper::common {
namespace {

constexpr std::array<std::uint32_t, 64> kRoundConstants = {
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU, 0x59f111f1U, 0x923f82a4U,
    0xab1c5ed5U, 0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U, 0x72be5d74U, 0x80deb1feU,
    0x9bdc06a7U, 0xc19bf174U, 0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU, 0x2de92c6fU,
    0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU, 0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
    0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU,
    0x53380d13U, 0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U, 0xa2bfe8a1U, 0xa81a664bU,
    0xc24b8b70U, 0xc76c51a3U, 0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U, 0x19a4c116U,
    0x1e376c08U, 0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
    0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U, 0x90befffaU, 0xa4506cebU, 0xbef9a3f7U,
    0xc67178f2U};

constexpr std::uint32_t rotate_right(std::uint32_t value, unsigned int shift) {
  return (value >> shift) | (value << (32U - shift));
}

} // namespace

Sha256::Sha256()
    : state_{0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
             0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U} {}

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
      transform(buffer_.data());
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
    transform(buffer_.data());
    buffered_bytes_ = 0;
  }
  std::fill(buffer_.begin() + static_cast<std::ptrdiff_t>(buffered_bytes_), buffer_.begin() + 56,
            static_cast<std::uint8_t>(0));
  for (std::size_t index = 0; index < 8; ++index)
    buffer_.at(63 - index) = static_cast<std::uint8_t>(bit_length >> (index * 8U));
  transform(buffer_.data());
  finished_ = true;

  std::array<std::uint8_t, 32> digest{};
  for (std::size_t index = 0; index < state_.size(); ++index) {
    for (std::size_t byte = 0; byte < 4; ++byte)
      digest.at(index * 4 + byte) =
          static_cast<std::uint8_t>(state_.at(index) >> ((3U - byte) * 8U));
  }
  return digest;
}

void Sha256::transform(const std::uint8_t* block) {
  std::array<std::uint32_t, 64> words{};
  for (std::size_t index = 0; index < 16; ++index) {
    const std::size_t offset = index * 4;
    words.at(index) = (static_cast<std::uint32_t>(block[offset]) << 24U) |
                      (static_cast<std::uint32_t>(block[offset + 1]) << 16U) |
                      (static_cast<std::uint32_t>(block[offset + 2]) << 8U) |
                      static_cast<std::uint32_t>(block[offset + 3]);
  }
  for (std::size_t index = 16; index < words.size(); ++index) {
    const std::uint32_t s0 = rotate_right(words.at(index - 15), 7) ^
                             rotate_right(words.at(index - 15), 18) ^ (words.at(index - 15) >> 3U);
    const std::uint32_t s1 = rotate_right(words.at(index - 2), 17) ^
                             rotate_right(words.at(index - 2), 19) ^ (words.at(index - 2) >> 10U);
    words.at(index) = words.at(index - 16) + s0 + words.at(index - 7) + s1;
  }
  std::array<std::uint32_t, 8> working = state_;
  for (std::size_t index = 0; index < words.size(); ++index) {
    const std::uint32_t choice = (working[4] & working[5]) ^ ((~working[4]) & working[6]);
    const std::uint32_t majority =
        (working[0] & working[1]) ^ (working[0] & working[2]) ^ (working[1] & working[2]);
    const std::uint32_t upper_sigma =
        rotate_right(working[4], 6) ^ rotate_right(working[4], 11) ^ rotate_right(working[4], 25);
    const std::uint32_t lower_sigma =
        rotate_right(working[0], 2) ^ rotate_right(working[0], 13) ^ rotate_right(working[0], 22);
    const std::uint32_t temporary1 =
        working[7] + upper_sigma + choice + kRoundConstants.at(index) + words.at(index);
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
  for (std::size_t index = 0; index < state_.size(); ++index)
    state_.at(index) += working.at(index);
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
