#include "sha256_internal.hpp"

#include <array>

#if defined(_MSC_VER) && defined(_M_X64)
#include <intrin.h>
#elif (defined(__GNUC__) || defined(__clang__)) && defined(__x86_64__)
#include <cpuid.h>
#else
#error "Local Whisper SHA-256 runtime dispatch requires a supported x64 compiler"
#endif

namespace local_whisper::common::detail {
namespace {

constexpr unsigned int kShaExtensionBit = 1U << 29U;

[[nodiscard]] bool detect_sha_extension() noexcept {
#if defined(_MSC_VER)
  std::array<int, 4> registers{};
  __cpuid(registers.data(), 0);
  if (registers[0] < 7)
    return false;
  __cpuidex(registers.data(), 7, 0);
  return (static_cast<unsigned int>(registers[1]) & kShaExtensionBit) != 0U;
#else
  if (__get_cpuid_max(0U, nullptr) < 7U)
    return false;
  unsigned int eax = 0U;
  unsigned int ebx = 0U;
  unsigned int ecx = 0U;
  unsigned int edx = 0U;
  __cpuid_count(7U, 0U, eax, ebx, ecx, edx);
  return (ebx & kShaExtensionBit) != 0U;
#endif
}

} // namespace

bool sha256_x86_runtime_supported() noexcept {
  static const bool supported = detect_sha_extension();
  return supported;
}

Sha256BlockTransform sha256_transform_for_support(const bool supported) noexcept {
  return supported ? &sha256_transform_x86 : &sha256_transform_scalar;
}

Sha256BlockTransform default_sha256_transform() noexcept {
  static const Sha256BlockTransform transform =
      sha256_transform_for_support(sha256_x86_runtime_supported());
  return transform;
}

} // namespace local_whisper::common::detail
