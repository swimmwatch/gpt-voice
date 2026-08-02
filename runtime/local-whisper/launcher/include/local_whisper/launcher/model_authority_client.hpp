#pragma once

#include "local_whisper/common/model_authority.hpp"

namespace local_whisper::launcher {

class UniqueModelDescriptor final {
public:
  explicit UniqueModelDescriptor(int value = -1) noexcept;
  ~UniqueModelDescriptor() noexcept;

  UniqueModelDescriptor(const UniqueModelDescriptor&) = delete;
  UniqueModelDescriptor& operator=(const UniqueModelDescriptor&) = delete;
  UniqueModelDescriptor(UniqueModelDescriptor&& other) noexcept;
  UniqueModelDescriptor& operator=(UniqueModelDescriptor&& other) noexcept;

  [[nodiscard]] int get() const noexcept;
  [[nodiscard]] int release() noexcept;
  void reset(int value = -1) noexcept;

private:
  int value_;
};

class LinuxModelAuthorityClient final {
public:
  [[nodiscard]] UniqueModelDescriptor
  acquire(int channel_descriptor, const local_whisper::common::AuthorityBinding& binding) const;

  [[nodiscard]] static int install_at_logical_slot(UniqueModelDescriptor descriptor);
};

} // namespace local_whisper::launcher
