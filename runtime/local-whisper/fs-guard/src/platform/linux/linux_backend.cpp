#include "platform/linux/linux_backend.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"
#include "local_whisper/fs_guard/validation.hpp"
#include "platform/linux/unique_fd.hpp"

#include <array>
#include <cerrno>
#include <cstdint>
#include <cstring>
#include <dirent.h>
#include <fcntl.h>
#include <iomanip>
#include <linux/openat2.h>
#include <map>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <vector>

namespace local_whisper::fs_guard {

// Linux safety proof: every managed component is opened relative to a held
// directory descriptor with openat2 RESOLVE_BENEATH, NO_SYMLINKS,
// NO_MAGICLINKS, and NO_XDEV. Promotion/quarantine use renameat2
// RENAME_NOREPLACE after comparing the held and named inode. Exact deletion
// uses unlinkat only after device/inode/type/link validation. No validated
// descriptor is closed and later replaced by an unchecked pathname reopen.

class LinuxBackend::Impl final {
public:
  explicit Impl(ResourceFailureInjector* failure_injector) noexcept
      : failure_injector_(failure_injector) {}

  static constexpr mode_t kPrivateDirectoryMode = 0700;
  static constexpr mode_t kPrivateFileModeMask = 0077;
  static constexpr unsigned int kResolveManaged =
      RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS | RESOLVE_NO_XDEV;
  static constexpr unsigned int kResolveExternal =
      RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS;

  ~Impl() noexcept {
    for (auto& [token, lease] : leases) {
      static_cast<void>(token);
      close_lease(lease);
    }
  }

  enum class LeaseKind { kRoot, kDirectory, kFile, kLock };

  struct Lease {
    UniqueFd fd;
    UniqueFd parent_fd;
    LeaseKind kind = LeaseKind::kDirectory;
    std::string name;
    dev_t root_device = 0;
    bool unlink_on_release = false;
    std::map<std::string, std::pair<dev_t, ino_t>> namespace_identities;
  };

  std::map<std::string, Lease> leases;
  std::uint64_t next_lease = 1;

  void before_resource_acquisition() const {
    if (failure_injector_ != nullptr)
      failure_injector_->before_resource_acquisition();
  }

  int open_file(const char* path, int flags) {
    before_resource_acquisition();
    return open(path, flags);
  }

  int open_at(int directory_fd, const std::string& name, int flags, mode_t mode) {
    before_resource_acquisition();
    return openat(directory_fd, name.c_str(), flags, mode);
  }

  int duplicate_fd(int fd) {
    before_resource_acquisition();
    return dup(fd);
  }

  UniqueDir open_directory(UniqueFd&& fd) {
    before_resource_acquisition();
    return UniqueDir(fdopendir(fd.release()));
  }

  void require_lease_capacity() const {
    if (leases.size() >= kMaxLiveLeases)
      throw GuardError("IO_FAILED");
  }

  void close_lease(Lease& lease) {
    if (lease.unlink_on_release && lease.parent_fd >= 0 && lease.fd >= 0) {
      struct stat held {};
      struct stat named {};
      if (fstat(lease.fd, &held) == 0 &&
          fstatat(lease.parent_fd, lease.name.c_str(), &named, AT_SYMLINK_NOFOLLOW) == 0 &&
          held.st_dev == named.st_dev && held.st_ino == named.st_ino) {
        unlinkat(lease.parent_fd, lease.name.c_str(), 0);
      }
    }
    lease.fd.reset();
    lease.parent_fd.reset();
  }

  int openat2_relative(int directory_fd, const std::string& name, int flags, mode_t mode,
                       unsigned int resolve) {
    before_resource_acquisition();
    struct open_how how {};
    how.flags = static_cast<std::uint64_t>(flags);
    how.mode = static_cast<std::uint64_t>(mode);
    how.resolve = resolve;
    const int fd =
        static_cast<int>(syscall(SYS_openat2, directory_fd, name.c_str(), &how, sizeof(how)));
    if (fd < 0 && errno == ENOSYS)
      throw GuardError("UNSUPPORTED");
    return fd;
  }

  struct stat checked_stat(int fd, dev_t expected_device, bool directory,
                           bool require_single_link) {
    struct stat value {};
    if (fstat(fd, &value) != 0)
      throw GuardError("IO_FAILED");
    if (value.st_dev != expected_device ||
        (directory ? !S_ISDIR(value.st_mode) : !S_ISREG(value.st_mode)) ||
        (require_single_link && value.st_nlink != 1)) {
      throw GuardError("UNSAFE_ENTRY");
    }
    return value;
  }

  std::string identity_string(int fd, int parent_fd) {
    struct stat value {};
    struct stat parent {};
    if (fstat(fd, &value) != 0 || fstat(parent_fd, &parent) != 0) {
      throw GuardError("IO_FAILED");
    }
    const char* type = S_ISDIR(value.st_mode)   ? "directory"
                       : S_ISREG(value.st_mode) ? "regular"
                                                : nullptr;
    if (type == nullptr)
      throw GuardError("UNSAFE_ENTRY");
    std::ostringstream output;
    output << static_cast<std::uint64_t>(value.st_dev) << '|'
           << static_cast<std::uint64_t>(value.st_ino) << '|'
           << static_cast<std::uint64_t>(value.st_nlink) << '|'
           << static_cast<unsigned int>(value.st_mode & 07777) << '|'
           << static_cast<std::uint64_t>(parent.st_ino) << '|'
           << static_cast<std::uint64_t>(value.st_size) << '|' << type;
    return output.str();
  }

  std::string add_lease(Lease lease) {
    require_lease_capacity();
    const std::string token = "lease-" + std::to_string(next_lease++);
    leases.emplace(token, std::move(lease));
    return token;
  }

  Lease& require_lease(const std::string& token) {
    const auto found = leases.find(token);
    if (found == leases.end())
      throw GuardError("INVALID_INPUT");
    return found->second;
  }

  Lease& require_root(const std::string& token) {
    Lease& lease = require_lease(token);
    if (lease.kind != LeaseKind::kRoot)
      throw GuardError("INVALID_INPUT");
    const struct stat value = checked_stat(lease.fd, lease.root_device, true, false);
    if (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700) {
      throw GuardError("UNSAFE_ENTRY");
    }
    return lease;
  }

  int open_managed_directory(int parent_fd, const std::string& name, dev_t root_device) {
    UniqueFd fd(openat2_relative(parent_fd, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW,
                                 0, kResolveManaged));
    if (!fd.valid())
      return -1;
    const struct stat value = checked_stat(fd.get(), root_device, true, false);
    if (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700) {
      throw GuardError("UNSAFE_ENTRY");
    }
    return fd.release();
  }

  int open_namespace(const Lease& root, const std::string& name) {
    if (name != "models" && name != "runtimes" && name != "staging" && name != "quarantine" &&
        name != "locks") {
      throw GuardError("INVALID_INPUT");
    }
    UniqueFd fd(open_managed_directory(root.fd.get(), name, root.root_device));
    if (fd < 0)
      throw GuardError("IO_FAILED");
    struct stat value {};
    const auto expected = root.namespace_identities.find(name);
    if (expected == root.namespace_identities.end() || fstat(fd.get(), &value) != 0 ||
        value.st_dev != expected->second.first || value.st_ino != expected->second.second) {
      throw GuardError("IDENTITY_CHANGED");
    }
    return fd.release();
  }

  void ensure_private_directory(int parent_fd, const std::string& name, dev_t expected_device) {
    if (mkdirat(parent_fd, name.c_str(), kPrivateDirectoryMode) != 0 && errno != EEXIST) {
      throw GuardError("IO_FAILED");
    }
    UniqueFd fd(openat2_relative(parent_fd, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW,
                                 0, kResolveManaged));
    if (!fd.valid())
      throw GuardError("UNSAFE_ENTRY");
    struct stat value {};
    if (fstat(fd.get(), &value) != 0 || value.st_dev != expected_device ||
        !S_ISDIR(value.st_mode) || value.st_uid != geteuid() ||
        (value.st_mode & 0777) != kPrivateDirectoryMode) {
      throw GuardError("UNSAFE_ENTRY");
    }
  }

  std::vector<std::string> absolute_components(const std::string& value) {
    if (value.size() < 2 || value.front() != '/' || value.back() == '/' ||
        value.find('\0') != std::string::npos) {
      throw GuardError("INVALID_INPUT");
    }
    std::vector<std::string> components;
    for (const auto& component : split(value.substr(1), '/')) {
      if (!is_safe_path_component(component)) {
        throw GuardError("INVALID_INPUT");
      }
      components.push_back(component);
    }
    if (components.size() < 3)
      throw GuardError("INVALID_INPUT");
    return components;
  }

  Lease initialize_root(const std::string& path) {
    const auto components = absolute_components(path);
    UniqueFd current(open_file("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC));
    if (!current.valid())
      throw GuardError("IO_FAILED");
    UniqueFd root_parent;
    dev_t managed_device = 0;
    for (std::size_t index = 0; index < components.size(); ++index) {
      struct stat parent {};
      if (fstat(current.get(), &parent) != 0)
        throw GuardError("IO_FAILED");
      const bool managed_component = index + 2 >= components.size();
      if (index + 1 == components.size()) {
        root_parent.reset(duplicate_fd(current.get()));
        if (!root_parent.valid())
          throw GuardError("IO_FAILED");
      }
      if (managed_component && managed_device == 0)
        managed_device = parent.st_dev;
      const unsigned int resolve = managed_component ? kResolveManaged : kResolveExternal;
      UniqueFd next(openat2_relative(current.get(), components[index],
                                     O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW, 0, resolve));
      bool created = false;
      if (!next.valid() && errno == ENOENT) {
        if (mkdirat(current.get(), components[index].c_str(), kPrivateDirectoryMode) != 0) {
          throw GuardError("IO_FAILED");
        }
        created = true;
        next.reset(openat2_relative(current.get(), components[index],
                                    O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW, 0, resolve));
      }
      if (!next.valid())
        throw GuardError("UNSAFE_ENTRY");
      struct stat value {};
      if (fstat(next.get(), &value) != 0 || !S_ISDIR(value.st_mode) ||
          (managed_component && value.st_dev != managed_device)) {
        throw GuardError("UNSAFE_ENTRY");
      }
      if (managed_component && (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700)) {
        throw GuardError("UNSAFE_ENTRY");
      }
      if (created && fchmod(next.get(), kPrivateDirectoryMode) != 0) {
        throw GuardError("IO_FAILED");
      }
      current = std::move(next);
    }
    struct stat root_stat {};
    if (fstat(current.get(), &root_stat) != 0)
      throw GuardError("IO_FAILED");
    managed_device = root_stat.st_dev;
    std::map<std::string, std::pair<dev_t, ino_t>> namespace_identities;
    for (const char* name : {"runtimes", "models", "staging", "quarantine", "locks"}) {
      ensure_private_directory(current.get(), name, managed_device);
      UniqueFd namespace_fd(open_managed_directory(current.get(), name, managed_device));
      if (!namespace_fd.valid())
        throw GuardError("IO_FAILED");
      struct stat namespace_stat {};
      if (fstat(namespace_fd.get(), &namespace_stat) != 0)
        throw GuardError("IO_FAILED");
      namespace_identities.emplace(name, std::pair{namespace_stat.st_dev, namespace_stat.st_ino});
    }
    if (!root_parent.valid())
      throw GuardError("IO_FAILED");
    return Lease{std::move(current),
                 std::move(root_parent),
                 LeaseKind::kRoot,
                 components.back(),
                 managed_device,
                 false,
                 std::move(namespace_identities)};
  }

  class Sha256 {
  public:
    void update(const unsigned char* data, std::size_t length) {
      for (std::size_t index = 0; index < length; ++index) {
        buffer_[buffer_length_++] = data[index];
        bit_length_ += 8;
        if (buffer_length_ == 64) {
          transform();
          buffer_length_ = 0;
        }
      }
    }

    std::string finish() {
      buffer_[buffer_length_++] = 0x80;
      if (buffer_length_ > 56) {
        while (buffer_length_ < 64)
          buffer_[buffer_length_++] = 0;
        transform();
        buffer_length_ = 0;
      }
      while (buffer_length_ < 56)
        buffer_[buffer_length_++] = 0;
      for (int shift = 56; shift >= 0; shift -= 8) {
        buffer_[buffer_length_++] = static_cast<unsigned char>((bit_length_ >> shift) & 0xffU);
      }
      transform();
      std::ostringstream output;
      output << std::hex << std::setfill('0');
      for (const auto value : state_)
        output << std::setw(8) << value;
      return output.str();
    }

  private:
    static constexpr std::array<std::uint32_t, 64> constants_ = {
        0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU, 0x59f111f1U, 0x923f82a4U,
        0xab1c5ed5U, 0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U, 0x72be5d74U, 0x80deb1feU,
        0x9bdc06a7U, 0xc19bf174U, 0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU, 0x2de92c6fU,
        0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU, 0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
        0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU,
        0x53380d13U, 0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U, 0xa2bfe8a1U, 0xa81a664bU,
        0xc24b8b70U, 0xc76c51a3U, 0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U, 0x19a4c116U,
        0x1e376c08U, 0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
        0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U, 0x90befffaU, 0xa4506cebU, 0xbef9a3f7U,
        0xc67178f2U};

    static std::uint32_t rotate(std::uint32_t value, unsigned int count) {
      return (value >> count) | (value << (32U - count));
    }

    void transform() {
      std::array<std::uint32_t, 64> words{};
      for (std::size_t index = 0; index < 16; ++index) {
        words[index] = (static_cast<std::uint32_t>(buffer_[index * 4]) << 24U) |
                       (static_cast<std::uint32_t>(buffer_[index * 4 + 1]) << 16U) |
                       (static_cast<std::uint32_t>(buffer_[index * 4 + 2]) << 8U) |
                       buffer_[index * 4 + 3];
      }
      for (std::size_t index = 16; index < 64; ++index) {
        const std::uint32_t s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^
                                 (words[index - 15] >> 3U);
        const std::uint32_t s1 =
            rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >> 10U);
        words[index] = words[index - 16] + s0 + words[index - 7] + s1;
      }
      std::uint32_t a = state_[0], b = state_[1], c = state_[2], d = state_[3];
      std::uint32_t e = state_[4], f = state_[5], g = state_[6], h = state_[7];
      for (std::size_t index = 0; index < 64; ++index) {
        const std::uint32_t s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const std::uint32_t choice = (e & f) ^ ((~e) & g);
        const std::uint32_t temp1 = h + s1 + choice + constants_[index] + words[index];
        const std::uint32_t s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const std::uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
        const std::uint32_t temp2 = s0 + majority;
        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
      }
      state_[0] += a;
      state_[1] += b;
      state_[2] += c;
      state_[3] += d;
      state_[4] += e;
      state_[5] += f;
      state_[6] += g;
      state_[7] += h;
    }

    std::array<unsigned char, 64> buffer_{};
    std::size_t buffer_length_ = 0;
    std::uint64_t bit_length_ = 0;
    std::array<std::uint32_t, 8> state_ = {0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
                                           0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U};
  };

  std::string hash_file(int fd) {
    if (lseek(fd, 0, SEEK_SET) < 0)
      throw GuardError("IO_FAILED");
    Sha256 digest;
    std::array<unsigned char, 64 * 1024> buffer{};
    while (true) {
      const ssize_t count = read(fd, buffer.data(), buffer.size());
      if (count < 0 && errno == EINTR)
        continue;
      if (count < 0)
        throw GuardError("IO_FAILED");
      if (count == 0)
        break;
      digest.update(buffer.data(), static_cast<std::size_t>(count));
    }
    return digest.finish();
  }

  std::optional<std::string> process_start_identity(pid_t pid) {
    const std::string path = "/proc/" + std::to_string(pid) + "/stat";
    UniqueFd fd(open_file(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW));
    if (!fd.valid()) {
      return errno == ENOENT || errno == ESRCH ? std::optional<std::string>(std::string{})
                                               : std::nullopt;
    }
    std::array<char, 4096> buffer{};
    const ssize_t count = read(fd.get(), buffer.data(), buffer.size() - 1);
    if (count <= 0)
      return std::nullopt;
    const std::string contents(buffer.data(), static_cast<std::size_t>(count));
    const std::size_t close_parenthesis = contents.rfind(')');
    if (close_parenthesis == std::string::npos || close_parenthesis + 2 >= contents.size()) {
      return std::nullopt;
    }
    const auto fields = split(contents.substr(close_parenthesis + 2), ' ');
    return fields.size() > 19 ? std::optional<std::string>(fields[19]) : std::nullopt;
  }

  std::vector<std::string> read_lock_metadata(int fd) {
    if (lseek(fd, 0, SEEK_SET) < 0)
      throw GuardError("UNSAFE_ENTRY");
    std::array<char, 2048> buffer{};
    const ssize_t count = read(fd, buffer.data(), buffer.size() - 1);
    if (count <= 0 || count >= static_cast<ssize_t>(buffer.size() - 1)) {
      throw GuardError("UNSAFE_ENTRY");
    }
    auto fields = split(std::string_view(buffer.data(), static_cast<std::size_t>(count)), '\n');
    if (!fields.empty() && fields.back().empty())
      fields.pop_back();
    if (fields.size() != 5)
      throw GuardError("UNSAFE_ENTRY");
    return fields;
  }

  void write_all(int fd, std::string_view data) {
    std::size_t offset = 0;
    while (offset < data.size()) {
      const ssize_t written = write(fd, data.data() + offset, data.size() - offset);
      if (written < 0 && errno == EINTR)
        continue;
      if (written <= 0)
        throw GuardError("IO_FAILED");
      offset += static_cast<std::size_t>(written);
    }
  }

  std::string acquire_lock(Lease& root, const LockCommand& command) {
    const std::string name = "lock-" + command.artifact_name;
    UniqueFd locks_fd(open_namespace(root, "locks"));
    UniqueFd rollback_parent(duplicate_fd(locks_fd.get()));
    if (!rollback_parent.valid())
      throw GuardError("IO_FAILED");
    for (int attempt = 0; attempt < 2; ++attempt) {
      UniqueFd created(open_at(locks_fd.get(), name,
                               O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600));
      if (created.valid()) {
        try {
          if (fchmod(created.get(), 0600) != 0)
            throw GuardError("IO_FAILED");
          checked_stat(created.get(), root.root_device, false, true);
          const std::string metadata = command.instance_nonce + "\n" + command.process_id.text() +
                                       "\n" + command.process_identity + "\n" +
                                       std::string(command.operation.text()) + "\n" +
                                       command.artifact_id + "\n";
          write_all(created.get(), metadata);
          if (fsync(created.get()) != 0)
            throw GuardError("IO_FAILED");
          return add_lease(Lease{std::move(created),
                                 std::move(locks_fd),
                                 LeaseKind::kLock,
                                 name,
                                 root.root_device,
                                 true,
                                 {}});
        } catch (...) {
          unlinkat(rollback_parent.get(), name.c_str(), 0);
          throw;
        }
      }
      if (errno != EEXIST)
        throw GuardError("IO_FAILED");
      UniqueFd existing(openat2_relative(locks_fd.get(), name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0,
                                         kResolveManaged));
      if (!existing.valid())
        throw GuardError("UNSAFE_ENTRY");
      const struct stat held = checked_stat(existing.get(), root.root_device, false, true);
      const auto metadata = read_lock_metadata(existing.get());
      char* owner_end = nullptr;
      const long owner_pid = std::strtol(metadata[1].c_str(), &owner_end, 10);
      if (owner_end == metadata[1].c_str() || *owner_end != '\0' || owner_pid <= 0 ||
          !is_safe_token(metadata[0], 16, 128) || !is_safe_token(metadata[2], 1, 128) ||
          !is_safe_token(metadata[3], 1, 32) || !is_safe_token(metadata[4], 1, 128)) {
        throw GuardError("UNSAFE_ENTRY");
      }
      const auto owner_identity = process_start_identity(static_cast<pid_t>(owner_pid));
      if (!owner_identity.has_value())
        throw GuardError("UNSAFE_ENTRY");
      if (*owner_identity == metadata[2])
        throw GuardError("CONFLICT");
      struct stat named {};
      if (fstatat(locks_fd.get(), name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
          named.st_dev != held.st_dev || named.st_ino != held.st_ino ||
          unlinkat(locks_fd.get(), name.c_str(), 0) != 0) {
        throw GuardError("UNSAFE_ENTRY");
      }
    }
    throw GuardError("CONFLICT");
  }

  std::vector<std::string>
  list_directory(Lease& lease, const std::map<std::string, unsigned int>& expected_modes) {
    if (lease.kind != LeaseKind::kDirectory)
      throw GuardError("INVALID_INPUT");
    const bool require_exact_expectations = !expected_modes.empty();
    UniqueFd duplicate(duplicate_fd(lease.fd.get()));
    if (!duplicate.valid())
      throw GuardError("IO_FAILED");
    UniqueDir directory(open_directory(std::move(duplicate)));
    if (!directory.valid()) {
      throw GuardError("IO_FAILED");
    }
    rewinddir(directory.get());
    std::map<std::string, unsigned int> remaining(expected_modes);
    std::vector<std::string> result;
    while (true) {
      errno = 0;
      dirent* entry = readdir(directory.get());
      if (entry == nullptr) {
        if (errno != 0) {
          throw GuardError("IO_FAILED");
        }
        break;
      }
      const std::string name = entry->d_name;
      if (name == "." || name == "..")
        continue;
      const auto expected = remaining.find(name);
      if (!is_file_name(name) || (require_exact_expectations && expected == remaining.end())) {
        throw GuardError("UNSAFE_ENTRY");
      }
      UniqueFd fd(openat2_relative(lease.fd.get(), name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0,
                                   kResolveManaged));
      if (!fd.valid()) {
        throw GuardError("UNSAFE_ENTRY");
      }
      const struct stat metadata = checked_stat(fd.get(), lease.root_device, false, true);
      if (require_exact_expectations) {
        if (static_cast<unsigned int>(metadata.st_mode & 0777U) != expected->second)
          throw GuardError("UNSAFE_ENTRY");
        remaining.erase(expected);
      }
      result.push_back(name + "~" + identity_string(fd.get(), lease.fd.get()) + "~" +
                       hash_file(fd.get()));
    }
    if (require_exact_expectations && !remaining.empty())
      throw GuardError("UNSAFE_ENTRY");
    return result;
  }

  std::vector<std::string> list_namespace(Lease& root, const std::string& name) {
    UniqueFd namespace_fd(open_namespace(root, name));
    UniqueFd duplicate(duplicate_fd(namespace_fd.get()));
    if (!duplicate.valid()) {
      throw GuardError("IO_FAILED");
    }
    UniqueDir directory(open_directory(std::move(duplicate)));
    if (!directory.valid()) {
      throw GuardError("IO_FAILED");
    }
    std::vector<std::string> result;
    while (true) {
      errno = 0;
      dirent* entry = readdir(directory.get());
      if (entry == nullptr) {
        if (errno != 0) {
          throw GuardError("IO_FAILED");
        }
        break;
      }
      const std::string entry_name = entry->d_name;
      if (entry_name == "." || entry_name == "..")
        continue;
      int fd = -1;
      try {
        fd = open_managed_directory(namespace_fd.get(), entry_name, root.root_device);
      } catch (const GuardError&) {
        result.push_back("unmanaged-entry");
        continue;
      }
      if (fd < 0) {
        result.push_back("unmanaged-entry");
        continue;
      }
      UniqueFd managed_directory(fd);
      result.push_back(entry_name);
    }
    return result;
  }

  ResponseFields process_identity(const ProcessIdentityCommand& command) {
    const auto identity = process_start_identity(static_cast<pid_t>(command.process_id.value()));
    if (!identity.has_value() || identity->empty())
      throw GuardError("UNSAFE_ENTRY");
    return {*identity};
  }

  ResponseFields initialize(const InitCommand& command) {
    if (command.platform.value() != Platform::Value::kLinux)
      throw GuardError("UNSUPPORTED");
    require_lease_capacity();
    Lease root = initialize_root(command.root_path);
    const std::string identity = identity_string(root.fd, root.parent_fd);
    const std::string token = add_lease(std::move(root));
    return {token, identity};
  }

  ResponseFields lock(const LockCommand& command) {
    Lease& root = require_root(command.root_token);
    require_lease_capacity();
    const std::string token = acquire_lock(root, command);
    Lease& lock = require_lease(token);
    return {token, identity_string(lock.fd, lock.parent_fd)};
  }

  ResponseFields create_staging(const CreateStagingCommand& command) {
    Lease& root = require_root(command.root_token);
    require_lease_capacity();
    const std::string name = "stage-" + command.artifact_name + "-" + command.nonce;
    UniqueFd parent(open_namespace(root, "staging"));
    if (mkdirat(parent.get(), name.c_str(), 0700) != 0) {
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    bool remove_directory = true;
    UniqueFd fd(open_managed_directory(parent.get(), name, root.root_device));
    if (!fd.valid() || fchmod(fd.get(), 0700) != 0) {
      unlinkat(parent.get(), name.c_str(), AT_REMOVEDIR);
      throw GuardError("IO_FAILED");
    }
    UniqueFd rollback_parent(duplicate_fd(parent.get()));
    if (!rollback_parent.valid()) {
      unlinkat(parent.get(), name.c_str(), AT_REMOVEDIR);
      throw GuardError("IO_FAILED");
    }
    try {
      const std::string identity = identity_string(fd.get(), parent.get());
      const std::string token = add_lease(Lease{std::move(fd),
                                                std::move(parent),
                                                LeaseKind::kDirectory,
                                                name,
                                                root.root_device,
                                                false,
                                                {}});
      remove_directory = false;
      return {token, identity};
    } catch (...) {
      if (remove_directory)
        unlinkat(rollback_parent.get(), name.c_str(), AT_REMOVEDIR);
      throw;
    }
  }

  ResponseFields create_file(const CreateFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory)
      throw GuardError("INVALID_INPUT");
    require_lease_capacity();
    const unsigned int mode_value = command.mode.value();
    if ((mode_value & kPrivateFileModeMask) != 0U) {
      throw GuardError("INVALID_INPUT");
    }
    UniqueFd fd(open_at(directory.fd.get(), command.file_name,
                        O_RDWR | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW,
                        static_cast<mode_t>(mode_value)));
    if (!fd.valid())
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    bool remove_file = true;
    if (fchmod(fd.get(), static_cast<mode_t>(mode_value)) != 0) {
      unlinkat(directory.fd.get(), command.file_name.c_str(), 0);
      throw GuardError("IO_FAILED");
    }
    checked_stat(fd.get(), directory.root_device, false, true);
    UniqueFd parent(duplicate_fd(directory.fd.get()));
    if (!parent.valid()) {
      unlinkat(directory.fd.get(), command.file_name.c_str(), 0);
      throw GuardError("IO_FAILED");
    }
    try {
      const std::string identity = identity_string(fd.get(), parent.get());
      const std::string token = add_lease(Lease{std::move(fd),
                                                std::move(parent),
                                                LeaseKind::kFile,
                                                command.file_name,
                                                directory.root_device,
                                                false,
                                                {}});
      remove_file = false;
      return {token, identity};
    } catch (...) {
      if (remove_file)
        unlinkat(directory.fd.get(), command.file_name.c_str(), 0);
      throw;
    }
  }

  ResponseFields write_file(const WriteFileCommand& command) {
    Lease& file = require_lease(command.file_token);
    if (file.kind != LeaseKind::kFile)
      throw GuardError("INVALID_INPUT");
    write_all(file.fd, command.bytes);
    return {};
  }

  ResponseFields seal_file(const SealFileCommand& command) {
    Lease& file = require_lease(command.file_token);
    if (file.kind != LeaseKind::kFile || fsync(file.fd) != 0)
      throw GuardError("IO_FAILED");
    checked_stat(file.fd, file.root_device, false, true);
    return {identity_string(file.fd, file.parent_fd)};
  }

  ResponseFields list(const ListCommand& command) {
    std::map<std::string, unsigned int> expected_modes;
    for (const ExpectedEntry& expected : command.expected_entries) {
      expected_modes.emplace(expected.name, expected.mode.value());
    }
    return list_directory(require_lease(command.directory_token), expected_modes);
  }

  ResponseFields list_namespace_command(const ListNamespaceCommand& command) {
    return list_namespace(require_root(command.root_token),
                          std::string(command.namespace_name.text()));
  }

  ResponseFields open_artifact(const OpenArtifactCommand& command) {
    if (!is_artifact_name(command.artifact_name))
      throw GuardError("INVALID_INPUT");
    Lease& root = require_root(command.root_token);
    UniqueFd parent(open_namespace(root, std::string(command.namespace_name.text())));
    UniqueFd fd(open_managed_directory(parent.get(), command.artifact_name, root.root_device));
    if (!fd.valid() && errno == ENOENT) {
      return {"MISSING"};
    }
    if (!fd.valid()) {
      throw GuardError("UNSAFE_ENTRY");
    }
    require_lease_capacity();
    const std::string identity = identity_string(fd.get(), parent.get());
    const std::string token = add_lease(Lease{std::move(fd),
                                              std::move(parent),
                                              LeaseKind::kDirectory,
                                              command.artifact_name,
                                              root.root_device,
                                              false,
                                              {}});
    return {token, identity};
  }

  ResponseFields promote(const PromoteCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& staging = require_lease(command.staging_token);
    if (staging.kind != LeaseKind::kDirectory || staging.root_device != root.root_device ||
        staging.name.rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    checked_stat(staging.fd, root.root_device, true, false);
    struct stat held {};
    struct stat named {};
    if (fstat(staging.fd, &held) != 0 ||
        fstatat(staging.parent_fd, staging.name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
        held.st_dev != named.st_dev || held.st_ino != named.st_ino) {
      throw GuardError("IDENTITY_CHANGED");
    }
    UniqueFd final_parent(open_namespace(root, std::string(command.namespace_name.text())));
    if (syscall(SYS_renameat2, staging.parent_fd.get(), staging.name.c_str(), final_parent.get(),
                command.artifact_name.c_str(), RENAME_NOREPLACE) != 0) {
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    const std::string result = identity_string(staging.fd.get(), final_parent.get());
    return {result};
  }

  ResponseFields quarantine(const QuarantineCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& artifact = require_lease(command.artifact_token);
    if (artifact.kind != LeaseKind::kDirectory || artifact.name != command.artifact_name ||
        artifact.root_device != root.root_device) {
      throw GuardError("IDENTITY_CHANGED");
    }
    require_lease_capacity();
    UniqueFd source_parent(open_namespace(root, std::string(command.namespace_name.text())));
    struct stat named {};
    struct stat held {};
    if (fstat(artifact.fd, &held) != 0 ||
        fstatat(source_parent.get(), command.artifact_name.c_str(), &named, AT_SYMLINK_NOFOLLOW) !=
            0 ||
        held.st_dev != named.st_dev || held.st_ino != named.st_ino) {
      throw GuardError("IDENTITY_CHANGED");
    }
    UniqueFd quarantine_parent(open_namespace(root, "quarantine"));
    const std::string quarantine_name = "quarantine-" + command.artifact_name + "-" + command.nonce;
    if (syscall(SYS_renameat2, source_parent.get(), command.artifact_name.c_str(),
                quarantine_parent.get(), quarantine_name.c_str(), RENAME_NOREPLACE) != 0) {
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    UniqueFd duplicate(duplicate_fd(artifact.fd.get()));
    if (!duplicate.valid()) {
      throw GuardError("IO_FAILED");
    }
    const std::string identity = identity_string(duplicate.get(), quarantine_parent.get());
    const std::string token = add_lease(Lease{std::move(duplicate),
                                              std::move(quarantine_parent),
                                              LeaseKind::kDirectory,
                                              quarantine_name,
                                              root.root_device,
                                              false,
                                              {}});
    return {token, identity};
  }

  ResponseFields delete_file(const DeleteFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    UniqueFd fd(openat2_relative(directory.fd.get(), command.file_name,
                                 O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0, kResolveManaged));
    if (!fd.valid())
      throw GuardError("IDENTITY_CHANGED");
    checked_stat(fd.get(), directory.root_device, false, true);
    const std::string current = identity_string(fd.get(), directory.fd.get());
    if (current != command.identity)
      throw GuardError("IDENTITY_CHANGED");
    if (unlinkat(directory.fd, command.file_name.c_str(), 0) != 0)
      throw GuardError("IO_FAILED");
    return {};
  }

  ResponseFields delete_staging_file(const DeleteStagingFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    UniqueFd fd(openat2_relative(directory.fd.get(), command.file_name,
                                 O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0, kResolveManaged));
    if (!fd.valid())
      throw GuardError("IDENTITY_CHANGED");
    checked_stat(fd.get(), directory.root_device, false, true);
    const std::string current = identity_string(fd.get(), directory.fd.get());
    if (current != command.identity)
      throw GuardError("IDENTITY_CHANGED");
    if (unlinkat(directory.fd, command.file_name.c_str(), 0) != 0)
      throw GuardError("IO_FAILED");
    return {};
  }

  ResponseFields remove_quarantine(const RemoveQuarantineCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("quarantine-", 0) != 0 ||
        directory.root_device != root.root_device) {
      throw GuardError("INVALID_INPUT");
    }
    if (!list_directory(directory, {}).empty())
      throw GuardError("UNSAFE_ENTRY");
    struct stat held {};
    struct stat named {};
    if (fstat(directory.fd, &held) != 0 ||
        fstatat(directory.parent_fd, directory.name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
        held.st_dev != named.st_dev || held.st_ino != named.st_ino ||
        unlinkat(directory.parent_fd, directory.name.c_str(), AT_REMOVEDIR) != 0) {
      throw GuardError("IDENTITY_CHANGED");
    }
    return {};
  }

  ResponseFields remove_staging(const RemoveStagingCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("stage-", 0) != 0 ||
        directory.root_device != root.root_device) {
      throw GuardError("INVALID_INPUT");
    }
    if (!list_directory(directory, {}).empty())
      throw GuardError("UNSAFE_ENTRY");
    struct stat held {};
    struct stat named {};
    if (fstat(directory.fd, &held) != 0 ||
        fstatat(directory.parent_fd, directory.name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
        held.st_dev != named.st_dev || held.st_ino != named.st_ino ||
        unlinkat(directory.parent_fd, directory.name.c_str(), AT_REMOVEDIR) != 0) {
      throw GuardError("IDENTITY_CHANGED");
    }
    return {};
  }

  ResponseFields revalidate(const RevalidateCommand& command) {
    Lease& lease = require_lease(command.token);
    const auto expected = split(command.identity, '|');
    const auto current = split(identity_string(lease.fd, lease.parent_fd), '|');
    if (expected.size() != 7 || current.size() != 7)
      throw GuardError("INVALID_INPUT");
    const bool directory = current[6] == "directory";
    for (std::size_t index = 0; index < current.size(); ++index) {
      if (directory && index == 5)
        continue;
      if (current[index] != expected[index])
        throw GuardError("IDENTITY_CHANGED");
    }
    if (!lease.name.empty()) {
      struct stat held {};
      struct stat named {};
      if (fstat(lease.fd, &held) != 0 ||
          fstatat(lease.parent_fd, lease.name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
          held.st_dev != named.st_dev || held.st_ino != named.st_ino) {
        throw GuardError("IDENTITY_CHANGED");
      }
    }
    return {};
  }

  ResponseFields release(const ReleaseCommand& command) {
    const auto found = leases.find(command.token);
    if (found == leases.end())
      return {};
    close_lease(found->second);
    leases.erase(found);
    return {};
  }

private:
  ResourceFailureInjector* failure_injector_;
};

LinuxBackend::LinuxBackend() : impl_(std::make_unique<Impl>(nullptr)) {}
LinuxBackend::LinuxBackend(ResourceFailureInjector& failure_injector)
    : impl_(std::make_unique<Impl>(&failure_injector)) {}
LinuxBackend::~LinuxBackend() = default;
LinuxBackend::LinuxBackend(LinuxBackend&&) noexcept = default;
LinuxBackend& LinuxBackend::operator=(LinuxBackend&&) noexcept = default;

ResponseFields LinuxBackend::process_identity(const ProcessIdentityCommand& command) {
  return impl_->process_identity(command);
}

ResponseFields LinuxBackend::initialize(const InitCommand& command) {
  return impl_->initialize(command);
}

ResponseFields LinuxBackend::lock(const LockCommand& command) { return impl_->lock(command); }

ResponseFields LinuxBackend::create_staging(const CreateStagingCommand& command) {
  return impl_->create_staging(command);
}

ResponseFields LinuxBackend::create_file(const CreateFileCommand& command) {
  return impl_->create_file(command);
}

ResponseFields LinuxBackend::write_file(const WriteFileCommand& command) {
  return impl_->write_file(command);
}

ResponseFields LinuxBackend::seal_file(const SealFileCommand& command) {
  return impl_->seal_file(command);
}

ResponseFields LinuxBackend::list(const ListCommand& command) { return impl_->list(command); }

ResponseFields LinuxBackend::list_namespace(const ListNamespaceCommand& command) {
  return impl_->list_namespace_command(command);
}

ResponseFields LinuxBackend::open_artifact(const OpenArtifactCommand& command) {
  return impl_->open_artifact(command);
}

ResponseFields LinuxBackend::promote(const PromoteCommand& command) {
  return impl_->promote(command);
}

ResponseFields LinuxBackend::quarantine(const QuarantineCommand& command) {
  return impl_->quarantine(command);
}

ResponseFields LinuxBackend::delete_file(const DeleteFileCommand& command) {
  return impl_->delete_file(command);
}

ResponseFields LinuxBackend::delete_staging_file(const DeleteStagingFileCommand& command) {
  return impl_->delete_staging_file(command);
}

ResponseFields LinuxBackend::remove_quarantine(const RemoveQuarantineCommand& command) {
  return impl_->remove_quarantine(command);
}

ResponseFields LinuxBackend::remove_staging(const RemoveStagingCommand& command) {
  return impl_->remove_staging(command);
}

ResponseFields LinuxBackend::revalidate(const RevalidateCommand& command) {
  return impl_->revalidate(command);
}

ResponseFields LinuxBackend::release(const ReleaseCommand& command) {
  return impl_->release(command);
}

} // namespace local_whisper::fs_guard
