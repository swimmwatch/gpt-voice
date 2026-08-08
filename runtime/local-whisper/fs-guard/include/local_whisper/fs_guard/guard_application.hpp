#pragma once

#include <iosfwd>

namespace local_whisper::fs_guard {

class Backend;

class GuardApplication final {
public:
  explicit GuardApplication(Backend& backend) noexcept;

  int run(std::istream& input, std::ostream& output);

private:
  Backend& backend_;
};

} // namespace local_whisper::fs_guard
