#include "sha256_internal.hpp"

#include <bit>
#include <cstring>
#include <immintrin.h>

namespace local_whisper::common::detail {
namespace {

[[nodiscard]] int signed_lane(const std::uint32_t value) noexcept {
  return std::bit_cast<std::int32_t>(value);
}

[[nodiscard]] __m128i round_message(const std::array<std::uint32_t, 64>& words,
                                    const std::size_t offset) noexcept {
  return _mm_set_epi32(signed_lane(words[offset + 3U] + kSha256RoundConstants[offset + 3U]),
                       signed_lane(words[offset + 2U] + kSha256RoundConstants[offset + 2U]),
                       signed_lane(words[offset + 1U] + kSha256RoundConstants[offset + 1U]),
                       signed_lane(words[offset] + kSha256RoundConstants[offset]));
}

} // namespace

void sha256_transform_x86(Sha256State& state, const std::uint8_t* block) noexcept {
  std::array<std::uint32_t, 64> words{};
  for (std::size_t index = 0; index < 16U; ++index) {
    const std::size_t offset = index * 4U;
    words[index] = (static_cast<std::uint32_t>(block[offset]) << 24U) |
                   (static_cast<std::uint32_t>(block[offset + 1U]) << 16U) |
                   (static_cast<std::uint32_t>(block[offset + 2U]) << 8U) |
                   static_cast<std::uint32_t>(block[offset + 3U]);
  }
  for (std::size_t index = 16U; index < words.size(); ++index) {
    const std::uint32_t s0 = rotate_right(words[index - 15U], 7U) ^
                             rotate_right(words[index - 15U], 18U) ^ (words[index - 15U] >> 3U);
    const std::uint32_t s1 = rotate_right(words[index - 2U], 17U) ^
                             rotate_right(words[index - 2U], 19U) ^ (words[index - 2U] >> 10U);
    words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
  }

  __m128i state_abef = _mm_set_epi32(signed_lane(state[0]), signed_lane(state[1]),
                                     signed_lane(state[4]), signed_lane(state[5]));
  __m128i state_cdgh = _mm_set_epi32(signed_lane(state[2]), signed_lane(state[3]),
                                     signed_lane(state[6]), signed_lane(state[7]));
  const __m128i saved_abef = state_abef;
  const __m128i saved_cdgh = state_cdgh;

  for (std::size_t offset = 0U; offset < words.size(); offset += 4U) {
    __m128i message = round_message(words, offset);
    state_cdgh = _mm_sha256rnds2_epu32(state_cdgh, state_abef, message);
    message = _mm_shuffle_epi32(message, 0x0e);
    state_abef = _mm_sha256rnds2_epu32(state_abef, state_cdgh, message);
  }

  state_abef = _mm_add_epi32(state_abef, saved_abef);
  state_cdgh = _mm_add_epi32(state_cdgh, saved_cdgh);
  std::array<std::uint32_t, 4> abef{};
  std::array<std::uint32_t, 4> cdgh{};
  static_assert(sizeof(abef) == sizeof(state_abef));
  std::memcpy(abef.data(), &state_abef, sizeof(state_abef));
  std::memcpy(cdgh.data(), &state_cdgh, sizeof(state_cdgh));
  state = {abef[3], abef[2], cdgh[3], cdgh[2], abef[1], abef[0], cdgh[1], cdgh[0]};
}

} // namespace local_whisper::common::detail
