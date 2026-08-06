#define NOMINMAX

#ifdef _WIN32
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

#include <array>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace {

#ifdef _WIN32

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE value = INVALID_HANDLE_VALUE) noexcept : value_(value) {}
  ~UniqueHandle() noexcept {
    if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE)
      CloseHandle(value_);
  }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept
      : value_(std::exchange(other.value_, INVALID_HANDLE_VALUE)) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) {
      if (valid())
        CloseHandle(value_);
      value_ = std::exchange(other.value_, INVALID_HANDLE_VALUE);
    }
    return *this;
  }
  [[nodiscard]] HANDLE get() const noexcept { return value_; }
  [[nodiscard]] bool valid() const noexcept {
    return value_ != nullptr && value_ != INVALID_HANDLE_VALUE;
  }

private:
  HANDLE value_;
};

std::wstring utf8_to_wide(const std::string& value) {
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                         static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0)
    throw std::runtime_error("fixture path encoding invalid");
  std::wstring result(static_cast<std::size_t>(length), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), length) != length) {
    throw std::runtime_error("fixture path encoding invalid");
  }
  return result;
}

std::string file_id_hex(const FILE_ID_128& value) {
  std::ostringstream output;
  output << std::hex << std::setfill('0');
  for (const unsigned char byte : value.Identifier)
    output << std::setw(2) << static_cast<unsigned int>(byte);
  return output.str();
}

struct Identity final {
  std::uint64_t volume = 0;
  std::string file_id;
  std::uint64_t links = 0;
  std::uint64_t size = 0;
  bool directory = false;
};

Identity identity(HANDLE handle) {
  FILE_ID_INFO id{};
  FILE_STANDARD_INFO standard{};
  FILE_ATTRIBUTE_TAG_INFO attributes{};
  if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) ||
      !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes,
                                    sizeof(attributes)) ||
      (attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
      attributes.ReparseTag != 0 || standard.NumberOfLinks != 1 ||
      standard.EndOfFile.QuadPart < 0) {
    throw std::runtime_error("fixture identity unavailable");
  }
  return Identity{id.VolumeSerialNumber, file_id_hex(id.FileId), standard.NumberOfLinks,
                  static_cast<std::uint64_t>(standard.EndOfFile.QuadPart),
                  standard.Directory != FALSE};
}

UniqueHandle open_path(const std::string& path, bool directory) {
  const std::wstring wide = utf8_to_wide(path);
  const DWORD flags = FILE_FLAG_OPEN_REPARSE_POINT | (directory ? FILE_FLAG_BACKUP_SEMANTICS : 0);
  UniqueHandle handle(CreateFileW(wide.c_str(), GENERIC_READ | FILE_READ_ATTRIBUTES,
                                  FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
                                  OPEN_EXISTING, flags, nullptr));
  if (!handle.valid())
    throw std::runtime_error("fixture path open failed");
  return handle;
}

std::string path_identity(const std::string& path, std::uint32_t mode) {
  const bool directory = mode == 0700U;
  UniqueHandle handle = open_path(path, directory);
  UniqueHandle parent = open_path(std::filesystem::path(path).parent_path().string(), true);
  const Identity value = identity(handle.get());
  const Identity parent_value = identity(parent.get());
  std::ostringstream output;
  output << value.volume << '\t' << value.file_id << '\t' << value.links << '\t' << mode << '\t'
         << parent_value.file_id << '\t' << value.size << '\t'
         << (value.directory ? "directory" : "regular");
  return output.str();
}

std::string process_identity(std::uint64_t pid) {
  UniqueHandle process(
      OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, static_cast<DWORD>(pid)));
  if (!process.valid())
    throw std::runtime_error("fixture process unavailable");
  FILETIME creation{}, exit{}, kernel{}, user{};
  if (!GetProcessTimes(process.get(), &creation, &exit, &kernel, &user))
    throw std::runtime_error("fixture process identity unavailable");
  return std::to_string(creation.dwHighDateTime) + "-" + std::to_string(creation.dwLowDateTime);
}

#else

std::string path_identity(const std::string& path, std::uint32_t) {
  struct stat value {};
  struct stat parent {};
  if (lstat(path.c_str(), &value) != 0 ||
      lstat(std::filesystem::path(path).parent_path().c_str(), &parent) != 0 ||
      (!S_ISDIR(value.st_mode) && !S_ISREG(value.st_mode)) || S_ISLNK(value.st_mode)) {
    throw std::runtime_error("fixture identity unavailable");
  }
  std::ostringstream output;
  output << static_cast<std::uint64_t>(value.st_dev) << '\t'
         << static_cast<std::uint64_t>(value.st_ino) << '\t'
         << static_cast<std::uint64_t>(value.st_nlink) << '\t'
         << static_cast<std::uint32_t>(value.st_mode & 0777U) << '\t'
         << static_cast<std::uint64_t>(parent.st_ino) << '\t'
         << static_cast<std::uint64_t>(value.st_size) << '\t'
         << (S_ISDIR(value.st_mode) ? "directory" : "regular");
  return output.str();
}

std::string process_identity(std::uint64_t pid) {
  std::ifstream input("/proc/" + std::to_string(pid) + "/stat", std::ios::binary);
  std::string contents;
  std::getline(input, contents);
  const std::size_t close_parenthesis = contents.rfind(')');
  if (contents.empty() || close_parenthesis == std::string::npos ||
      close_parenthesis + 2 >= contents.size()) {
    throw std::runtime_error("fixture process identity unavailable");
  }
  std::istringstream fields(contents.substr(close_parenthesis + 2));
  std::string value;
  for (std::size_t index = 0; index <= 19; ++index) {
    if (!(fields >> value))
      throw std::runtime_error("fixture process identity unavailable");
  }
  return value;
}

#endif

std::uint64_t parse_pid(std::string_view value) {
  std::uint64_t pid = 0;
  for (const char character : value) {
    if (character < '0' || character > '9')
      throw std::runtime_error("fixture pid invalid");
    pid = pid * 10U + static_cast<unsigned int>(character - '0');
  }
  if (pid == 0)
    throw std::runtime_error("fixture pid invalid");
  return pid;
}

} // namespace

int main(int argc, char** argv) {
  try {
    if (argc == 4 && std::string_view(argv[1]) == "--paths") {
      std::cout << path_identity(argv[2], 0700U) << '\n' << path_identity(argv[3], 0U) << '\n';
      return 0;
    }
    if (argc == 3 && std::string_view(argv[1]) == "--model") {
      std::cout << path_identity(argv[2], 0600U) << '\n';
      return 0;
    }
    if (argc == 3 && std::string_view(argv[1]) == "--process") {
      std::cout << process_identity(parse_pid(argv[2])) << '\n';
      return 0;
    }
    return 2;
  } catch (...) {
    return 10;
  }
}
