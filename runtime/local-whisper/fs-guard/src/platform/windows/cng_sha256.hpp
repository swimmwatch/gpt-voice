#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
// clang-format off
#include <windows.h>
#include <bcrypt.h>
// clang-format on

#include <cstdint>
#include <functional>
#include <span>
#include <string>
#include <vector>

namespace local_whisper::fs_guard::windows_crypto {

using ResourceAcquisitionObserver = std::function<void()>;

class CngSha256 final {
public:
  explicit CngSha256(ResourceAcquisitionObserver before_resource_acquisition = {});
  ~CngSha256() noexcept;

  CngSha256(const CngSha256&) = delete;
  CngSha256& operator=(const CngSha256&) = delete;
  CngSha256(CngSha256&&) = delete;
  CngSha256& operator=(CngSha256&&) = delete;

  void update(std::span<const std::uint8_t> bytes);
  [[nodiscard]] std::string finish();

private:
  void before_resource_acquisition();
  void release() noexcept;

  ResourceAcquisitionObserver before_resource_acquisition_;
  BCRYPT_ALG_HANDLE algorithm_ = nullptr;
  BCRYPT_HASH_HANDLE hash_ = nullptr;
  std::vector<std::uint8_t> object_;
  bool finished_ = false;
};

} // namespace local_whisper::fs_guard::windows_crypto
