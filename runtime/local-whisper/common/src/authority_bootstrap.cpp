#include "local_whisper/common/authority_bootstrap.hpp"

#include "local_whisper/common/linux_process_identity.hpp"

#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <variant>
#include <vector>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace local_whisper::common {
namespace {

void write_exact(int descriptor, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = write(descriptor, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority bootstrap write failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

std::vector<std::uint8_t> read_exact(int descriptor, std::size_t size) {
  std::vector<std::uint8_t> bytes(size);
  std::size_t offset = 0;
  while (offset < size) {
    const ssize_t count = read(descriptor, bytes.data() + offset, size - offset);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("authority bootstrap read failed");
    offset += static_cast<std::size_t>(count);
  }
  return bytes;
}

void validate_model_descriptor(int descriptor, AuthorityArtifactKind expected_kind) {
  struct stat metadata {};
  const int status_flags = fcntl(descriptor, F_GETFL);
  const int descriptor_flags = fcntl(descriptor, F_GETFD);
  if (fstat(descriptor, &metadata) != 0 || status_flags < 0 || descriptor_flags < 0 ||
      (status_flags & O_ACCMODE) != O_RDONLY ||
      (expected_kind == AuthorityArtifactKind::regular_file && !S_ISREG(metadata.st_mode)) ||
      (expected_kind == AuthorityArtifactKind::directory && !S_ISDIR(metadata.st_mode)) ||
      (descriptor_flags & FD_CLOEXEC) != 0) {
    throw std::runtime_error("invalid worker model authority descriptor");
  }
}

} // namespace

void authorize_worker_model_bootstrap(
    int worker_input_descriptor, int worker_output_descriptor, const AuthorityBinding& binding,
    std::uint64_t worker_pid, const std::array<std::uint8_t, 32>& worker_start_identity_sha256) {
  const auto transfer = encode_authority_record(AuthorityTransfer{
      binding, 2, AuthorityCarrierKind::linux_worker_fd, static_cast<std::uint64_t>(3)});
  write_exact(worker_input_descriptor, transfer);
  const auto bytes = read_exact(worker_output_descriptor, kAuthorityAcknowledgmentBytes);
  const auto decoded = decode_authority_record(bytes);
  const auto* acknowledgment = std::get_if<AuthorityAcknowledgment>(&decoded);
  if (acknowledgment == nullptr || acknowledgment->binding != binding ||
      acknowledgment->carrier_kind != AuthorityCarrierKind::linux_worker_fd ||
      acknowledgment->carrier_value != 3U || acknowledgment->worker_pid != worker_pid ||
      acknowledgment->worker_start_identity_sha256 != worker_start_identity_sha256) {
    throw std::runtime_error("invalid worker model authority acknowledgment");
  }
  constexpr std::array<std::uint8_t, 1> release = {1};
  write_exact(worker_input_descriptor, release);
}

AuthorityBinding receive_worker_model_bootstrap(int input_descriptor, int output_descriptor,
                                                int model_descriptor) {
  const auto bytes = read_exact(input_descriptor, kAuthorityTransferBytes);
  const auto decoded = decode_authority_record(bytes);
  const auto* transfer = std::get_if<AuthorityTransfer>(&decoded);
  if (transfer == nullptr || transfer->hop != 2U ||
      transfer->carrier_kind != AuthorityCarrierKind::linux_worker_fd ||
      transfer->carrier_value != static_cast<std::uint64_t>(model_descriptor)) {
    throw std::runtime_error("invalid worker model authority transfer");
  }
  validate_model_descriptor(model_descriptor, transfer->binding.artifact_kind);
  const auto start_identity = linux_process_start_identity_sha256(getpid());
  const auto acknowledgment = encode_authority_record(
      AuthorityAcknowledgment{transfer->binding, AuthorityCarrierKind::linux_worker_fd,
                              static_cast<std::uint64_t>(model_descriptor),
                              static_cast<std::uint64_t>(getpid()), start_identity});
  write_exact(output_descriptor, acknowledgment);
  const auto release = read_exact(input_descriptor, 1);
  if (release.front() != 1U)
    throw std::runtime_error("invalid worker model authority release");
  return transfer->binding;
}

} // namespace local_whisper::common
