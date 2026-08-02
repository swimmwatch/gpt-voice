#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "local_whisper/fs_guard/model_authority_server.hpp"

#include "local_whisper/common/linux_process_identity.hpp"
#include "local_whisper/common/sha256.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <span>
#include <variant>
#include <vector>

#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

namespace local_whisper::fs_guard {
namespace {

struct ReceivedRequest final {
  local_whisper::common::AuthorityRequest request;
  struct ucred credentials {};
};

void enable_credentials(int descriptor) {
  constexpr int enabled = 1;
  if (setsockopt(descriptor, SOL_SOCKET, SO_PASSCRED, &enabled, sizeof(enabled)) != 0)
    throw std::runtime_error("model authority credential setup failed");
}

ReceivedRequest receive_request(int descriptor) {
  std::array<std::uint8_t, local_whisper::common::kAuthorityRequestBytes> bytes{};
  std::array<std::byte, CMSG_SPACE(sizeof(struct ucred))> control{};
  struct iovec vector {
    bytes.data(), bytes.size()
  };
  struct msghdr message {};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = control.data();
  message.msg_controllen = control.size();
  const ssize_t count = recvmsg(descriptor, &message, MSG_CMSG_CLOEXEC);
  if (count != static_cast<ssize_t>(bytes.size()) ||
      (message.msg_flags & (MSG_TRUNC | MSG_CTRUNC)) != 0) {
    throw std::runtime_error("invalid model authority request packet");
  }
  const struct ucred* credentials = nullptr;
  std::size_t credential_count = 0;
  for (struct cmsghdr* header = CMSG_FIRSTHDR(&message); header != nullptr;
       header = CMSG_NXTHDR(&message, header)) {
    if (header->cmsg_level != SOL_SOCKET || header->cmsg_type != SCM_CREDENTIALS ||
        header->cmsg_len != CMSG_LEN(sizeof(struct ucred))) {
      throw std::runtime_error("unexpected model authority request control data");
    }
    credentials = reinterpret_cast<const struct ucred*>(CMSG_DATA(header));
    ++credential_count;
  }
  const auto decoded = local_whisper::common::decode_authority_record(bytes);
  const auto* request = std::get_if<local_whisper::common::AuthorityRequest>(&decoded);
  if (request == nullptr || credentials == nullptr || credential_count != 1U)
    throw std::runtime_error("invalid model authority request");
  return {*request, *credentials};
}

void send_transfer(int channel_descriptor, int model_descriptor,
                   const local_whisper::common::AuthorityBinding& binding) {
  const auto transfer =
      local_whisper::common::encode_authority_record(local_whisper::common::AuthorityTransfer{
          binding, 1, local_whisper::common::AuthorityCarrierKind::linux_rights, 0});
  std::array<std::byte, CMSG_SPACE(sizeof(struct ucred)) + CMSG_SPACE(sizeof(model_descriptor))>
      control{};
  struct iovec vector {
    const_cast<std::uint8_t*>(transfer.data()), transfer.size()
  };
  struct msghdr message {};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = control.data();
  message.msg_controllen = control.size();

  struct cmsghdr* credentials_header = CMSG_FIRSTHDR(&message);
  if (credentials_header == nullptr)
    throw std::runtime_error("model authority credential buffer failed");
  credentials_header->cmsg_level = SOL_SOCKET;
  credentials_header->cmsg_type = SCM_CREDENTIALS;
  credentials_header->cmsg_len = CMSG_LEN(sizeof(struct ucred));
  const struct ucred credentials = {getpid(), geteuid(), getegid()};
  std::memcpy(CMSG_DATA(credentials_header), &credentials, sizeof(credentials));

  struct cmsghdr* rights_header = CMSG_NXTHDR(&message, credentials_header);
  if (rights_header == nullptr)
    throw std::runtime_error("model authority rights buffer failed");
  rights_header->cmsg_level = SOL_SOCKET;
  rights_header->cmsg_type = SCM_RIGHTS;
  rights_header->cmsg_len = CMSG_LEN(sizeof(model_descriptor));
  std::memcpy(CMSG_DATA(rights_header), &model_descriptor, sizeof(model_descriptor));

  if (sendmsg(channel_descriptor, &message, MSG_NOSIGNAL) !=
      static_cast<ssize_t>(transfer.size())) {
    throw std::runtime_error("model authority transfer failed");
  }
}

void validate_regular_file_evidence(
    int descriptor, const local_whisper::common::AuthorityBinding& binding) {
  if (binding.artifact_kind != local_whisper::common::AuthorityArtifactKind::regular_file)
    return;
  struct stat metadata {};
  if (fstat(descriptor, &metadata) != 0 || !S_ISREG(metadata.st_mode) || metadata.st_size <= 0 ||
      static_cast<std::uint64_t>(metadata.st_size) != binding.expected_artifact_bytes) {
    throw std::runtime_error("guarded model size evidence mismatch");
  }
  local_whisper::common::Sha256 digest;
  std::vector<std::uint8_t> buffer(64U * 1024U);
  std::uint64_t offset = 0;
  while (offset < binding.expected_artifact_bytes) {
    const auto remaining = binding.expected_artifact_bytes - offset;
    const auto requested = std::min<std::uint64_t>(remaining, buffer.size());
    const ssize_t count = pread(descriptor, buffer.data(), static_cast<std::size_t>(requested),
                                static_cast<off_t>(offset));
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("guarded model digest read failed");
    digest.update(std::span<const std::uint8_t>(buffer.data(), static_cast<std::size_t>(count)));
    offset += static_cast<std::uint64_t>(count);
  }
  if (digest.finish() != binding.artifact_content_sha256)
    throw std::runtime_error("guarded model digest evidence mismatch");
}

} // namespace

LinuxModelAuthorityServer::LinuxModelAuthorityServer(
    local_whisper::common::AuthorityBinding expected_binding, int model_descriptor)
    : expected_binding_(std::move(expected_binding)), model_descriptor_(model_descriptor) {
  if (model_descriptor_ < 0)
    throw std::runtime_error("invalid guarded model descriptor");
  validate_regular_file_evidence(model_descriptor_, expected_binding_);
}

void LinuxModelAuthorityServer::transfer_once(int channel_descriptor) {
  enable_credentials(channel_descriptor);
  const ReceivedRequest received = receive_request(channel_descriptor);
  if (received.request.binding != expected_binding_ ||
      received.credentials.pid != static_cast<pid_t>(expected_binding_.expected_launcher_pid) ||
      received.credentials.uid != geteuid() || received.credentials.gid != getegid() ||
      getpid() != static_cast<pid_t>(expected_binding_.expected_guard_pid) ||
      local_whisper::common::linux_process_start_identity_sha256(received.credentials.pid) !=
          expected_binding_.expected_launcher_start_identity_sha256 ||
      local_whisper::common::linux_process_start_identity_sha256(getpid()) !=
          expected_binding_.expected_guard_start_identity_sha256 ||
      !replay_guard_.consume(received.request.binding.operation_nonce)) {
    throw std::runtime_error("model authority request binding failed");
  }
  send_transfer(channel_descriptor, model_descriptor_, received.request.binding);
}

} // namespace local_whisper::fs_guard
