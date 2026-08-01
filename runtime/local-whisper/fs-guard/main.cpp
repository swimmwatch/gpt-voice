#if defined(_WIN32)
#error "Build windows_main.cpp for the Windows fs-guard"

#else

#include <array>
#include <cerrno>
#include <cstdint>
#include <cstring>
#include <dirent.h>
#include <fcntl.h>
#include <iomanip>
#include <iostream>
#include <linux/openat2.h>
#include <map>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <vector>

namespace {

// Linux safety proof: every managed component is opened relative to a held
// directory descriptor with openat2 RESOLVE_BENEATH, NO_SYMLINKS,
// NO_MAGICLINKS, and NO_XDEV. Promotion/quarantine use renameat2
// RENAME_NOREPLACE after comparing the held and named inode. Exact deletion
// uses unlinkat only after device/inode/type/link validation. No validated
// descriptor is closed and later replaced by an unchecked pathname reopen.

constexpr std::size_t kMaxLineBytes = 256U * 1024U;
constexpr mode_t kPrivateDirectoryMode = 0700;
constexpr mode_t kPrivateFileModeMask = 0077;
constexpr unsigned int kResolveManaged =
    RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS |
    RESOLVE_NO_XDEV;
constexpr unsigned int kResolveExternal =
    RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS;

class GuardError final : public std::runtime_error {
 public:
  explicit GuardError(std::string code)
      : std::runtime_error(code), code_(std::move(code)) {}
  const std::string& code() const { return code_; }

 private:
  std::string code_;
};

enum class LeaseKind { kRoot, kDirectory, kFile, kLock };

struct Lease {
  int fd = -1;
  int parent_fd = -1;
  LeaseKind kind = LeaseKind::kDirectory;
  std::string name;
  dev_t root_device = 0;
  bool unlink_on_release = false;
  std::map<std::string, std::pair<dev_t, ino_t>> namespace_identities;
};

std::map<std::string, Lease> leases;
std::uint64_t next_lease = 1;

void close_lease(Lease& lease) {
  if (lease.unlink_on_release && lease.parent_fd >= 0 && lease.fd >= 0) {
    struct stat held {};
    struct stat named {};
    if (fstat(lease.fd, &held) == 0 &&
        fstatat(lease.parent_fd, lease.name.c_str(), &named,
                AT_SYMLINK_NOFOLLOW) == 0 &&
        held.st_dev == named.st_dev && held.st_ino == named.st_ino) {
      unlinkat(lease.parent_fd, lease.name.c_str(), 0);
    }
  }
  if (lease.fd >= 0) close(lease.fd);
  if (lease.parent_fd >= 0) close(lease.parent_fd);
  lease.fd = -1;
  lease.parent_fd = -1;
}

std::vector<std::string> split(std::string_view input, char delimiter) {
  std::vector<std::string> result;
  std::size_t start = 0;
  while (start <= input.size()) {
    const std::size_t end = input.find(delimiter, start);
    result.emplace_back(input.substr(start, end == std::string_view::npos
                                               ? input.size() - start
                                               : end - start));
    if (end == std::string_view::npos) break;
    start = end + 1;
  }
  return result;
}

bool is_safe_token(std::string_view value, std::size_t minimum,
                   std::size_t maximum) {
  if (value.size() < minimum || value.size() > maximum) return false;
  for (const unsigned char character : value) {
    if (!(std::isalnum(character) || character == '-' || character == '_' ||
          character == '.')) {
      return false;
    }
  }
  return true;
}

bool is_safe_path_component(std::string_view value) {
  if (value.empty() || value.size() > 255 || value == "." || value == "..") {
    return false;
  }
  for (const unsigned char character : value) {
    if (character == '/' || character == '\0' || character < 0x20U ||
        character == 0x7fU) {
      return false;
    }
  }
  return true;
}

bool is_artifact_name(std::string_view value) {
  const std::size_t prefix = value.rfind("model-", 0) == 0 ? 6 :
                             value.rfind("runtime-", 0) == 0 ? 8 : 0;
  if (prefix == 0 || value.size() != prefix + 64) return false;
  for (std::size_t index = prefix; index < value.size(); ++index) {
    if (!std::isxdigit(static_cast<unsigned char>(value[index])) ||
        std::isupper(static_cast<unsigned char>(value[index]))) {
      return false;
    }
  }
  return true;
}

bool is_file_name(std::string_view value) {
  return value == "managed-manifest-v1" ||
         (value.rfind("file-", 0) == 0 && is_safe_token(value, 6, 197));
}

std::string base64url_encode(std::string_view input) {
  static constexpr char table[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string result;
  result.reserve((input.size() * 4 + 2) / 3);
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const unsigned char character : input) {
    accumulator = (accumulator << 8U) | character;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result.push_back(table[(accumulator >> bits) & 0x3fU]);
    }
  }
  if (bits > 0) result.push_back(table[(accumulator << (6 - bits)) & 0x3fU]);
  return result;
}

std::string base64url_decode(std::string_view input) {
  std::array<int, 256> inverse {};
  inverse.fill(-1);
  const std::string table =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (std::size_t index = 0; index < table.size(); ++index) {
    inverse[static_cast<unsigned char>(table[index])] = static_cast<int>(index);
  }
  std::string result;
  std::uint32_t accumulator = 0;
  int bits = 0;
  for (const unsigned char character : input) {
    const int value = inverse[character];
    if (value < 0) throw GuardError("INVALID_INPUT");
    accumulator = (accumulator << 6U) | static_cast<unsigned int>(value);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result.push_back(static_cast<char>((accumulator >> bits) & 0xffU));
    }
  }
  if (bits > 0 && (accumulator & ((1U << bits) - 1U)) != 0) {
    throw GuardError("INVALID_INPUT");
  }
  if (base64url_encode(result) != input) throw GuardError("INVALID_INPUT");
  return result;
}

void respond(const std::string& request_id, bool success,
             const std::vector<std::string>& fields) {
  std::cout << request_id << "\t1\t" << (success ? "OK" : "ERR");
  for (const auto& field : fields) std::cout << '\t' << base64url_encode(field);
  std::cout << std::endl;
}

int openat2_relative(int directory_fd, const std::string& name, int flags,
                     mode_t mode, unsigned int resolve) {
  struct open_how how {};
  how.flags = static_cast<std::uint64_t>(flags);
  how.mode = static_cast<std::uint64_t>(mode);
  how.resolve = resolve;
  const int fd = static_cast<int>(
      syscall(SYS_openat2, directory_fd, name.c_str(), &how, sizeof(how)));
  if (fd < 0 && errno == ENOSYS) throw GuardError("UNSUPPORTED");
  return fd;
}

struct stat checked_stat(int fd, dev_t expected_device, bool directory,
                         bool require_single_link) {
  struct stat value {};
  if (fstat(fd, &value) != 0) throw GuardError("IO_FAILED");
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
  const char* type = S_ISDIR(value.st_mode) ? "directory" :
                     S_ISREG(value.st_mode) ? "regular" : nullptr;
  if (type == nullptr) throw GuardError("UNSAFE_ENTRY");
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
  const std::string token = "lease-" + std::to_string(next_lease++);
  leases.emplace(token, std::move(lease));
  return token;
}

Lease& require_lease(const std::string& token) {
  const auto found = leases.find(token);
  if (found == leases.end()) throw GuardError("INVALID_INPUT");
  return found->second;
}

Lease& require_root(const std::string& token) {
  Lease& lease = require_lease(token);
  if (lease.kind != LeaseKind::kRoot) throw GuardError("INVALID_INPUT");
  const struct stat value = checked_stat(lease.fd, lease.root_device, true, false);
  if (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700) {
    throw GuardError("UNSAFE_ENTRY");
  }
  return lease;
}

int open_managed_directory(int parent_fd, const std::string& name,
                           dev_t root_device) {
  const int fd = openat2_relative(
      parent_fd, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW, 0,
      kResolveManaged);
  if (fd < 0) return -1;
  try {
    const struct stat value = checked_stat(fd, root_device, true, false);
    if (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700) {
      throw GuardError("UNSAFE_ENTRY");
    }
  } catch (...) {
    close(fd);
    throw;
  }
  return fd;
}

int open_namespace(const Lease& root, const std::string& name) {
  if (name != "models" && name != "runtimes" && name != "staging" &&
      name != "quarantine" && name != "locks") {
    throw GuardError("INVALID_INPUT");
  }
  const int fd = open_managed_directory(root.fd, name, root.root_device);
  if (fd < 0) throw GuardError("IO_FAILED");
  struct stat value {};
  const auto expected = root.namespace_identities.find(name);
  if (expected == root.namespace_identities.end() || fstat(fd, &value) != 0 ||
      value.st_dev != expected->second.first || value.st_ino != expected->second.second) {
    close(fd);
    throw GuardError("IDENTITY_CHANGED");
  }
  return fd;
}

void ensure_private_directory(int parent_fd, const std::string& name,
                              dev_t expected_device) {
  if (mkdirat(parent_fd, name.c_str(), kPrivateDirectoryMode) != 0 &&
      errno != EEXIST) {
    throw GuardError("IO_FAILED");
  }
  const int fd = openat2_relative(
      parent_fd, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW, 0,
      kResolveManaged);
  if (fd < 0) throw GuardError("UNSAFE_ENTRY");
  struct stat value {};
  if (fstat(fd, &value) != 0 || value.st_dev != expected_device ||
      !S_ISDIR(value.st_mode) || value.st_uid != geteuid() ||
      (value.st_mode & 0777) != kPrivateDirectoryMode) {
    close(fd);
    throw GuardError("UNSAFE_ENTRY");
  }
  close(fd);
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
  if (components.size() < 3) throw GuardError("INVALID_INPUT");
  return components;
}

Lease initialize_root(const std::string& path) {
  const auto components = absolute_components(path);
  int current = open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC);
  if (current < 0) throw GuardError("IO_FAILED");
  int root_parent = -1;
  dev_t managed_device = 0;
  try {
    for (std::size_t index = 0; index < components.size(); ++index) {
      struct stat parent {};
      if (fstat(current, &parent) != 0) throw GuardError("IO_FAILED");
      const bool managed_component = index + 2 >= components.size();
      if (index + 1 == components.size()) {
        root_parent = dup(current);
        if (root_parent < 0) throw GuardError("IO_FAILED");
      }
      if (managed_component && managed_device == 0) managed_device = parent.st_dev;
      const unsigned int resolve = managed_component ? kResolveManaged : kResolveExternal;
      int next = openat2_relative(
          current, components[index], O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW,
          0, resolve);
      bool created = false;
      if (next < 0 && errno == ENOENT) {
        if (mkdirat(current, components[index].c_str(), kPrivateDirectoryMode) != 0) {
          throw GuardError("IO_FAILED");
        }
        created = true;
        next = openat2_relative(
            current, components[index],
            O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW, 0, resolve);
      }
      if (next < 0) throw GuardError("UNSAFE_ENTRY");
      struct stat value {};
      if (fstat(next, &value) != 0 || !S_ISDIR(value.st_mode) ||
          (managed_component && value.st_dev != managed_device)) {
        close(next);
        throw GuardError("UNSAFE_ENTRY");
      }
      if (managed_component &&
          (value.st_uid != geteuid() || (value.st_mode & 0777) != 0700)) {
        close(next);
        throw GuardError("UNSAFE_ENTRY");
      }
      if (created && fchmod(next, kPrivateDirectoryMode) != 0) {
        close(next);
        throw GuardError("IO_FAILED");
      }
      close(current);
      current = next;
    }
    struct stat root_stat {};
    if (fstat(current, &root_stat) != 0) throw GuardError("IO_FAILED");
    managed_device = root_stat.st_dev;
    std::map<std::string, std::pair<dev_t, ino_t>> namespace_identities;
    for (const char* name : {"runtimes", "models", "staging", "quarantine", "locks"}) {
      ensure_private_directory(current, name, managed_device);
      const int namespace_fd = open_managed_directory(current, name, managed_device);
      if (namespace_fd < 0) throw GuardError("IO_FAILED");
      struct stat namespace_stat {};
      if (fstat(namespace_fd, &namespace_stat) != 0) {
        close(namespace_fd);
        throw GuardError("IO_FAILED");
      }
      namespace_identities.emplace(name, std::pair{namespace_stat.st_dev, namespace_stat.st_ino});
      close(namespace_fd);
    }
    if (root_parent < 0) throw GuardError("IO_FAILED");
    return Lease{current, root_parent, LeaseKind::kRoot, components.back(), managed_device, false,
                 std::move(namespace_identities)};
  } catch (...) {
    close(current);
    if (root_parent >= 0) close(root_parent);
    throw;
  }
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
      while (buffer_length_ < 64) buffer_[buffer_length_++] = 0;
      transform();
      buffer_length_ = 0;
    }
    while (buffer_length_ < 56) buffer_[buffer_length_++] = 0;
    for (int shift = 56; shift >= 0; shift -= 8) {
      buffer_[buffer_length_++] = static_cast<unsigned char>((bit_length_ >> shift) & 0xffU);
    }
    transform();
    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (const auto value : state_) output << std::setw(8) << value;
    return output.str();
  }

 private:
  static constexpr std::array<std::uint32_t, 64> constants_ = {
      0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU,
      0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U, 0xd807aa98U, 0x12835b01U,
      0x243185beU, 0x550c7dc3U, 0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U,
      0xc19bf174U, 0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
      0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU, 0x983e5152U,
      0xa831c66dU, 0xb00327c8U, 0xbf597fc7U, 0xc6e00bf3U, 0xd5a79147U,
      0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU,
      0x53380d13U, 0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
      0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U, 0xd192e819U,
      0xd6990624U, 0xf40e3585U, 0x106aa070U, 0x19a4c116U, 0x1e376c08U,
      0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU,
      0x682e6ff3U, 0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
      0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};

  static std::uint32_t rotate(std::uint32_t value, unsigned int count) {
    return (value >> count) | (value << (32U - count));
  }

  void transform() {
    std::array<std::uint32_t, 64> words {};
    for (std::size_t index = 0; index < 16; ++index) {
      words[index] = (static_cast<std::uint32_t>(buffer_[index * 4]) << 24U) |
                     (static_cast<std::uint32_t>(buffer_[index * 4 + 1]) << 16U) |
                     (static_cast<std::uint32_t>(buffer_[index * 4 + 2]) << 8U) |
                     buffer_[index * 4 + 3];
    }
    for (std::size_t index = 16; index < 64; ++index) {
      const std::uint32_t s0 = rotate(words[index - 15], 7) ^
                               rotate(words[index - 15], 18) ^
                               (words[index - 15] >> 3U);
      const std::uint32_t s1 = rotate(words[index - 2], 17) ^
                               rotate(words[index - 2], 19) ^
                               (words[index - 2] >> 10U);
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

  std::array<unsigned char, 64> buffer_ {};
  std::size_t buffer_length_ = 0;
  std::uint64_t bit_length_ = 0;
  std::array<std::uint32_t, 8> state_ = {0x6a09e667U, 0xbb67ae85U,
                                         0x3c6ef372U, 0xa54ff53aU,
                                         0x510e527fU, 0x9b05688cU,
                                         0x1f83d9abU, 0x5be0cd19U};
};

std::string hash_file(int fd) {
  if (lseek(fd, 0, SEEK_SET) < 0) throw GuardError("IO_FAILED");
  Sha256 digest;
  std::array<unsigned char, 64 * 1024> buffer {};
  while (true) {
    const ssize_t count = read(fd, buffer.data(), buffer.size());
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) throw GuardError("IO_FAILED");
    if (count == 0) break;
    digest.update(buffer.data(), static_cast<std::size_t>(count));
  }
  return digest.finish();
}

std::optional<std::string> process_start_identity(pid_t pid) {
  const std::string path = "/proc/" + std::to_string(pid) + "/stat";
  const int fd = open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (fd < 0) {
    return errno == ENOENT || errno == ESRCH
               ? std::optional<std::string>(std::string{})
               : std::nullopt;
  }
  std::array<char, 4096> buffer {};
  const ssize_t count = read(fd, buffer.data(), buffer.size() - 1);
  close(fd);
  if (count <= 0) return std::nullopt;
  const std::string contents(buffer.data(), static_cast<std::size_t>(count));
  const std::size_t close_parenthesis = contents.rfind(')');
  if (close_parenthesis == std::string::npos || close_parenthesis + 2 >= contents.size()) {
    return std::nullopt;
  }
  const auto fields = split(contents.substr(close_parenthesis + 2), ' ');
  return fields.size() > 19 ? std::optional<std::string>(fields[19]) : std::nullopt;
}

std::vector<std::string> read_lock_metadata(int fd) {
  if (lseek(fd, 0, SEEK_SET) < 0) throw GuardError("UNSAFE_ENTRY");
  std::array<char, 2048> buffer {};
  const ssize_t count = read(fd, buffer.data(), buffer.size() - 1);
  if (count <= 0 || count >= static_cast<ssize_t>(buffer.size() - 1)) {
    throw GuardError("UNSAFE_ENTRY");
  }
  auto fields = split(std::string_view(buffer.data(), static_cast<std::size_t>(count)), '\n');
  if (!fields.empty() && fields.back().empty()) fields.pop_back();
  if (fields.size() != 5) throw GuardError("UNSAFE_ENTRY");
  return fields;
}

void write_all(int fd, std::string_view data) {
  std::size_t offset = 0;
  while (offset < data.size()) {
    const ssize_t written = write(fd, data.data() + offset, data.size() - offset);
    if (written < 0 && errno == EINTR) continue;
    if (written <= 0) throw GuardError("IO_FAILED");
    offset += static_cast<std::size_t>(written);
  }
}

std::string acquire_lock(Lease& root, const std::vector<std::string>& arguments) {
  if (arguments.size() != 7 || !is_artifact_name(arguments[1]) ||
      !is_safe_token(arguments[2], 16, 128) || !is_safe_token(arguments[4], 1, 128) ||
      !is_safe_token(arguments[5], 1, 32) || !is_safe_token(arguments[6], 1, 128)) {
    throw GuardError("INVALID_INPUT");
  }
  char* end = nullptr;
  const long pid_value = std::strtol(arguments[3].c_str(), &end, 10);
  if (end == arguments[3].c_str() || *end != '\0' || pid_value <= 0) {
    throw GuardError("INVALID_INPUT");
  }
  const std::string name = "lock-" + arguments[1];
  int locks_fd = open_namespace(root, "locks");
  for (int attempt = 0; attempt < 2; ++attempt) {
    int fd = openat(locks_fd, name.c_str(),
                    O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (fd >= 0) {
      if (fchmod(fd, 0600) != 0) {
        close(fd);
        unlinkat(locks_fd, name.c_str(), 0);
        close(locks_fd);
        throw GuardError("IO_FAILED");
      }
      checked_stat(fd, root.root_device, false, true);
      const std::string metadata = arguments[2] + "\n" + arguments[3] + "\n" +
                                   arguments[4] + "\n" + arguments[5] + "\n" +
                                   arguments[6] + "\n";
      write_all(fd, metadata);
      if (fsync(fd) != 0) throw GuardError("IO_FAILED");
      return add_lease(Lease{fd, locks_fd, LeaseKind::kLock, name,
                             root.root_device, true, {}});
    }
    if (errno != EEXIST) {
      close(locks_fd);
      throw GuardError("IO_FAILED");
    }
    fd = openat2_relative(locks_fd, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW,
                          0, kResolveManaged);
    if (fd < 0) {
      close(locks_fd);
      throw GuardError("UNSAFE_ENTRY");
    }
    const struct stat held = checked_stat(fd, root.root_device, false, true);
    const auto metadata = read_lock_metadata(fd);
    char* owner_end = nullptr;
    const long owner_pid = std::strtol(metadata[1].c_str(), &owner_end, 10);
    if (owner_end == metadata[1].c_str() || *owner_end != '\0' || owner_pid <= 0 ||
        !is_safe_token(metadata[0], 16, 128) || !is_safe_token(metadata[2], 1, 128) ||
        !is_safe_token(metadata[3], 1, 32) || !is_safe_token(metadata[4], 1, 128)) {
      close(fd);
      close(locks_fd);
      throw GuardError("UNSAFE_ENTRY");
    }
    const auto owner_identity = process_start_identity(static_cast<pid_t>(owner_pid));
    if (!owner_identity.has_value()) {
      close(fd);
      close(locks_fd);
      throw GuardError("UNSAFE_ENTRY");
    }
    if (*owner_identity == metadata[2]) {
      close(fd);
      close(locks_fd);
      throw GuardError("CONFLICT");
    }
    struct stat named {};
    if (fstatat(locks_fd, name.c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
        named.st_dev != held.st_dev || named.st_ino != held.st_ino ||
        unlinkat(locks_fd, name.c_str(), 0) != 0) {
      close(fd);
      close(locks_fd);
      throw GuardError("UNSAFE_ENTRY");
    }
    close(fd);
  }
  close(locks_fd);
  throw GuardError("CONFLICT");
}

std::vector<std::string> list_directory(Lease& lease) {
  if (lease.kind != LeaseKind::kDirectory) throw GuardError("INVALID_INPUT");
  const int duplicate = dup(lease.fd);
  if (duplicate < 0) throw GuardError("IO_FAILED");
  DIR* directory = fdopendir(duplicate);
  if (directory == nullptr) {
    close(duplicate);
    throw GuardError("IO_FAILED");
  }
  std::vector<std::string> result;
  while (true) {
    errno = 0;
    dirent* entry = readdir(directory);
    if (entry == nullptr) {
      if (errno != 0) {
        closedir(directory);
        throw GuardError("IO_FAILED");
      }
      break;
    }
    const std::string name = entry->d_name;
    if (name == "." || name == "..") continue;
    if (!is_file_name(name)) {
      closedir(directory);
      throw GuardError("UNSAFE_ENTRY");
    }
    const int fd = openat2_relative(
        lease.fd, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0, kResolveManaged);
    if (fd < 0) {
      closedir(directory);
      throw GuardError("UNSAFE_ENTRY");
    }
    checked_stat(fd, lease.root_device, false, true);
    result.push_back(name + "~" + identity_string(fd, lease.fd) + "~" + hash_file(fd));
    close(fd);
  }
  closedir(directory);
  return result;
}

std::vector<std::string> list_namespace(Lease& root, const std::string& name) {
  const int namespace_fd = open_namespace(root, name);
  const int duplicate = dup(namespace_fd);
  if (duplicate < 0) {
    close(namespace_fd);
    throw GuardError("IO_FAILED");
  }
  DIR* directory = fdopendir(duplicate);
  if (directory == nullptr) {
    close(duplicate);
    close(namespace_fd);
    throw GuardError("IO_FAILED");
  }
  std::vector<std::string> result;
  while (true) {
    errno = 0;
    dirent* entry = readdir(directory);
    if (entry == nullptr) {
      if (errno != 0) {
        closedir(directory);
        close(namespace_fd);
        throw GuardError("IO_FAILED");
      }
      break;
    }
    const std::string entry_name = entry->d_name;
    if (entry_name == "." || entry_name == "..") continue;
    int fd = -1;
    try {
      fd = open_managed_directory(namespace_fd, entry_name, root.root_device);
    } catch (const GuardError&) {
      result.push_back("unmanaged-entry");
      continue;
    }
    if (fd < 0) {
      result.push_back("unmanaged-entry");
      continue;
    }
    close(fd);
    result.push_back(entry_name);
  }
  closedir(directory);
  close(namespace_fd);
  return result;
}

std::vector<std::string> parse_request(std::string_view line,
                                       std::string& request_id,
                                       std::string& command) {
  const auto fields = split(line, '\t');
  if (fields.size() < 3 || fields[1] != "1" || !is_safe_token(fields[0], 1, 20) ||
      !is_safe_token(fields[2], 1, 32)) {
    throw GuardError("INVALID_INPUT");
  }
  request_id = fields[0];
  command = fields[2];
  std::vector<std::string> arguments;
  for (std::size_t index = 3; index < fields.size(); ++index) {
    arguments.push_back(base64url_decode(fields[index]));
  }
  return arguments;
}

std::vector<std::string> dispatch(const std::string& command,
                                  const std::vector<std::string>& arguments) {
  if (command == "PROCESS_IDENTITY") {
    if (arguments.size() != 1) throw GuardError("INVALID_INPUT");
    char* end = nullptr;
    const long pid = std::strtol(arguments[0].c_str(), &end, 10);
    if (end == arguments[0].c_str() || *end != '\0' || pid <= 0) {
      throw GuardError("INVALID_INPUT");
    }
    const auto identity = process_start_identity(static_cast<pid_t>(pid));
    if (!identity.has_value() || identity->empty()) throw GuardError("UNSAFE_ENTRY");
    return {*identity};
  }
  if (command == "INIT") {
    if (arguments.size() != 2 || arguments[0] != "linux") throw GuardError("UNSUPPORTED");
    Lease root = initialize_root(arguments[1]);
    const std::string identity = identity_string(root.fd, root.parent_fd);
    const std::string token = add_lease(std::move(root));
    return {token, identity};
  }
  if (arguments.empty()) throw GuardError("INVALID_INPUT");
  if (command == "LOCK") {
    Lease& root = require_root(arguments[0]);
    const std::string token = acquire_lock(root, arguments);
    Lease& lock = require_lease(token);
    return {token, identity_string(lock.fd, lock.parent_fd)};
  }
  if (command == "CREATE_STAGING") {
    if (arguments.size() != 4 ||
        (arguments[1] != "model" && arguments[1] != "runtime") ||
        !is_artifact_name(arguments[2]) || !is_safe_token(arguments[3], 16, 128)) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    const std::string name = "stage-" + arguments[2] + "-" + arguments[3];
    const int parent = open_namespace(root, "staging");
    if (mkdirat(parent, name.c_str(), 0700) != 0) {
      close(parent);
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    const int fd = open_managed_directory(parent, name, root.root_device);
    if (fd < 0 || fchmod(fd, 0700) != 0) {
      if (fd >= 0) close(fd);
      unlinkat(parent, name.c_str(), AT_REMOVEDIR);
      close(parent);
      throw GuardError("IO_FAILED");
    }
    const std::string token = add_lease(
        Lease{fd, parent, LeaseKind::kDirectory, name, root.root_device, false, {}});
    return {token, identity_string(fd, parent)};
  }
  if (command == "CREATE_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    if (directory.kind != LeaseKind::kDirectory) throw GuardError("INVALID_INPUT");
    char* end = nullptr;
    const long mode_value = std::strtol(arguments[2].c_str(), &end, 10);
    if (end == arguments[2].c_str() || *end != '\0' || mode_value < 0 ||
        mode_value > 0777 || (mode_value & kPrivateFileModeMask) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    const int fd = openat(directory.fd, arguments[1].c_str(),
                          O_RDWR | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW,
                          static_cast<mode_t>(mode_value));
    if (fd < 0) throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    if (fchmod(fd, static_cast<mode_t>(mode_value)) != 0) {
      close(fd);
      unlinkat(directory.fd, arguments[1].c_str(), 0);
      throw GuardError("IO_FAILED");
    }
    checked_stat(fd, directory.root_device, false, true);
    const int parent = dup(directory.fd);
    if (parent < 0) {
      close(fd);
      throw GuardError("IO_FAILED");
    }
    const std::string token = add_lease(
        Lease{fd, parent, LeaseKind::kFile, arguments[1], directory.root_device, false, {}});
    return {token, identity_string(fd, parent)};
  }
  if (command == "WRITE_FILE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& file = require_lease(arguments[0]);
    if (file.kind != LeaseKind::kFile) throw GuardError("INVALID_INPUT");
    const std::string bytes = base64url_decode(arguments[1]);
    write_all(file.fd, bytes);
    return {};
  }
  if (command == "SEAL_FILE") {
    if (arguments.size() != 1) throw GuardError("INVALID_INPUT");
    Lease& file = require_lease(arguments[0]);
    if (file.kind != LeaseKind::kFile || fsync(file.fd) != 0) throw GuardError("IO_FAILED");
    checked_stat(file.fd, file.root_device, false, true);
    return {identity_string(file.fd, file.parent_fd)};
  }
  if (command == "LIST") {
    if (arguments.empty()) throw GuardError("INVALID_INPUT");
    for (std::size_t index = 1; index < arguments.size(); ++index) {
      const auto expected = split(arguments[index], '|');
      if (expected.size() != 2 || !is_file_name(expected[0])) {
        throw GuardError("INVALID_INPUT");
      }
    }
    return list_directory(require_lease(arguments[0]));
  }
  if (command == "LIST_NAMESPACE") {
    if (arguments.size() != 2 || (arguments[1] != "models" && arguments[1] != "runtimes")) {
      throw GuardError("INVALID_INPUT");
    }
    return list_namespace(require_root(arguments[0]), arguments[1]);
  }
  if (command == "OPEN_ARTIFACT") {
    if (arguments.size() != 3 ||
        (arguments[1] != "models" && arguments[1] != "runtimes") ||
        !is_artifact_name(arguments[2])) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    const int parent = open_namespace(root, arguments[1]);
    const int fd = open_managed_directory(parent, arguments[2], root.root_device);
    if (fd < 0 && errno == ENOENT) {
      close(parent);
      return {"MISSING"};
    }
    if (fd < 0) {
      close(parent);
      throw GuardError("UNSAFE_ENTRY");
    }
    const std::string token = add_lease(
        Lease{fd, parent, LeaseKind::kDirectory, arguments[2], root.root_device, false, {}});
    return {token, identity_string(fd, parent)};
  }
  if (command == "PROMOTE") {
    if (arguments.size() != 4 ||
        (arguments[2] != "models" && arguments[2] != "runtimes") ||
        !is_artifact_name(arguments[3])) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    Lease& staging = require_lease(arguments[1]);
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
    const int final_parent = open_namespace(root, arguments[2]);
    if (syscall(SYS_renameat2, staging.parent_fd, staging.name.c_str(), final_parent,
                arguments[3].c_str(), RENAME_NOREPLACE) != 0) {
      close(final_parent);
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    const std::string result = identity_string(staging.fd, final_parent);
    close(final_parent);
    return {result};
  }
  if (command == "QUARANTINE") {
    if (arguments.size() != 5 ||
        (arguments[2] != "models" && arguments[2] != "runtimes") ||
        !is_artifact_name(arguments[3]) || !is_safe_token(arguments[4], 16, 128)) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    Lease& artifact = require_lease(arguments[1]);
    if (artifact.kind != LeaseKind::kDirectory || artifact.name != arguments[3] ||
        artifact.root_device != root.root_device) {
      throw GuardError("IDENTITY_CHANGED");
    }
    const int source_parent = open_namespace(root, arguments[2]);
    struct stat named {};
    struct stat held {};
    if (fstat(artifact.fd, &held) != 0 ||
        fstatat(source_parent, arguments[3].c_str(), &named, AT_SYMLINK_NOFOLLOW) != 0 ||
        held.st_dev != named.st_dev || held.st_ino != named.st_ino) {
      close(source_parent);
      throw GuardError("IDENTITY_CHANGED");
    }
    const int quarantine_parent = open_namespace(root, "quarantine");
    const std::string quarantine_name = "quarantine-" + arguments[3] + "-" + arguments[4];
    if (syscall(SYS_renameat2, source_parent, arguments[3].c_str(), quarantine_parent,
                quarantine_name.c_str(), RENAME_NOREPLACE) != 0) {
      close(source_parent);
      close(quarantine_parent);
      throw GuardError(errno == EEXIST ? "CONFLICT" : "IO_FAILED");
    }
    close(source_parent);
    const int duplicate = dup(artifact.fd);
    if (duplicate < 0) {
      close(quarantine_parent);
      throw GuardError("IO_FAILED");
    }
    const std::string token = add_lease(Lease{duplicate, quarantine_parent,
        LeaseKind::kDirectory, quarantine_name, root.root_device, false, {}});
    return {token, identity_string(duplicate, quarantine_parent)};
  }
  if (command == "DELETE_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    const int fd = openat2_relative(directory.fd, arguments[1],
                                    O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0,
                                    kResolveManaged);
    if (fd < 0) throw GuardError("IDENTITY_CHANGED");
    checked_stat(fd, directory.root_device, false, true);
    const std::string current = identity_string(fd, directory.fd);
    close(fd);
    if (current != arguments[2]) throw GuardError("IDENTITY_CHANGED");
    if (unlinkat(directory.fd, arguments[1].c_str(), 0) != 0) throw GuardError("IO_FAILED");
    return {};
  }
  if (command == "DELETE_STAGING_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    const int fd = openat2_relative(directory.fd, arguments[1],
                                    O_RDONLY | O_CLOEXEC | O_NOFOLLOW, 0,
                                    kResolveManaged);
    if (fd < 0) throw GuardError("IDENTITY_CHANGED");
    checked_stat(fd, directory.root_device, false, true);
    const std::string current = identity_string(fd, directory.fd);
    close(fd);
    if (current != arguments[2]) throw GuardError("IDENTITY_CHANGED");
    if (unlinkat(directory.fd, arguments[1].c_str(), 0) != 0) throw GuardError("IO_FAILED");
    return {};
  }
  if (command == "REMOVE_QUARANTINE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& root = require_root(arguments[0]);
    Lease& directory = require_lease(arguments[1]);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("quarantine-", 0) != 0 ||
        directory.root_device != root.root_device) {
      throw GuardError("INVALID_INPUT");
    }
    if (!list_directory(directory).empty()) throw GuardError("UNSAFE_ENTRY");
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
  if (command == "REMOVE_STAGING") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& root = require_root(arguments[0]);
    Lease& directory = require_lease(arguments[1]);
    if (directory.kind != LeaseKind::kDirectory || directory.name.rfind("stage-", 0) != 0 ||
        directory.root_device != root.root_device) {
      throw GuardError("INVALID_INPUT");
    }
    if (!list_directory(directory).empty()) throw GuardError("UNSAFE_ENTRY");
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
  if (command == "REVALIDATE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& lease = require_lease(arguments[0]);
    const auto expected = split(arguments[1], '|');
    const auto current = split(identity_string(lease.fd, lease.parent_fd), '|');
    if (expected.size() != 7 || current.size() != 7) throw GuardError("INVALID_INPUT");
    const bool directory = current[6] == "directory";
    for (std::size_t index = 0; index < current.size(); ++index) {
      if (directory && index == 5) continue;
      if (current[index] != expected[index]) throw GuardError("IDENTITY_CHANGED");
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
  if (command == "RELEASE") {
    if (arguments.size() != 1) throw GuardError("INVALID_INPUT");
    const auto found = leases.find(arguments[0]);
    if (found == leases.end()) return {};
    close_lease(found->second);
    leases.erase(found);
    return {};
  }
  throw GuardError("INVALID_INPUT");
}

}  // namespace

int main() {
  std::ios::sync_with_stdio(false);
  std::string line;
  while (std::getline(std::cin, line)) {
    std::string request_id = "0";
    try {
      if (line.size() > kMaxLineBytes) throw GuardError("INVALID_INPUT");
      std::string command;
      const auto arguments = parse_request(line, request_id, command);
      respond(request_id, true, dispatch(command, arguments));
    } catch (const GuardError& error) {
      respond(request_id, false, {error.code()});
    } catch (...) {
      respond(request_id, false, {"IO_FAILED"});
    }
  }
  for (auto& [token, lease] : leases) close_lease(lease);
  leases.clear();
  return 0;
}

#endif
