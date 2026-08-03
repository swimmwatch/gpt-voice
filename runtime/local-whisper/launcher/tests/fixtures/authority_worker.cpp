#include "local_whisper/common/authority_bootstrap.hpp"

#include <array>
#include <cerrno>
#include <cstdint>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <unistd.h>

namespace {

void read_exact(const int descriptor, std::span<std::uint8_t> output) {
  while (!output.empty()) {
    const ssize_t count = read(descriptor, output.data(), output.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority fixture input failed");
    output = output.subspan(static_cast<std::size_t>(count));
  }
}

void write_exact(const int descriptor, std::span<const std::uint8_t> input) {
  while (!input.empty()) {
    const ssize_t count = write(descriptor, input.data(), input.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority fixture output failed");
    input = input.subspan(static_cast<std::size_t>(count));
  }
}

std::uint32_t read_big_endian_u32(const std::array<std::uint8_t, 5>& header) {
  return (static_cast<std::uint32_t>(header[0]) << 24U) |
         (static_cast<std::uint32_t>(header[1]) << 16U) |
         (static_cast<std::uint32_t>(header[2]) << 8U) | static_cast<std::uint32_t>(header[3]);
}

void exchange_framed_handshake() {
  std::array<std::uint8_t, 5> header{};
  read_exact(STDIN_FILENO, header);
  const std::uint32_t body_size = read_big_endian_u32(header);
  if (header[4] != 1U || body_size == 0U || body_size > 1024U * 1024U)
    throw std::runtime_error("authority fixture hello invalid");
  std::vector<std::uint8_t> body(body_size);
  read_exact(STDIN_FILENO, body);
  constexpr std::string_view acknowledgment =
      R"({"type":"helloAck","protocolVersion":1,"engine":"whisperCpp","runtimeRevision":"authority-fixture-v1","runtimeBuildDigest":"authority-fixture-build","backend":"cpu","capabilities":["authority-fixture"],"maxControlFrameBytes":1048576,"maxAudioChunkBytes":1048576})";
  std::array<std::uint8_t, 5> response_header = {
      static_cast<std::uint8_t>((acknowledgment.size() >> 24U) & 0xffU),
      static_cast<std::uint8_t>((acknowledgment.size() >> 16U) & 0xffU),
      static_cast<std::uint8_t>((acknowledgment.size() >> 8U) & 0xffU),
      static_cast<std::uint8_t>(acknowledgment.size() & 0xffU), 1U};
  write_exact(STDOUT_FILENO, response_header);
  write_exact(STDOUT_FILENO, std::span<const std::uint8_t>(
                                 reinterpret_cast<const std::uint8_t*>(acknowledgment.data()),
                                 acknowledgment.size()));
}

} // namespace

int main(int argc, char** argv) {
  if (argc != 2)
    return 2;
  try {
    static_cast<void>(
        local_whisper::common::receive_worker_model_bootstrap(STDIN_FILENO, STDOUT_FILENO, 3));
    if (std::string_view(argv[1]) == "--load") {
      exchange_framed_handshake();
      return 0;
    }
    if (std::string_view(argv[1]) != "--authority-worker-fixture")
      return 2;
    return 0;
  } catch (...) {
    return 10;
  }
}
