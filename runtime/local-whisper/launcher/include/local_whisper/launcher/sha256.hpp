#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>

namespace local_whisper::launcher {

class Sha256 final {
public:
  Sha256();

  void update(const unsigned char* bytes, std::size_t length);
  [[nodiscard]] std::string finish_hex();

private:
  void transform(const unsigned char* block);

  std::array<std::uint32_t, 8> state_{};
  std::array<unsigned char, 64> buffer_{};
  std::uint64_t total_bytes_ = 0;
  std::size_t buffered_bytes_ = 0;
  bool finished_ = false;
};

} // namespace local_whisper::launcher
