#ifdef _WIN32
#define NOMINMAX
#include <windows.h>

#include "local_whisper/common/model_authority.hpp"
#include "local_whisper/common/windows_process_identity.hpp"
#else
#include "local_whisper/common/authority_bootstrap.hpp"
#endif

#include <array>
#ifndef _WIN32
#include <cerrno>
#endif
#include <cstdint>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

#ifdef _WIN32
#include <io.h>
#else
#include <unistd.h>
#endif

namespace {

void read_exact(const int descriptor, std::span<std::uint8_t> output) {
  while (!output.empty()) {
#ifdef _WIN32
    const intptr_t raw_handle = _get_osfhandle(descriptor);
    if (raw_handle == -1)
      throw std::runtime_error("authority fixture descriptor unavailable");
    DWORD count = 0;
    if (!ReadFile(reinterpret_cast<HANDLE>(raw_handle), output.data(),
                  static_cast<DWORD>(output.size()), &count, nullptr) ||
        count == 0U) {
      throw std::runtime_error("authority fixture input failed");
    }
#else
    const ssize_t count = read(descriptor, output.data(), output.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority fixture input failed");
#endif
    output = output.subspan(static_cast<std::size_t>(count));
  }
}

void write_exact(const int descriptor, std::span<const std::uint8_t> input) {
  while (!input.empty()) {
#ifdef _WIN32
    const intptr_t raw_handle = _get_osfhandle(descriptor);
    if (raw_handle == -1)
      throw std::runtime_error("authority fixture descriptor unavailable");
    DWORD count = 0;
    if (!WriteFile(reinterpret_cast<HANDLE>(raw_handle), input.data(),
                   static_cast<DWORD>(input.size()), &count, nullptr) ||
        count == 0U) {
      throw std::runtime_error("authority fixture output failed");
    }
#else
    const ssize_t count = write(descriptor, input.data(), input.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority fixture output failed");
#endif
    input = input.subspan(static_cast<std::size_t>(count));
  }
}

#ifdef _WIN32
void receive_model_authority() {
  std::array<std::uint8_t, local_whisper::common::kAuthorityTransferBytes> bytes{};
  read_exact(0, bytes);
  const auto decoded = local_whisper::common::decode_authority_record(bytes);
  const auto* transfer = std::get_if<local_whisper::common::AuthorityTransfer>(&decoded);
  if (transfer == nullptr || transfer->hop != 2U || transfer->carrier_value == 0U ||
      transfer->carrier_kind !=
          local_whisper::common::AuthorityCarrierKind::windows_worker_handle ||
      transfer->binding.artifact_kind !=
          local_whisper::common::AuthorityArtifactKind::regular_file) {
    throw std::runtime_error("authority fixture transfer invalid");
  }
  const HANDLE model_handle =
      reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(transfer->carrier_value));
  if (GetFileType(model_handle) != FILE_TYPE_DISK)
    throw std::runtime_error("authority fixture handle invalid");
  const auto acknowledgment =
      local_whisper::common::encode_authority_record(local_whisper::common::AuthorityAcknowledgment{
          transfer->binding, transfer->carrier_kind, transfer->carrier_value, GetCurrentProcessId(),
          local_whisper::common::windows_process_start_identity_sha256(GetCurrentProcess())});
  write_exact(1, acknowledgment);
  std::array<std::uint8_t, 1> release{};
  read_exact(0, release);
  if (release[0] != 1U)
    throw std::runtime_error("authority fixture release invalid");
  static_cast<void>(CloseHandle(model_handle));
}
#endif

std::uint32_t read_big_endian_u32(const std::array<std::uint8_t, 5>& header) {
  return (static_cast<std::uint32_t>(header[0]) << 24U) |
         (static_cast<std::uint32_t>(header[1]) << 16U) |
         (static_cast<std::uint32_t>(header[2]) << 8U) | static_cast<std::uint32_t>(header[3]);
}

void exchange_framed_handshake() {
  std::array<std::uint8_t, 5> header{};
  read_exact(0, header);
  const std::uint32_t body_size = read_big_endian_u32(header);
  if (header[4] != 1U || body_size == 0U || body_size > 1024U * 1024U)
    throw std::runtime_error("authority fixture hello invalid");
  std::vector<std::uint8_t> body(body_size);
  read_exact(0, body);
  constexpr std::string_view acknowledgment =
      R"({"type":"helloAck","protocolVersion":1,"engine":"whisperCpp","runtimeRevision":"authority-fixture-v1","runtimeBuildDigest":"authority-fixture-build","backend":"cpu","capabilities":["authority-fixture"],"maxControlFrameBytes":1048576,"maxAudioChunkBytes":1048576})";
  std::array<std::uint8_t, 5> response_header = {
      static_cast<std::uint8_t>((acknowledgment.size() >> 24U) & 0xffU),
      static_cast<std::uint8_t>((acknowledgment.size() >> 16U) & 0xffU),
      static_cast<std::uint8_t>((acknowledgment.size() >> 8U) & 0xffU),
      static_cast<std::uint8_t>(acknowledgment.size() & 0xffU), 1U};
  write_exact(1, response_header);
  write_exact(
      1, std::span<const std::uint8_t>(reinterpret_cast<const std::uint8_t*>(acknowledgment.data()),
                                       acknowledgment.size()));
}

} // namespace

int main(int argc, char** argv) {
  if (argc != 2)
    return 2;
  try {
#ifdef _WIN32
    receive_model_authority();
#else
    static_cast<void>(local_whisper::common::receive_worker_model_bootstrap(0, 1, 3));
#endif
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
