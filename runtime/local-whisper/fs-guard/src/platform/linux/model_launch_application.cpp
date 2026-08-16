#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "platform/linux/model_launch_application.hpp"

#include "local_whisper/common/linux_process_identity.hpp"
#include "local_whisper/common/model_authority.hpp"
#include "local_whisper/common/process_exit_codes.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/fs_guard/model_authority_server.hpp"
#include "local_whisper/fs_guard/model_launch_error.hpp"
#include "local_whisper/fs_guard/model_launch_request.hpp"
#include "local_whisper/fs_guard/protocol.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <charconv>
#include <chrono>
#include <csignal>
#include <cstdint>
#include <filesystem>
#include <limits>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>

#include <fcntl.h>
#include <linux/openat2.h>
#include <poll.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

namespace local_whisper::fs_guard {
namespace {

constexpr int kLauncherAuthorityDescriptor = 5;
constexpr int kLauncherExecutableDescriptor = 6;
constexpr int kLauncherAcknowledgmentDescriptor = 4;
constexpr auto kPollInterval = std::chrono::milliseconds(50);
constexpr auto kTerminationBudget = std::chrono::seconds(5);

volatile std::sig_atomic_t termination_requested = 0;

void handle_termination(int) { termination_requested = 1; }

class UniqueFd final {
public:
  explicit UniqueFd(const int value = -1) noexcept : value_(value) {}
  ~UniqueFd() noexcept { reset(); }
  UniqueFd(const UniqueFd&) = delete;
  UniqueFd& operator=(const UniqueFd&) = delete;
  UniqueFd(UniqueFd&& other) noexcept : value_(other.release()) {}
  UniqueFd& operator=(UniqueFd&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }
  [[nodiscard]] int get() const noexcept { return value_; }
  [[nodiscard]] int release() noexcept {
    const int value = value_;
    value_ = -1;
    return value;
  }
  void reset(const int value = -1) noexcept {
    if (value_ >= 0)
      static_cast<void>(close(value_));
    value_ = value;
  }

private:
  int value_;
};

struct HeldFile final {
  UniqueFd parent;
  UniqueFd file;
  struct stat parent_stat {};
  struct stat file_stat {};
};

void install_signal_handlers() {
  struct sigaction action {};
  action.sa_handler = handle_termination;
  sigemptyset(&action.sa_mask);
  if (sigaction(SIGTERM, &action, nullptr) != 0 || sigaction(SIGINT, &action, nullptr) != 0 ||
      sigaction(SIGHUP, &action, nullptr) != 0) {
    throw ModelLaunchError(ModelLaunchErrorCode::kBootstrapRejected,
                           "model launch signal setup failed");
  }
}

HeldFile open_held_regular_file(const std::filesystem::path& path) {
  if (!path.is_absolute() || path.filename().empty() || path.parent_path() == path.root_path())
    throw ModelLaunchError(ModelLaunchErrorCode::kPathInvalid, "model launch path invalid");
  struct open_how how {};
  how.flags = O_RDONLY | O_DIRECTORY | O_CLOEXEC;
  how.resolve = RESOLVE_NO_MAGICLINKS | RESOLVE_NO_SYMLINKS;
  UniqueFd parent(static_cast<int>(
      syscall(SYS_openat2, AT_FDCWD, path.parent_path().c_str(), &how, sizeof(how))));
  if (parent.get() < 0)
    throw ModelLaunchError(ModelLaunchErrorCode::kDirectoryOpenFailed,
                           "model launch directory open failed");
  UniqueFd file(openat(parent.get(), path.filename().c_str(), O_RDONLY | O_NOFOLLOW | O_CLOEXEC));
  if (file.get() < 0)
    throw ModelLaunchError(ModelLaunchErrorCode::kFileOpenFailed, "model launch file open failed");
  HeldFile result{std::move(parent), std::move(file), {}, {}};
  if (fstat(result.parent.get(), &result.parent_stat) != 0 ||
      fstat(result.file.get(), &result.file_stat) != 0 || !S_ISDIR(result.parent_stat.st_mode) ||
      !S_ISREG(result.file_stat.st_mode) || result.file_stat.st_nlink != 1) {
    throw ModelLaunchError(ModelLaunchErrorCode::kIdentityRejected,
                           "model launch file identity invalid");
  }
  const int flags = fcntl(result.file.get(), F_GETFL);
  if (flags < 0 || (flags & O_ACCMODE) != O_RDONLY)
    throw ModelLaunchError(ModelLaunchErrorCode::kBootstrapRejected,
                           "model launch file authority writable");
  return result;
}

std::string unsigned_string(const std::uint64_t value) { return std::to_string(value); }

void validate_model_identity(const HeldFile& held, const ModelLaunchRequest& request) {
  const auto& identity = request.model_identity;
  if (unsigned_string(static_cast<std::uint64_t>(held.file_stat.st_dev)) != identity.device_id ||
      unsigned_string(static_cast<std::uint64_t>(held.file_stat.st_ino)) != identity.file_id ||
      static_cast<std::uint64_t>(held.file_stat.st_nlink) != identity.link_count ||
      static_cast<std::uint32_t>(held.file_stat.st_mode & 0777U) != identity.mode ||
      unsigned_string(static_cast<std::uint64_t>(held.parent_stat.st_ino)) !=
          identity.parent_file_id ||
      static_cast<std::uint64_t>(held.file_stat.st_size) != request.model_size_bytes) {
    throw ModelLaunchError(ModelLaunchErrorCode::kIdentityRejected,
                           "model launch identity changed");
  }
}

std::string hash_descriptor(const int descriptor, const std::uint64_t expected_bytes) {
  local_whisper::common::Sha256 digest;
  std::array<std::uint8_t, 64U * 1024U> buffer{};
  std::uint64_t offset = 0;
  while (offset < expected_bytes) {
    const std::size_t requested =
        static_cast<std::size_t>(std::min<std::uint64_t>(expected_bytes - offset, buffer.size()));
    const ssize_t count = pread(descriptor, buffer.data(), requested, static_cast<off_t>(offset));
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                             "model launch hash read failed");
    digest.update(std::span<const std::uint8_t>(buffer.data(), static_cast<std::size_t>(count)));
    offset += static_cast<std::uint64_t>(count);
  }
  return local_whisper::common::to_lower_hex(digest.finish());
}

template <std::size_t Size> std::array<std::uint8_t, Size> parse_hex(const std::string& value) {
  if (value.size() != Size * 2U)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected, "model launch digest invalid");
  std::array<std::uint8_t, Size> output{};
  for (std::size_t index = 0; index < Size; ++index) {
    unsigned int byte = 0;
    const char* begin = value.data() + index * 2U;
    const auto parsed = std::from_chars(begin, begin + 2, byte, 16);
    if (parsed.ec != std::errc{} || parsed.ptr != begin + 2 || byte > 0xffU)
      throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected, "model launch digest invalid");
    output[index] = static_cast<std::uint8_t>(byte);
  }
  return output;
}

void set_socket_timeout(const int descriptor) {
  struct timeval timeout {
    10, 0
  };
  if (setsockopt(descriptor, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout)) != 0 ||
      setsockopt(descriptor, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout)) != 0) {
    throw ModelLaunchError(ModelLaunchErrorCode::kModelAuthorityRejected,
                           "model launch authority timeout failed");
  }
}

void map_descriptor(const int source, const int target) {
  if (source == target) {
    const int flags = fcntl(target, F_GETFD);
    if (flags < 0 || fcntl(target, F_SETFD, flags & ~FD_CLOEXEC) != 0)
      _exit(common::kChildExecBootstrapFailureExitCode);
    return;
  }
  if (dup3(source, target, 0) != target)
    _exit(common::kChildExecBootstrapFailureExitCode);
}

void write_all(const int descriptor, const std::string& value) {
  std::size_t offset = 0;
  while (offset < value.size()) {
    const ssize_t count = write(descriptor, value.data() + offset, value.size() - offset);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw ModelLaunchError(ModelLaunchErrorCode::kPipeIoFailed,
                             "model launch bootstrap write failed");
    offset += static_cast<std::size_t>(count);
  }
}

local_whisper::common::AuthorityBinding binding_for(const ModelLaunchRequest& request,
                                                    const pid_t launcher_pid) {
  try {
    const auto app_digest = local_whisper::common::sha256(std::span<const std::uint8_t>(
        reinterpret_cast<const std::uint8_t*>(request.app_instance_nonce.data()),
        request.app_instance_nonce.size()));
    local_whisper::common::AuthorityBinding binding{};
    binding.operation_nonce = request.operation_nonce;
    std::copy_n(app_digest.begin(), binding.app_ownership_nonce.size(),
                binding.app_ownership_nonce.begin());
    binding.configuration_epoch = request.configuration_epoch;
    binding.lease_token_sha256 = parse_hex<32>(request.lease_token_sha256);
    binding.model_identity_sha256 = parse_hex<32>(request.model_identity_sha256);
    binding.expected_artifact_bytes = request.model_size_bytes;
    binding.artifact_content_sha256 = parse_hex<32>(request.model_sha256);
    binding.artifact_kind = local_whisper::common::AuthorityArtifactKind::regular_file;
    binding.expected_launcher_pid = static_cast<std::uint64_t>(launcher_pid);
    binding.expected_guard_pid = static_cast<std::uint64_t>(getpid());
    binding.expected_launcher_start_identity_sha256 =
        local_whisper::common::linux_process_start_identity_sha256(launcher_pid);
    binding.expected_guard_start_identity_sha256 =
        local_whisper::common::linux_process_start_identity_sha256(getpid());
    return binding;
  } catch (const ModelLaunchError&) {
    throw;
  } catch (...) {
    throw ModelLaunchError(ModelLaunchErrorCode::kModelAuthorityRejected,
                           "model launch authority binding failed");
  }
}

int wait_for_launcher(const pid_t launcher_pid, const int owner_control,
                      UniqueFd& launcher_control) {
  UniqueFd control(owner_control);
  bool termination_started = false;
  bool hard_kill_sent = false;
  auto hard_kill_deadline = std::chrono::steady_clock::time_point::max();
  while (true) {
    int status = 0;
    const pid_t result = waitpid(launcher_pid, &status, WNOHANG);
    if (result == launcher_pid) {
      if (WIFEXITED(status))
        return WEXITSTATUS(status);
      return WIFSIGNALED(status) ? common::kChildSignalExitCodeBase + WTERMSIG(status)
                                 : common::kChildStatusUnavailableExitCode;
    }
    if (result < 0 && errno != EINTR)
      throw ModelLaunchError(ModelLaunchErrorCode::kBootstrapRejected, "model launch wait failed");
    struct pollfd descriptor {
      control.get(), static_cast<short>(POLLIN | POLLHUP | POLLERR), 0
    };
    const int polled = poll(&descriptor, 1, static_cast<int>(kPollInterval.count()));
    if (polled < 0 && errno != EINTR)
      termination_requested = 1;
    if (!termination_started &&
        (termination_requested != 0 ||
         (polled > 0 && (descriptor.revents & (POLLIN | POLLHUP | POLLERR)) != 0))) {
      control.reset();
      termination_started = true;
      hard_kill_deadline = std::chrono::steady_clock::now() + kTerminationBudget;
      launcher_control.reset();
      static_cast<void>(kill(launcher_pid, SIGTERM));
    }
    if (termination_started && !hard_kill_sent &&
        std::chrono::steady_clock::now() >= hard_kill_deadline) {
      hard_kill_sent = true;
      static_cast<void>(kill(launcher_pid, SIGKILL));
    }
  }
}

void kill_and_reap_launcher(const pid_t launcher_pid) noexcept {
  static_cast<void>(kill(launcher_pid, SIGKILL));
  while (true) {
    const pid_t result = waitpid(launcher_pid, nullptr, 0);
    if (result == launcher_pid || (result < 0 && errno != EINTR))
      return;
  }
}

} // namespace

int run_linux_model_launch(const int control_descriptor, const int acknowledgment_descriptor) {
  termination_requested = 0;
  const pid_t expected_parent = getppid();
  if (expected_parent <= 1 || prctl(PR_SET_PDEATHSIG, SIGTERM) != 0 ||
      getppid() != expected_parent) {
    throw ModelLaunchError(ModelLaunchErrorCode::kJobOwnershipFailed,
                           "model launch parent ownership failed");
  }
  install_signal_handlers();
  const ModelLaunchRequest request =
      ModelLaunchRequestParser{}.parse(read_model_launch_bootstrap(control_descriptor));
  HeldFile launcher = open_held_regular_file(request.launcher_path);
  if ((launcher.file_stat.st_mode & 0022U) != 0U ||
      hash_descriptor(launcher.file.get(),
                      static_cast<std::uint64_t>(launcher.file_stat.st_size)) !=
          request.launcher_sha256) {
    throw ModelLaunchError(ModelLaunchErrorCode::kIdentityRejected,
                           "model launch launcher identity changed");
  }
  HeldFile model = open_held_regular_file(request.model_path);
  validate_model_identity(model, request);
  if (hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch model digest changed");

  std::array<int, 2> launcher_control_pair{};
  if (pipe2(launcher_control_pair.data(), O_CLOEXEC) != 0)
    throw ModelLaunchError(ModelLaunchErrorCode::kPipeIoFailed,
                           "model launch channel creation failed");
  UniqueFd launcher_control_read(launcher_control_pair[0]);
  UniqueFd launcher_control_write(launcher_control_pair[1]);
  std::array<int, 2> authority_pair{};
  if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, authority_pair.data()) != 0)
    throw ModelLaunchError(ModelLaunchErrorCode::kPipeIoFailed,
                           "model launch channel creation failed");
  UniqueFd guard_authority(authority_pair[0]);
  UniqueFd launcher_authority(authority_pair[1]);
  set_socket_timeout(guard_authority.get());

  const pid_t launcher_pid = fork();
  if (launcher_pid < 0)
    throw ModelLaunchError(ModelLaunchErrorCode::kLauncherCreationFailed,
                           "model launch fork failed");
  if (launcher_pid == 0) {
    map_descriptor(launcher_control_read.get(), 3);
    map_descriptor(acknowledgment_descriptor, kLauncherAcknowledgmentDescriptor);
    map_descriptor(launcher_authority.get(), kLauncherAuthorityDescriptor);
    if (launcher.file.get() != kLauncherExecutableDescriptor) {
      if (dup3(launcher.file.get(), kLauncherExecutableDescriptor, O_CLOEXEC) !=
          kLauncherExecutableDescriptor) {
        _exit(common::kChildExecBootstrapFailureExitCode);
      }
    }
    if (syscall(SYS_close_range, 7U, std::numeric_limits<unsigned int>::max(), 0U) != 0)
      _exit(common::kChildExecBootstrapFailureExitCode);
    std::array<char*, 3> arguments = {const_cast<char*>("local-whisper-launcher"),
                                      const_cast<char*>("--local-whisper-launcher-v2"), nullptr};
    std::array<char*, 3> environment = {const_cast<char*>("LANG=C"), const_cast<char*>("LC_ALL=C"),
                                        nullptr};
    fexecve(kLauncherExecutableDescriptor, arguments.data(), environment.data());
    constexpr std::string_view failure = "FAILED\tMODEL_LAUNCHER_RESUME_FAILED\n";
    static_cast<void>(write(kLauncherAcknowledgmentDescriptor, failure.data(), failure.size()));
    _exit(common::kChildExecBootstrapFailureExitCode);
  }

  launcher_control_read.reset();
  launcher_authority.reset();
  static_cast<void>(close(acknowledgment_descriptor));
  try {
    const auto binding = binding_for(request, launcher_pid);
    try {
      const auto authority_request = local_whisper::common::encode_authority_record(
          local_whisper::common::AuthorityRequest{binding});
      const std::string launcher_bootstrap =
          request.launcher_bootstrap + '\t' +
          base64url_encode(std::string(reinterpret_cast<const char*>(authority_request.data()),
                                       authority_request.size())) +
          '\t' + std::to_string(request.worker_bootstrap_bytes) + '\n';
      write_all(launcher_control_write.get(), launcher_bootstrap);
      LinuxModelAuthorityServer(binding, model.file.get()).transfer_once(guard_authority.get());
    } catch (const ModelLaunchError&) {
      throw;
    } catch (...) {
      throw ModelLaunchError(ModelLaunchErrorCode::kModelAuthorityRejected,
                             "model launch authority transfer failed");
    }
    guard_authority.reset();
    return wait_for_launcher(launcher_pid, control_descriptor, launcher_control_write);
  } catch (...) {
    launcher_control_write.reset();
    kill_and_reap_launcher(launcher_pid);
    throw;
  }
}

} // namespace local_whisper::fs_guard
