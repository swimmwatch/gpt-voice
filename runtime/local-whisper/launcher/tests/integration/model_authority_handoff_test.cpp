#include "local_whisper/common/authority_bootstrap.hpp"
#include "local_whisper/common/linux_process_identity.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/fs_guard/model_authority_server.hpp"
#include "local_whisper/launcher/model_authority_client.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <csignal>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

namespace local_whisper::launcher {
namespace {

using local_whisper::common::AuthorityArtifactKind;
using local_whisper::common::AuthorityBinding;

class TemporaryAuthorityRoot final {
public:
  explicit TemporaryAuthorityRoot(AuthorityArtifactKind kind) : kind_(kind) {
    std::array<char, 64> pattern{};
    const std::string prefix = "/tmp/gpt-voice-local-whisper-authority-XXXXXX";
    std::copy(prefix.begin(), prefix.end(), pattern.begin());
    char* created = mkdtemp(pattern.data());
    if (created == nullptr)
      throw std::runtime_error("authority fixture root failed");
    root_ = created;
    artifact_ = root_ / "model";
    if (kind_ == AuthorityArtifactKind::directory) {
      if (mkdir(artifact_.c_str(), 0700) != 0)
        throw std::runtime_error("authority fixture directory failed");
    } else {
      std::ofstream output(artifact_, std::ios::binary | std::ios::trunc);
      output << "model-fixture";
      output.close();
      if (!output)
        throw std::runtime_error("authority fixture file failed");
      if (chmod(artifact_.c_str(), 0400) != 0)
        throw std::runtime_error("authority fixture mode failed");
    }
  }

  ~TemporaryAuthorityRoot() noexcept {
    std::error_code ignored;
    std::filesystem::remove(artifact_, ignored);
    std::filesystem::remove(root_, ignored);
  }

  TemporaryAuthorityRoot(const TemporaryAuthorityRoot&) = delete;
  TemporaryAuthorityRoot& operator=(const TemporaryAuthorityRoot&) = delete;

  [[nodiscard]] const std::filesystem::path& artifact() const noexcept { return artifact_; }

private:
  AuthorityArtifactKind kind_;
  std::filesystem::path root_;
  std::filesystem::path artifact_;
};

AuthorityBinding make_binding(pid_t launcher_pid, pid_t guard_pid, AuthorityArtifactKind kind) {
  AuthorityBinding binding{};
  binding.operation_nonce.fill(1);
  binding.app_ownership_nonce.fill(2);
  binding.configuration_epoch = 7;
  binding.lease_token_sha256.fill(3);
  binding.model_identity_sha256.fill(4);
  binding.expected_artifact_bytes = kind == AuthorityArtifactKind::regular_file ? 13U : 1U;
  if (kind == AuthorityArtifactKind::regular_file) {
    constexpr std::string_view contents = "model-fixture";
    binding.artifact_content_sha256 = local_whisper::common::sha256(std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(contents.data()), contents.size()));
  } else {
    binding.artifact_content_sha256.fill(5);
  }
  binding.artifact_kind = kind;
  binding.expected_launcher_pid = static_cast<std::uint64_t>(launcher_pid);
  binding.expected_guard_pid = static_cast<std::uint64_t>(guard_pid);
  binding.expected_launcher_start_identity_sha256 =
      local_whisper::common::linux_process_start_identity_sha256(launcher_pid);
  binding.expected_guard_start_identity_sha256 =
      local_whisper::common::linux_process_start_identity_sha256(guard_pid);
  return binding;
}

int open_artifact(const std::filesystem::path& path, AuthorityArtifactKind kind) {
  const int flags =
      O_RDONLY | O_CLOEXEC | (kind == AuthorityArtifactKind::directory ? O_DIRECTORY : 0);
  const int descriptor = open(path.c_str(), flags);
  if (descriptor < 0)
    throw std::runtime_error("authority fixture open failed");
  return descriptor;
}

void wait_success(pid_t child) {
  int status = 0;
  while (waitpid(child, &status, 0) < 0) {
    if (errno != EINTR)
      throw std::runtime_error("authority child wait failed");
  }
  if (!WIFEXITED(status) || WEXITSTATUS(status) != 0)
    throw std::runtime_error("authority child failed");
}

enum class TransferShape { kValid, kNoDescriptor, kMultipleDescriptors, kTruncated, kWrongBinding };

std::size_t open_descriptor_count() {
  std::size_t count = 0;
  for (const auto& entry : std::filesystem::directory_iterator("/proc/self/fd"))
    static_cast<void>(entry), ++count;
  return count;
}

void receive_authority_request(const int channel_descriptor) {
  std::array<std::uint8_t, local_whisper::common::kAuthorityRequestBytes> request{};
  if (recv(channel_descriptor, request.data(), request.size(), 0) !=
      static_cast<ssize_t>(request.size())) {
    throw std::runtime_error("authority fixture request receive failed");
  }
}

void send_transfer(const int channel_descriptor, const AuthorityBinding& expected_binding,
                   const std::vector<int>& descriptors, const bool wrong_binding) {
  AuthorityBinding transfer_binding = expected_binding;
  if (wrong_binding)
    ++transfer_binding.configuration_epoch;
  const auto transfer =
      local_whisper::common::encode_authority_record(local_whisper::common::AuthorityTransfer{
          transfer_binding, 1, local_whisper::common::AuthorityCarrierKind::linux_rights, 0});
  std::vector<std::byte> control(
      CMSG_SPACE(sizeof(struct ucred)) +
      (descriptors.empty() ? 0U : CMSG_SPACE(sizeof(int) * descriptors.size())));
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
    throw std::runtime_error("authority fixture credentials unavailable");
  credentials_header->cmsg_level = SOL_SOCKET;
  credentials_header->cmsg_type = SCM_CREDENTIALS;
  credentials_header->cmsg_len = CMSG_LEN(sizeof(struct ucred));
  const struct ucred credentials = {getpid(), geteuid(), getegid()};
  std::memcpy(CMSG_DATA(credentials_header), &credentials, sizeof(credentials));
  if (!descriptors.empty()) {
    struct cmsghdr* rights_header = CMSG_NXTHDR(&message, credentials_header);
    if (rights_header == nullptr)
      throw std::runtime_error("authority fixture rights unavailable");
    rights_header->cmsg_level = SOL_SOCKET;
    rights_header->cmsg_type = SCM_RIGHTS;
    rights_header->cmsg_len = CMSG_LEN(sizeof(int) * descriptors.size());
    std::memcpy(CMSG_DATA(rights_header), descriptors.data(), sizeof(int) * descriptors.size());
  }
  if (sendmsg(channel_descriptor, &message, MSG_NOSIGNAL) != static_cast<ssize_t>(transfer.size()))
    throw std::runtime_error("authority fixture transfer send failed");
}

[[noreturn]] void run_hostile_sender(const int channel_descriptor,
                                     const std::filesystem::path& artifact,
                                     const AuthorityBinding& binding, const TransferShape shape) {
  try {
    receive_authority_request(channel_descriptor);
    const std::size_t descriptor_count = shape == TransferShape::kNoDescriptor          ? 0U
                                         : shape == TransferShape::kMultipleDescriptors ? 3U
                                         : shape == TransferShape::kTruncated           ? 192U
                                                                                        : 1U;
    std::vector<int> descriptors;
    descriptors.reserve(descriptor_count);
    for (std::size_t index = 0; index < descriptor_count; ++index) {
      const int descriptor = open_artifact(artifact, AuthorityArtifactKind::regular_file);
      descriptors.push_back(descriptor);
    }
    send_transfer(channel_descriptor, binding, descriptors, shape == TransferShape::kWrongBinding);
    for (const int descriptor : descriptors)
      static_cast<void>(close(descriptor));
    _exit(0);
  } catch (...) {
    _exit(10);
  }
}

void expect_hostile_transfer(const std::filesystem::path& artifact, const TransferShape shape,
                             const bool expect_success) {
  const std::size_t baseline = open_descriptor_count();
  std::array<int, 2> channel{};
  ASSERT_EQ(socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, channel.data()), 0);
  const pid_t sender = fork();
  if (sender < 0)
    throw std::runtime_error("authority hostile sender fork failed");
  if (sender == 0) {
    static_cast<void>(close(channel[0]));
    const AuthorityBinding binding =
        make_binding(getppid(), getpid(), AuthorityArtifactKind::regular_file);
    run_hostile_sender(channel[1], artifact, binding, shape);
  }
  static_cast<void>(close(channel[1]));
  const AuthorityBinding binding =
      make_binding(getpid(), sender, AuthorityArtifactKind::regular_file);
  LinuxModelAuthorityClient client;
  bool accepted = false;
  try {
    UniqueModelDescriptor authority = client.acquire(channel[0], binding);
    accepted = authority.get() >= 0;
  } catch (...) {
    accepted = false;
  }
  static_cast<void>(close(channel[0]));
  ASSERT_NO_THROW(wait_success(sender));
  EXPECT_EQ(accepted, expect_success);
  EXPECT_EQ(open_descriptor_count(), baseline);
}

[[noreturn]] void run_guard(int channel_descriptor, int model_descriptor,
                            AuthorityArtifactKind kind, bool replay) {
  try {
    local_whisper::fs_guard::LinuxModelAuthorityServer server(
        make_binding(getppid(), getpid(), kind), model_descriptor);
    server.transfer_once(channel_descriptor);
    if (replay) {
      try {
        server.transfer_once(channel_descriptor);
      } catch (...) {
        _exit(0);
      }
      _exit(20);
    }
    _exit(0);
  } catch (...) {
    _exit(10);
  }
}

void run_worker_bootstrap(const AuthorityBinding& binding) {
  std::array<int, 2> input_pipe{};
  std::array<int, 2> output_pipe{};
  if (pipe2(input_pipe.data(), O_CLOEXEC) != 0 || pipe2(output_pipe.data(), O_CLOEXEC) != 0)
    throw std::runtime_error("authority worker pipe failed");
  const pid_t worker = fork();
  if (worker < 0)
    throw std::runtime_error("authority worker fork failed");
  if (worker == 0) {
    if (dup2(input_pipe[0], STDIN_FILENO) != STDIN_FILENO ||
        dup2(output_pipe[1], STDOUT_FILENO) != STDOUT_FILENO) {
      _exit(126);
    }
    static_cast<void>(close(input_pipe[0]));
    static_cast<void>(close(input_pipe[1]));
    static_cast<void>(close(output_pipe[0]));
    static_cast<void>(close(output_pipe[1]));
    execl(LOCAL_WHISPER_AUTHORITY_WORKER_FIXTURE, "local-whisper-authority-worker",
          "--authority-worker-fixture", nullptr);
    _exit(126);
  }
  static_cast<void>(close(input_pipe[0]));
  static_cast<void>(close(output_pipe[1]));
  try {
    local_whisper::common::authorize_worker_model_bootstrap(
        input_pipe[1], output_pipe[0], binding, static_cast<std::uint64_t>(worker),
        local_whisper::common::linux_process_start_identity_sha256(worker));
    static_cast<void>(close(input_pipe[1]));
    static_cast<void>(close(output_pipe[0]));
    wait_success(worker);
  } catch (...) {
    static_cast<void>(close(input_pipe[1]));
    static_cast<void>(close(output_pipe[0]));
    static_cast<void>(kill(worker, SIGKILL));
    try {
      wait_success(worker);
    } catch (...) {
    }
    throw;
  }
}

int isolated_scenario(const std::filesystem::path& artifact, AuthorityArtifactKind kind,
                      bool replay) {
  try {
    static_cast<void>(close(3));
    const int collision = open("/dev/null", O_RDONLY | O_CLOEXEC);
    if (collision < 0)
      throw std::runtime_error("authority collision fixture failed");
    if (collision != 3) {
      if (dup2(collision, 3) != 3)
        throw std::runtime_error("authority collision slot failed");
      static_cast<void>(close(collision));
    }
    std::array<int, 2> channel{};
    if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, channel.data()) != 0)
      throw std::runtime_error("authority socketpair failed");
    const int model_descriptor = open_artifact(artifact, kind);
    const pid_t guard = fork();
    if (guard < 0)
      throw std::runtime_error("authority guard fork failed");
    if (guard == 0) {
      static_cast<void>(close(channel[0]));
      run_guard(channel[1], model_descriptor, kind, replay);
    }
    static_cast<void>(close(channel[1]));
    static_cast<void>(close(model_descriptor));
    const AuthorityBinding binding = make_binding(getpid(), guard, kind);
    LinuxModelAuthorityClient client;
    UniqueModelDescriptor authority = client.acquire(channel[0], binding);
    if (replay) {
      authority.reset();
      bool rejected = false;
      try {
        static_cast<void>(client.acquire(channel[0], binding));
      } catch (...) {
        rejected = true;
      }
      static_cast<void>(close(channel[0]));
      wait_success(guard);
      return rejected ? 0 : 30;
    }
    static_cast<void>(close(channel[0]));
    wait_success(guard);
    if (LinuxModelAuthorityClient::install_at_logical_slot(std::move(authority)) != 3)
      throw std::runtime_error("authority slot install failed");
    run_worker_bootstrap(binding);
    static_cast<void>(close(3));
    return 0;
  } catch (...) {
    return 10;
  }
}

void expect_isolated_success(const std::filesystem::path& artifact, AuthorityArtifactKind kind,
                             bool replay = false) {
  const pid_t child = fork();
  if (child == 0)
    _exit(isolated_scenario(artifact, kind, replay));
  ASSERT_GT(child, 0);
  ASSERT_NO_THROW(wait_success(child));
}

TEST(ModelAuthorityHandoff, TransfersRegularFileAndBootstrapsWorkerWithFdThreeCollision) {
  TemporaryAuthorityRoot root(AuthorityArtifactKind::regular_file);
  expect_isolated_success(root.artifact(), AuthorityArtifactKind::regular_file);
}

TEST(ModelAuthorityHandoff, TransfersDirectoryAndBootstrapsWorker) {
  TemporaryAuthorityRoot root(AuthorityArtifactKind::directory);
  expect_isolated_success(root.artifact(), AuthorityArtifactKind::directory);
}

TEST(ModelAuthorityHandoff, ConsumesOperationNonceAfterOneTransfer) {
  TemporaryAuthorityRoot root(AuthorityArtifactKind::regular_file);
  expect_isolated_success(root.artifact(), AuthorityArtifactKind::regular_file, true);
}

TEST(ModelAuthorityHandoff, RejectsHostileAncillaryDescriptorShapesWithoutLeaks) {
  TemporaryAuthorityRoot root(AuthorityArtifactKind::regular_file);
  expect_hostile_transfer(root.artifact(), TransferShape::kValid, true);
  expect_hostile_transfer(root.artifact(), TransferShape::kNoDescriptor, false);
  expect_hostile_transfer(root.artifact(), TransferShape::kMultipleDescriptors, false);
  expect_hostile_transfer(root.artifact(), TransferShape::kTruncated, false);
  expect_hostile_transfer(root.artifact(), TransferShape::kWrongBinding, false);
}

} // namespace
} // namespace local_whisper::launcher
