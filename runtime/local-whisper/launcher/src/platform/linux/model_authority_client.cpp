#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "local_whisper/launcher/model_authority_client.hpp"

#include "local_whisper/common/linux_process_identity.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <limits>
#include <optional>
#include <stdexcept>
#include <utility>
#include <variant>
#include <vector>

#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

namespace local_whisper::launcher {
namespace {

void enable_credentials(int descriptor) {
  constexpr int enabled = 1;
  if (setsockopt(descriptor, SOL_SOCKET, SO_PASSCRED, &enabled, sizeof(enabled)) != 0)
    throw std::runtime_error("model authority credential setup failed");
}

void send_request(int descriptor, const local_whisper::common::AuthorityBinding& binding) {
  const auto request = local_whisper::common::encode_authority_record(
      local_whisper::common::AuthorityRequest{binding});
  std::array<std::byte, CMSG_SPACE(sizeof(struct ucred))> control{};
  struct iovec vector {
    const_cast<std::uint8_t*>(request.data()), request.size()
  };
  struct msghdr message {};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = control.data();
  message.msg_controllen = control.size();
  struct cmsghdr* header = CMSG_FIRSTHDR(&message);
  if (header == nullptr)
    throw std::runtime_error("model authority request control buffer failed");
  header->cmsg_level = SOL_SOCKET;
  header->cmsg_type = SCM_CREDENTIALS;
  header->cmsg_len = CMSG_LEN(sizeof(struct ucred));
  const struct ucred credentials = {getpid(), geteuid(), getegid()};
  std::memcpy(CMSG_DATA(header), &credentials, sizeof(credentials));
  if (sendmsg(descriptor, &message, MSG_NOSIGNAL) != static_cast<ssize_t>(request.size()))
    throw std::runtime_error("model authority request failed");
}

UniqueModelDescriptor receive_transfer(int descriptor,
                                       const local_whisper::common::AuthorityBinding& binding) {
  std::array<std::uint8_t, local_whisper::common::kAuthorityTransferBytes> bytes{};
  // A peer can attach more than one SCM_RIGHTS record. Own every descriptor the kernel installs
  // before examining the transfer semantics, including when a later record makes it invalid.
  std::array<std::byte, 512> control{};
  struct iovec vector {
    bytes.data(), bytes.size()
  };
  struct msghdr message {};
  message.msg_iov = &vector;
  message.msg_iovlen = 1;
  message.msg_control = control.data();
  message.msg_controllen = control.size();
  const ssize_t count = recvmsg(descriptor, &message, MSG_CMSG_CLOEXEC);
  std::optional<struct ucred> credentials;
  std::vector<UniqueModelDescriptor> received_descriptors;
  int received_descriptor = -1;
  std::size_t credential_count = 0;
  std::size_t rights_count = 0;
  bool malformed_control = false;
  bool unexpected_control = false;
  const auto* control_begin = static_cast<const std::byte*>(message.msg_control);
  const auto* control_end = control_begin + message.msg_controllen;
  for (struct cmsghdr* header = CMSG_FIRSTHDR(&message); header != nullptr;
       header = CMSG_NXTHDR(&message, header)) {
    const auto* header_begin = reinterpret_cast<const std::byte*>(header);
    if (header_begin < control_begin || header_begin > control_end ||
        static_cast<std::size_t>(control_end - header_begin) < header->cmsg_len ||
        header->cmsg_len < CMSG_LEN(0)) {
      malformed_control = true;
      break;
    }
    const std::size_t payload_bytes = header->cmsg_len - CMSG_LEN(0);
    if (header->cmsg_level == SOL_SOCKET && header->cmsg_type == SCM_CREDENTIALS &&
        payload_bytes == sizeof(struct ucred)) {
      struct ucred value {};
      std::memcpy(&value, CMSG_DATA(header), sizeof(value));
      credentials = value;
      ++credential_count;
    } else if (header->cmsg_level == SOL_SOCKET && header->cmsg_type == SCM_RIGHTS) {
      if (payload_bytes == 0U || payload_bytes % sizeof(int) != 0U) {
        malformed_control = true;
        continue;
      }
      const std::size_t descriptor_count = payload_bytes / sizeof(int);
      if (descriptor_count > std::numeric_limits<std::size_t>::max() - rights_count) {
        malformed_control = true;
        continue;
      }
      std::vector<int> values(descriptor_count);
      std::memcpy(values.data(), CMSG_DATA(header), payload_bytes);
      for (const int value : values)
        received_descriptors.emplace_back(value);
      rights_count += descriptor_count;
    } else {
      unexpected_control = true;
    }
  }
  if (rights_count == 1U)
    received_descriptor = received_descriptors.front().get();
  const auto decoded = local_whisper::common::decode_authority_record(bytes);
  const auto* transfer = std::get_if<local_whisper::common::AuthorityTransfer>(&decoded);
  if (count != static_cast<ssize_t>(bytes.size()) ||
      (message.msg_flags & (MSG_TRUNC | MSG_CTRUNC)) != 0 || malformed_control ||
      unexpected_control || !credentials.has_value() || credential_count != 1U ||
      rights_count != 1U || received_descriptor < 0 || transfer == nullptr ||
      transfer->binding != binding || transfer->hop != 1U ||
      transfer->carrier_kind != local_whisper::common::AuthorityCarrierKind::linux_rights ||
      transfer->carrier_value != 0U ||
      credentials->pid != static_cast<pid_t>(binding.expected_guard_pid) ||
      credentials->uid != geteuid() || credentials->gid != getegid() ||
      local_whisper::common::linux_process_start_identity_sha256(credentials->pid) !=
          binding.expected_guard_start_identity_sha256) {
    throw std::runtime_error("model authority transfer binding failed");
  }
  UniqueModelDescriptor authority = std::move(received_descriptors.front());
  struct stat metadata {};
  const int status_flags = fcntl(authority.get(), F_GETFL);
  if (fstat(authority.get(), &metadata) != 0 || status_flags < 0 ||
      (status_flags & O_ACCMODE) != O_RDONLY ||
      (binding.artifact_kind == local_whisper::common::AuthorityArtifactKind::regular_file &&
       !S_ISREG(metadata.st_mode)) ||
      (binding.artifact_kind == local_whisper::common::AuthorityArtifactKind::directory &&
       !S_ISDIR(metadata.st_mode))) {
    throw std::runtime_error("invalid transferred model authority descriptor");
  }
  return authority;
}

} // namespace

UniqueModelDescriptor::UniqueModelDescriptor(int value) noexcept : value_(value) {}
UniqueModelDescriptor::~UniqueModelDescriptor() noexcept { reset(); }
UniqueModelDescriptor::UniqueModelDescriptor(UniqueModelDescriptor&& other) noexcept
    : value_(other.release()) {}
UniqueModelDescriptor& UniqueModelDescriptor::operator=(UniqueModelDescriptor&& other) noexcept {
  if (this != &other)
    reset(other.release());
  return *this;
}
int UniqueModelDescriptor::get() const noexcept { return value_; }
int UniqueModelDescriptor::release() noexcept { return std::exchange(value_, -1); }
void UniqueModelDescriptor::reset(int value) noexcept {
  if (value_ >= 0)
    static_cast<void>(close(value_));
  value_ = value;
}

UniqueModelDescriptor
LinuxModelAuthorityClient::acquire(int channel_descriptor,
                                   const local_whisper::common::AuthorityBinding& binding) const {
  enable_credentials(channel_descriptor);
  send_request(channel_descriptor, binding);
  return receive_transfer(channel_descriptor, binding);
}

int LinuxModelAuthorityClient::install_at_logical_slot(UniqueModelDescriptor descriptor) {
  constexpr int logical_slot = 3;
  if (descriptor.get() < 0)
    throw std::runtime_error("missing model authority descriptor");
  if (descriptor.get() == logical_slot) {
    const int flags = fcntl(logical_slot, F_GETFD);
    if (flags < 0 || fcntl(logical_slot, F_SETFD, flags & ~FD_CLOEXEC) != 0)
      throw std::runtime_error("model authority slot setup failed");
    return descriptor.release();
  }
  if (dup3(descriptor.get(), logical_slot, 0) != logical_slot)
    throw std::runtime_error("model authority slot duplication failed");
  return logical_slot;
}

} // namespace local_whisper::launcher
