#include "platform/windows/cng_sha256.hpp"

#include "local_whisper/common/sha256.hpp"

#include <algorithm>
#include <array>
#include <limits>
#include <stdexcept>
#include <utility>

namespace local_whisper::fs_guard::windows_crypto {

CngSha256::CngSha256(ResourceAcquisitionObserver observer)
    : before_resource_acquisition_(std::move(observer)) {
  try {
    before_resource_acquisition();
    if (BCryptOpenAlgorithmProvider(&algorithm_, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0)
      throw std::runtime_error("CNG SHA-256 initialization failed");

    DWORD object_bytes = 0;
    DWORD transferred = 0;
    if (BCryptGetProperty(algorithm_, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&object_bytes),
                          sizeof(object_bytes), &transferred, 0) < 0 ||
        object_bytes == 0U) {
      throw std::runtime_error("CNG SHA-256 initialization failed");
    }
    object_.resize(object_bytes);

    before_resource_acquisition();
    if (BCryptCreateHash(algorithm_, &hash_, object_.data(), object_bytes, nullptr, 0, 0) < 0)
      throw std::runtime_error("CNG SHA-256 initialization failed");
  } catch (...) {
    release();
    throw;
  }
}

CngSha256::~CngSha256() noexcept { release(); }

void CngSha256::release() noexcept {
  if (hash_ != nullptr)
    static_cast<void>(BCryptDestroyHash(hash_));
  hash_ = nullptr;
  if (algorithm_ != nullptr)
    static_cast<void>(BCryptCloseAlgorithmProvider(algorithm_, 0));
  algorithm_ = nullptr;
}

void CngSha256::update(std::span<const std::uint8_t> bytes) {
  if (finished_)
    throw std::runtime_error("CNG SHA-256 already finished");
  while (!bytes.empty()) {
    const std::size_t count =
        std::min(bytes.size(), static_cast<std::size_t>(std::numeric_limits<ULONG>::max()));
    auto* data = const_cast<PUCHAR>(reinterpret_cast<const UCHAR*>(bytes.data()));
    if (BCryptHashData(hash_, data, static_cast<ULONG>(count), 0) < 0)
      throw std::runtime_error("CNG SHA-256 update failed");
    bytes = bytes.subspan(count);
  }
}

std::string CngSha256::finish() {
  if (finished_)
    throw std::runtime_error("CNG SHA-256 already finished");
  std::array<std::uint8_t, 32> digest{};
  if (BCryptFinishHash(hash_, digest.data(), static_cast<ULONG>(digest.size()), 0) < 0)
    throw std::runtime_error("CNG SHA-256 finish failed");
  finished_ = true;
  return local_whisper::common::to_lower_hex(digest);
}

void CngSha256::before_resource_acquisition() {
  if (before_resource_acquisition_)
    before_resource_acquisition_();
}

} // namespace local_whisper::fs_guard::windows_crypto
