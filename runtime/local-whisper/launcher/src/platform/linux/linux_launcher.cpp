#include "local_whisper/launcher/platform_launcher.hpp"

#include "local_whisper/common/authority_bootstrap.hpp"
#include "local_whisper/common/linux_process_identity.hpp"
#include "local_whisper/common/model_authority.hpp"
#include "local_whisper/launcher/model_authority_client.hpp"
#include "local_whisper/launcher/sha256.hpp"

#include <array>
#include <cerrno>
#include <charconv>
#include <chrono>
#include <csignal>
#include <cstdint>
#include <filesystem>
#include <memory>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <thread>
#include <variant>
#include <vector>

#include <fcntl.h>
#include <linux/openat2.h>
#include <poll.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

extern char** environ;

namespace local_whisper::launcher {
namespace {

constexpr auto kPollInterval = std::chrono::milliseconds(50);
constexpr auto kGracefulTerminationBudget = std::chrono::seconds(5);

volatile std::sig_atomic_t termination_requested = 0;

void handle_termination(int) { termination_requested = 1; }

class UniqueDescriptor final {
public:
  explicit UniqueDescriptor(int value = -1) noexcept : value_(value) {}
  ~UniqueDescriptor() noexcept { reset(); }

  UniqueDescriptor(const UniqueDescriptor&) = delete;
  UniqueDescriptor& operator=(const UniqueDescriptor&) = delete;

  UniqueDescriptor(UniqueDescriptor&& other) noexcept : value_(other.release()) {}
  UniqueDescriptor& operator=(UniqueDescriptor&& other) noexcept {
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
  void reset(int value = -1) noexcept {
    if (value_ >= 0)
      static_cast<void>(close(value_));
    value_ = value;
  }

private:
  int value_;
};

std::uint64_t parse_number(const std::string& value) {
  std::uint64_t result = 0;
  const auto parsed = std::from_chars(value.data(), value.data() + value.size(), result);
  if (parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size())
    throw std::runtime_error("invalid identity number");
  return result;
}

std::string unsigned_string(std::uint64_t value) { return std::to_string(value); }

void validate_identity(const struct stat& value, const struct stat& parent,
                       const IdentityExpectation& expected) {
  const bool directory = S_ISDIR(value.st_mode);
  const bool regular = S_ISREG(value.st_mode);
  if ((!directory && !regular) || directory != expected.directory ||
      static_cast<std::uint64_t>(value.st_dev) != parse_number(expected.device_or_volume_id) ||
      unsigned_string(static_cast<std::uint64_t>(value.st_ino)) != expected.file_id ||
      static_cast<std::uint64_t>(value.st_nlink) != expected.link_count ||
      static_cast<std::uint32_t>(value.st_mode & 0777U) != expected.mode ||
      unsigned_string(static_cast<std::uint64_t>(parent.st_ino)) != expected.parent_file_id ||
      static_cast<std::uint64_t>(value.st_size) != expected.size_bytes) {
    throw std::runtime_error("launcher identity changed");
  }
}

UniqueDescriptor open_hardened_directory(const std::filesystem::path& path) {
  struct open_how how {};
  how.flags = O_RDONLY | O_DIRECTORY | O_CLOEXEC;
  how.resolve = RESOLVE_NO_MAGICLINKS | RESOLVE_NO_SYMLINKS;
  const int descriptor = static_cast<int>(
      syscall(SYS_openat2, AT_FDCWD, path.c_str(), &how, static_cast<std::size_t>(sizeof(how))));
  if (descriptor < 0)
    throw std::runtime_error("launcher directory open failed");
  return UniqueDescriptor(descriptor);
}

std::string hash_descriptor(int descriptor) {
  if (lseek(descriptor, 0, SEEK_SET) < 0)
    throw std::runtime_error("launcher seek failed");
  Sha256 hash;
  std::array<unsigned char, 64 * 1024> buffer{};
  while (true) {
    const ssize_t count = read(descriptor, buffer.data(), buffer.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count < 0)
      throw std::runtime_error("launcher read failed");
    if (count == 0)
      break;
    hash.update(buffer.data(), static_cast<std::size_t>(count));
  }
  if (lseek(descriptor, 0, SEEK_SET) < 0)
    throw std::runtime_error("launcher seek failed");
  return hash.finish_hex();
}

void write_acknowledgment(int descriptor, pid_t worker_pid) {
  const std::string line = "READY\t" + std::to_string(worker_pid) + "\n";
  std::size_t offset = 0;
  while (offset < line.size()) {
    const ssize_t count = write(descriptor, line.data() + offset, line.size() - offset);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("launcher acknowledgment failed");
    offset += static_cast<std::size_t>(count);
  }
}

void install_signal_handlers() {
  struct sigaction action {};
  action.sa_handler = handle_termination;
  sigemptyset(&action.sa_mask);
  if (sigaction(SIGTERM, &action, nullptr) != 0 || sigaction(SIGINT, &action, nullptr) != 0 ||
      sigaction(SIGHUP, &action, nullptr) != 0) {
    throw std::runtime_error("launcher signal setup failed");
  }
  struct sigaction ignored {};
  ignored.sa_handler = SIG_IGN;
  sigemptyset(&ignored.sa_mask);
  if (sigaction(SIGPIPE, &ignored, nullptr) != 0)
    throw std::runtime_error("launcher pipe signal setup failed");
}

bool process_group_empty(pid_t process_group) {
  if (kill(-process_group, 0) == 0 || errno == EPERM)
    return false;
  if (errno == ESRCH)
    return true;
  throw std::runtime_error("launcher group query failed");
}

void reap_available_children(pid_t worker_pid, bool& root_exited, int& root_status) {
  int status = 0;
  while (true) {
    const pid_t reaped = waitpid(-1, &status, WNOHANG);
    if (reaped <= 0)
      return;
    if (reaped == worker_pid) {
      root_exited = true;
      root_status = status;
    }
  }
}

int root_exit_code(int status) {
  if (WIFEXITED(status))
    return WEXITSTATUS(status);
  if (WIFSIGNALED(status))
    return 128 + WTERMSIG(status);
  return 1;
}

void terminate_and_reap_owned_group(const pid_t worker_pid) noexcept {
  static_cast<void>(kill(-worker_pid, SIGKILL));
  while (true) {
    int status = 0;
    const pid_t reaped = waitpid(-1, &status, 0);
    if (reaped > 0)
      continue;
    if (reaped < 0 && errno == EINTR)
      continue;
    return;
  }
}

int wait_for_owned_group(pid_t worker_pid, int control_descriptor) {
  UniqueDescriptor control(control_descriptor);
  bool root_exited = false;
  int root_status = 0;
  bool termination_started = false;
  bool hard_kill_sent = false;
  auto hard_kill_deadline = std::chrono::steady_clock::time_point::max();

  while (true) {
    reap_available_children(worker_pid, root_exited, root_status);

    const bool group_empty = process_group_empty(worker_pid);
    if (group_empty && root_exited)
      return root_exit_code(root_status);

    struct pollfd control_poll {
      control.get(), static_cast<short>(POLLIN | POLLHUP | POLLERR), 0
    };
    const int poll_result = poll(&control_poll, 1, static_cast<int>(kPollInterval.count()));
    if (poll_result < 0 && errno != EINTR)
      termination_requested = 1;
    if (poll_result > 0 && (control_poll.revents & (POLLIN | POLLHUP | POLLERR)) != 0) {
      control.reset();
      termination_requested = 1;
    }

    if ((termination_requested != 0 || root_exited) && !termination_started) {
      termination_started = true;
      hard_kill_deadline = std::chrono::steady_clock::now() + kGracefulTerminationBudget;
      if (!group_empty)
        static_cast<void>(kill(-worker_pid, SIGTERM));
    }
    if (termination_started && !hard_kill_sent &&
        std::chrono::steady_clock::now() >= hard_kill_deadline) {
      hard_kill_sent = true;
      if (!group_empty)
        static_cast<void>(kill(-worker_pid, SIGKILL));
    }
  }
}

void write_exact(const int descriptor, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    const ssize_t count = write(descriptor, bytes.data(), bytes.size());
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("launcher proxy write failed");
    bytes = bytes.subspan(static_cast<std::size_t>(count));
  }
}

std::vector<std::uint8_t> read_exact(const int descriptor, const std::size_t size) {
  std::vector<std::uint8_t> bytes(size);
  std::size_t offset = 0;
  while (offset < size) {
    const ssize_t count = read(descriptor, bytes.data() + offset, size - offset);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("launcher bootstrap input failed");
    offset += static_cast<std::size_t>(count);
  }
  return bytes;
}

int proxy_owned_group(const pid_t worker_pid, const int control_descriptor,
                      UniqueDescriptor worker_input, UniqueDescriptor worker_output) {
  UniqueDescriptor control(control_descriptor);
  bool root_exited = false;
  int root_status = 0;
  bool termination_started = false;
  bool hard_kill_sent = false;
  auto hard_kill_deadline = std::chrono::steady_clock::time_point::max();
  std::array<std::uint8_t, 64U * 1024U> buffer{};
  while (true) {
    reap_available_children(worker_pid, root_exited, root_status);
    const bool group_empty = process_group_empty(worker_pid);
    if (group_empty && root_exited)
      return root_exit_code(root_status);

    std::array<struct pollfd, 3> descriptors = {
        pollfd{control.get(), static_cast<short>(POLLIN | POLLHUP | POLLERR), 0},
        pollfd{STDIN_FILENO, static_cast<short>(POLLIN | POLLHUP | POLLERR), 0},
        pollfd{worker_output.get(), static_cast<short>(POLLIN | POLLHUP | POLLERR), 0},
    };
    const int polled =
        poll(descriptors.data(), descriptors.size(), static_cast<int>(kPollInterval.count()));
    if (polled < 0 && errno != EINTR)
      termination_requested = 1;
    if (polled > 0) {
      if ((descriptors[0].revents & (POLLIN | POLLHUP | POLLERR)) != 0) {
        control.reset();
        termination_requested = 1;
      }
      if ((descriptors[1].revents & POLLIN) != 0 && worker_input.get() >= 0) {
        const ssize_t count = read(STDIN_FILENO, buffer.data(), buffer.size());
        if (count > 0) {
          try {
            write_exact(worker_input.get(), std::span<const std::uint8_t>(
                                                buffer.data(), static_cast<std::size_t>(count)));
          } catch (...) {
            termination_requested = 1;
          }
        } else if (count == 0 || errno != EINTR) {
          worker_input.reset();
          termination_requested = 1;
        }
      }
      if ((descriptors[1].revents & (POLLHUP | POLLERR)) != 0) {
        worker_input.reset();
        termination_requested = 1;
      }
      if ((descriptors[2].revents & POLLIN) != 0 && worker_output.get() >= 0) {
        const ssize_t count = read(worker_output.get(), buffer.data(), buffer.size());
        if (count > 0) {
          try {
            write_exact(STDOUT_FILENO, std::span<const std::uint8_t>(
                                           buffer.data(), static_cast<std::size_t>(count)));
          } catch (...) {
            termination_requested = 1;
          }
        } else if (count == 0 || errno != EINTR) {
          worker_output.reset();
        }
      }
      if ((descriptors[2].revents & (POLLHUP | POLLERR)) != 0)
        worker_output.reset();
    }

    if ((termination_requested != 0 || root_exited) && !termination_started) {
      termination_started = true;
      worker_input.reset();
      hard_kill_deadline = std::chrono::steady_clock::now() + kGracefulTerminationBudget;
      if (!group_empty)
        static_cast<void>(kill(-worker_pid, SIGTERM));
    }
    if (termination_started && !hard_kill_sent &&
        std::chrono::steady_clock::now() >= hard_kill_deadline) {
      hard_kill_sent = true;
      if (!group_empty)
        static_cast<void>(kill(-worker_pid, SIGKILL));
    }
  }
}

local_whisper::common::AuthorityBinding model_binding(const LaunchRequest& request) {
  const auto decoded =
      local_whisper::common::decode_authority_record(request.model_authority_request);
  const auto* authority = std::get_if<local_whisper::common::AuthorityRequest>(&decoded);
  if (authority == nullptr)
    throw std::runtime_error("launcher model authority request invalid");
  return authority->binding;
}

class LinuxLauncher final : public PlatformLauncher {
public:
  int run(const LaunchRequest& request, int control_descriptor, int acknowledgment_descriptor,
          int authority_descriptor) override {
    const std::filesystem::path worker_path(request.worker_path);
    const std::filesystem::path working_directory(request.working_directory);
    if (!worker_path.is_absolute() || !working_directory.is_absolute() ||
        worker_path.parent_path().lexically_normal() != working_directory.lexically_normal() ||
        worker_path.filename().empty()) {
      throw std::runtime_error("launcher path invalid");
    }

    UniqueDescriptor directory = open_hardened_directory(working_directory);
    UniqueDescriptor directory_parent(
        openat(directory.get(), "..", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC));
    UniqueDescriptor worker(
        openat(directory.get(), worker_path.filename().c_str(), O_RDONLY | O_NOFOLLOW | O_CLOEXEC));
    if (directory_parent.get() < 0 || worker.get() < 0)
      throw std::runtime_error("launcher file open failed");

    struct stat directory_stat {};
    struct stat directory_parent_stat {};
    struct stat worker_stat {};
    if (fstat(directory.get(), &directory_stat) != 0 ||
        fstat(directory_parent.get(), &directory_parent_stat) != 0 ||
        fstat(worker.get(), &worker_stat) != 0) {
      throw std::runtime_error("launcher identity read failed");
    }
    validate_identity(directory_stat, directory_parent_stat, request.directory_identity);
    validate_identity(worker_stat, directory_stat, request.worker_identity);
    if (hash_descriptor(worker.get()) != request.worker_sha256)
      throw std::runtime_error("launcher digest changed");
    struct stat worker_after_hash {};
    if (fstat(worker.get(), &worker_after_hash) != 0 ||
        worker_after_hash.st_dev != worker_stat.st_dev ||
        worker_after_hash.st_ino != worker_stat.st_ino ||
        worker_after_hash.st_size != worker_stat.st_size) {
      throw std::runtime_error("launcher executable changed during verification");
    }

    termination_requested = 0;
    const pid_t expected_parent = getppid();
    if (expected_parent <= 1 || prctl(PR_SET_CHILD_SUBREAPER, 1) != 0)
      throw std::runtime_error("launcher ownership setup failed");
    install_signal_handlers();
    if (prctl(PR_SET_PDEATHSIG, SIGTERM) != 0 || getppid() != expected_parent)
      throw std::runtime_error("launcher parent ownership failed");

    std::optional<UniqueModelDescriptor> model_authority;
    UniqueDescriptor worker_input_read;
    UniqueDescriptor worker_input_write;
    UniqueDescriptor worker_output_read;
    UniqueDescriptor worker_output_write;
    const bool full_load = request.launch_mode == WorkerLaunchMode::full_load;
    local_whisper::common::AuthorityBinding authority_binding{};
    if (full_load) {
      authority_binding = model_binding(request);
      LinuxModelAuthorityClient authority_client;
      model_authority.emplace(authority_client.acquire(authority_descriptor, authority_binding));
      static_cast<void>(close(authority_descriptor));
      std::array<int, 2> input_pipe{};
      if (pipe2(input_pipe.data(), O_CLOEXEC) != 0)
        throw std::runtime_error("launcher worker pipe creation failed");
      worker_input_read.reset(input_pipe[0]);
      worker_input_write.reset(input_pipe[1]);
      std::array<int, 2> output_pipe{};
      if (pipe2(output_pipe.data(), O_CLOEXEC) != 0)
        throw std::runtime_error("launcher worker pipe creation failed");
      worker_output_read.reset(output_pipe[0]);
      worker_output_write.reset(output_pipe[1]);
    }

    const pid_t child = fork();
    if (child < 0)
      throw std::runtime_error("launcher fork failed");
    if (child == 0) {
      const pid_t launcher_pid = getppid();
      if (setpgid(0, 0) != 0 || prctl(PR_SET_PDEATHSIG, SIGKILL) != 0 || launcher_pid <= 1 ||
          getppid() != launcher_pid) {
        _exit(126);
      }
      if (fchdir(directory.get()) != 0)
        _exit(126);
      static_cast<void>(close(control_descriptor));
      static_cast<void>(close(acknowledgment_descriptor));
      if (full_load) {
        worker_input_write.reset();
        worker_output_read.reset();
        if (dup2(worker_input_read.get(), STDIN_FILENO) != STDIN_FILENO ||
            dup2(worker_output_write.get(), STDOUT_FILENO) != STDOUT_FILENO) {
          _exit(126);
        }
        worker_input_read.reset();
        worker_output_write.reset();
        if (!model_authority.has_value() ||
            LinuxModelAuthorityClient::install_at_logical_slot(std::move(*model_authority)) != 3) {
          _exit(126);
        }
      }
      const char* mode = request.launch_mode == WorkerLaunchMode::full_load  ? "--load"
                         : request.launch_mode == WorkerLaunchMode::registry ? "--registry"
                                                                             : "--probe";
      std::array<char*, 3> arguments = {const_cast<char*>("local-whisper-worker"),
                                        const_cast<char*>(mode), nullptr};
      fexecve(worker.get(), arguments.data(), environ);
      _exit(126);
    }

    try {
      if (setpgid(child, child) != 0 && errno != EACCES)
        throw std::runtime_error("launcher worker group failed");
      UniqueDescriptor full_load_input;
      UniqueDescriptor full_load_output;
      if (full_load) {
        worker_input_read.reset();
        worker_output_write.reset();
        full_load_input = std::move(worker_input_write);
        full_load_output = std::move(worker_output_read);
        model_authority.reset();
        if (request.worker_bootstrap_bytes > 0U) {
          const auto device_bootstrap = read_exact(STDIN_FILENO, request.worker_bootstrap_bytes);
          write_exact(full_load_input.get(), device_bootstrap);
        }
        local_whisper::common::authorize_worker_model_bootstrap(
            full_load_input.get(), full_load_output.get(), authority_binding,
            static_cast<std::uint64_t>(child),
            local_whisper::common::linux_process_start_identity_sha256(child));
      }
      worker.reset();
      directory.reset();
      directory_parent.reset();
      write_acknowledgment(acknowledgment_descriptor, child);
      static_cast<void>(close(acknowledgment_descriptor));
      return full_load ? proxy_owned_group(child, control_descriptor, std::move(full_load_input),
                                           std::move(full_load_output))
                       : wait_for_owned_group(child, control_descriptor);
    } catch (...) {
      terminate_and_reap_owned_group(child);
      throw;
    }
  }
};

} // namespace

std::unique_ptr<PlatformLauncher> make_platform_launcher() {
  return std::make_unique<LinuxLauncher>();
}

} // namespace local_whisper::launcher
