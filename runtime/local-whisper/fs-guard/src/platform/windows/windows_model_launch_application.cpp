#include "platform/windows/windows_model_launch_application.hpp"

#ifdef _WIN32

#include "local_whisper/common/model_authority.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/common/windows_process_identity.hpp"
#include "local_whisper/fs_guard/model_launch_request.hpp"
#include "local_whisper/fs_guard/protocol.hpp"
#include "local_whisper/fs_guard/windows_model_authority_server.hpp"

#define NOMINMAX
#include <windows.h>

#include <io.h>

#include <algorithm>
#include <array>
#include <charconv>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cwctype>
#include <iomanip>
#include <span>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

constexpr DWORD kDirectoryAccess = FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
constexpr DWORD kFileAccess = GENERIC_READ | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
constexpr DWORD kGuardCompatibleShareMode = FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;
constexpr auto kPollInterval = std::chrono::milliseconds(50);
constexpr std::size_t kMaximumBootstrapBytes = 64U * 1024U;

class UniqueHandle final {
public:
  explicit UniqueHandle(HANDLE value = INVALID_HANDLE_VALUE) noexcept : value_(value) {}
  ~UniqueHandle() noexcept { reset(); }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : value_(other.release()) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }
  [[nodiscard]] HANDLE get() const noexcept { return value_; }
  [[nodiscard]] bool valid() const noexcept {
    return value_ != nullptr && value_ != INVALID_HANDLE_VALUE;
  }
  [[nodiscard]] HANDLE release() noexcept { return std::exchange(value_, INVALID_HANDLE_VALUE); }
  void reset(HANDLE value = INVALID_HANDLE_VALUE) noexcept {
    if (valid())
      static_cast<void>(CloseHandle(value_));
    value_ = value;
  }

private:
  HANDLE value_;
};

class AttributeList final {
public:
  explicit AttributeList(std::span<const HANDLE> handles) {
    SIZE_T bytes = 0;
    static_cast<void>(InitializeProcThreadAttributeList(nullptr, 1, 0, &bytes));
    if (bytes == 0U)
      throw std::runtime_error("model launch attribute sizing failed");
    storage_.resize(bytes);
    list_ = reinterpret_cast<PPROC_THREAD_ATTRIBUTE_LIST>(storage_.data());
    if (!InitializeProcThreadAttributeList(list_, 1, 0, &bytes) ||
        !UpdateProcThreadAttribute(list_, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                   const_cast<HANDLE*>(handles.data()), handles.size_bytes(),
                                   nullptr, nullptr)) {
      throw std::runtime_error("model launch attribute setup failed");
    }
  }
  ~AttributeList() noexcept {
    if (list_ != nullptr)
      DeleteProcThreadAttributeList(list_);
  }
  AttributeList(const AttributeList&) = delete;
  AttributeList& operator=(const AttributeList&) = delete;
  [[nodiscard]] PPROC_THREAD_ATTRIBUTE_LIST get() const noexcept { return list_; }

private:
  std::vector<unsigned char> storage_;
  PPROC_THREAD_ATTRIBUTE_LIST list_ = nullptr;
};

struct PipePair final {
  UniqueHandle read;
  UniqueHandle write;
};

struct ParsedPath final {
  wchar_t drive = L'\0';
  std::vector<std::wstring> components;
};

struct StableIdentity final {
  std::uint64_t volume = 0;
  std::string file_id;
  std::uint64_t links = 0;
  std::uint64_t size = 0;
  bool directory = false;
};

struct HeldFile final {
  std::vector<UniqueHandle> parents;
  UniqueHandle file;
  StableIdentity parent_identity;
  StableIdentity file_identity;
  std::wstring absolute_path;
};

HANDLE descriptor_handle(int descriptor) {
  const intptr_t value = _get_osfhandle(descriptor);
  if (value == -1)
    throw std::runtime_error("model launch descriptor invalid");
  return reinterpret_cast<HANDLE>(value);
}

UniqueHandle duplicate_inheritable_descriptor(int descriptor) {
  HANDLE duplicate = INVALID_HANDLE_VALUE;
  if (!DuplicateHandle(GetCurrentProcess(), descriptor_handle(descriptor), GetCurrentProcess(),
                       &duplicate, 0, TRUE, DUPLICATE_SAME_ACCESS)) {
    throw std::runtime_error("model launch descriptor duplication failed");
  }
  return UniqueHandle(duplicate);
}

PipePair create_pipe() {
  SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
  HANDLE read = INVALID_HANDLE_VALUE;
  HANDLE write = INVALID_HANDLE_VALUE;
  if (!CreatePipe(&read, &write, &security, 0))
    throw std::runtime_error("model launch pipe creation failed");
  PipePair pipe{UniqueHandle(read), UniqueHandle(write)};
  if (!SetHandleInformation(pipe.write.get(), HANDLE_FLAG_INHERIT, 0))
    throw std::runtime_error("model launch pipe inheritance failed");
  return pipe;
}

std::wstring utf8_to_wide(const std::string& value) {
  if (value.empty())
    throw std::runtime_error("model launch path empty");
  const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                        static_cast<int>(value.size()), nullptr, 0);
  if (count <= 0)
    throw std::runtime_error("model launch path encoding invalid");
  std::wstring result(static_cast<std::size_t>(count), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), count) != count) {
    throw std::runtime_error("model launch path encoding invalid");
  }
  return result;
}

ParsedPath parse_absolute_path(const std::wstring& path) {
  if (path.size() < 4U || std::iswalpha(path[0]) == 0 || path[1] != L':' ||
      (path[2] != L'\\' && path[2] != L'/') || path.back() == L'\\' || path.back() == L'/') {
    throw std::runtime_error("model launch path invalid");
  }
  ParsedPath result;
  result.drive = static_cast<wchar_t>(std::towupper(path[0]));
  std::size_t start = 3U;
  while (start < path.size()) {
    const std::size_t end = path.find_first_of(L"\\/", start);
    const auto component =
        path.substr(start, end == std::wstring::npos ? path.size() - start : end - start);
    if (component.empty() || component == L"." || component == L".." ||
        component.find(L':') != std::wstring::npos || component.back() == L'.' ||
        component.back() == L' ') {
      throw std::runtime_error("model launch path invalid");
    }
    result.components.push_back(component);
    if (end == std::wstring::npos)
      break;
    start = end + 1U;
  }
  if (result.components.size() < 2U)
    throw std::runtime_error("model launch path invalid");
  return result;
}

std::wstring extended_path(const ParsedPath& path, std::size_t count) {
  std::wstring value = L"\\\\?\\";
  value.push_back(path.drive);
  value += L":\\";
  for (std::size_t index = 0; index < count; ++index) {
    if (index != 0U)
      value.push_back(L'\\');
    value += path.components.at(index);
  }
  return value;
}

std::string file_id_hex(const FILE_ID_128& value) {
  std::ostringstream output;
  output << std::hex << std::setfill('0');
  for (const unsigned char byte : value.Identifier)
    output << std::setw(2) << static_cast<unsigned int>(byte);
  return output.str();
}

void reject_alternate_streams(HANDLE handle) {
  std::array<unsigned char, 64U * 1024U> storage{};
  if (!GetFileInformationByHandleEx(handle, FileStreamInfo, storage.data(),
                                    static_cast<DWORD>(storage.size()))) {
    throw std::runtime_error("model launch stream identity failed");
  }
  std::size_t offset = 0;
  std::size_t count = 0;
  while (true) {
    const auto* stream = reinterpret_cast<const FILE_STREAM_INFO*>(storage.data() + offset);
    const std::wstring name(stream->StreamName, stream->StreamNameLength / sizeof(wchar_t));
    ++count;
    if (name != L"::$DATA")
      throw std::runtime_error("model launch alternate stream rejected");
    if (stream->NextEntryOffset == 0U)
      break;
    offset += stream->NextEntryOffset;
    if (offset >= storage.size())
      throw std::runtime_error("model launch stream identity invalid");
  }
  if (count != 1U)
    throw std::runtime_error("model launch stream identity invalid");
}

StableIdentity stable_identity(HANDLE handle) {
  FILE_ID_INFO id{};
  FILE_STANDARD_INFO standard{};
  FILE_ATTRIBUTE_TAG_INFO attributes{};
  if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) ||
      !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes,
                                    sizeof(attributes))) {
    throw std::runtime_error("model launch identity read failed");
  }
  if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0U ||
      attributes.ReparseTag != 0U || standard.NumberOfLinks != 1U ||
      standard.EndOfFile.QuadPart < 0) {
    throw std::runtime_error("model launch unsafe identity");
  }
  if (standard.Directory == FALSE)
    reject_alternate_streams(handle);
  return StableIdentity{id.VolumeSerialNumber, file_id_hex(id.FileId), standard.NumberOfLinks,
                        static_cast<std::uint64_t>(standard.EndOfFile.QuadPart),
                        standard.Directory != FALSE};
}

HeldFile open_held_regular_file(const std::string& path) {
  const ParsedPath parsed = parse_absolute_path(utf8_to_wide(path));
  std::vector<UniqueHandle> parents;
  parents.reserve(parsed.components.size());
  for (std::size_t count = 0; count < parsed.components.size(); ++count) {
    const auto current = extended_path(parsed, count);
    parents.emplace_back(CreateFileW(
        current.c_str(), kDirectoryAccess, kGuardCompatibleShareMode, nullptr, OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    if (!parents.back().valid() || !stable_identity(parents.back().get()).directory)
      throw std::runtime_error("model launch directory open failed");
  }
  const auto absolute = extended_path(parsed, parsed.components.size());
  UniqueHandle file(CreateFileW(absolute.c_str(), kFileAccess, kGuardCompatibleShareMode, nullptr,
                                OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  if (!file.valid())
    throw std::runtime_error("model launch file open failed");
  const StableIdentity parent_identity = stable_identity(parents.back().get());
  const StableIdentity file_identity = stable_identity(file.get());
  if (file_identity.directory)
    throw std::runtime_error("model launch file type invalid");
  return HeldFile{std::move(parents), std::move(file), parent_identity, file_identity, absolute};
}

std::string hash_handle(HANDLE handle, std::uint64_t expected_bytes) {
  LARGE_INTEGER beginning{};
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
    throw std::runtime_error("model launch seek failed");
  local_whisper::common::Sha256 digest;
  std::array<std::uint8_t, 64U * 1024U> buffer{};
  std::uint64_t consumed = 0;
  while (consumed < expected_bytes) {
    const DWORD requested =
        static_cast<DWORD>(std::min<std::uint64_t>(buffer.size(), expected_bytes - consumed));
    DWORD count = 0;
    if (!ReadFile(handle, buffer.data(), requested, &count, nullptr) || count == 0U)
      throw std::runtime_error("model launch hash read failed");
    digest.update(std::span<const std::uint8_t>(buffer.data(), count));
    consumed += count;
  }
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
    throw std::runtime_error("model launch seek failed");
  return local_whisper::common::to_lower_hex(digest.finish());
}

void validate_model_identity(const HeldFile& model, const ModelLaunchRequest& request) {
  const auto& expected = request.model_identity;
  if (std::to_string(model.file_identity.volume) != expected.device_id ||
      model.file_identity.file_id != expected.file_id ||
      model.file_identity.links != expected.link_count || expected.mode != 0600U ||
      model.parent_identity.file_id != expected.parent_file_id ||
      model.file_identity.size != request.model_size_bytes) {
    throw std::runtime_error("model launch identity changed");
  }
}

template <std::size_t Size> std::array<std::uint8_t, Size> parse_hex(const std::string& value) {
  if (value.size() != Size * 2U)
    throw std::runtime_error("model launch digest invalid");
  std::array<std::uint8_t, Size> output{};
  for (std::size_t index = 0; index < Size; ++index) {
    unsigned int byte = 0;
    const char* begin = value.data() + index * 2U;
    const auto parsed = std::from_chars(begin, begin + 2, byte, 16);
    if (parsed.ec != std::errc{} || parsed.ptr != begin + 2 || byte > 0xffU)
      throw std::runtime_error("model launch digest invalid");
    output[index] = static_cast<std::uint8_t>(byte);
  }
  return output;
}

std::string read_bootstrap_line(int descriptor) {
  std::string line;
  std::array<char, 1024> buffer{};
  while (line.size() <= kMaximumBootstrapBytes) {
    const int count = _read(descriptor, buffer.data(), static_cast<unsigned int>(buffer.size()));
    if (count <= 0)
      throw std::runtime_error("model launch control closed");
    const auto end = std::find(buffer.begin(), buffer.begin() + count, '\n');
    line.append(buffer.begin(), end);
    if (end != buffer.begin() + count) {
      if (end + 1 != buffer.begin() + count)
        throw std::runtime_error("model launch trailing bootstrap bytes");
      return line;
    }
  }
  throw std::runtime_error("model launch bootstrap exceeded");
}

void write_exact(HANDLE handle, std::span<const std::uint8_t> bytes) {
  while (!bytes.empty()) {
    DWORD count = 0;
    if (!WriteFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()), &count, nullptr) ||
        count == 0U) {
      throw std::runtime_error("model launch write failed");
    }
    bytes = bytes.subspan(count);
  }
}

local_whisper::common::AuthorityBinding binding_for(const ModelLaunchRequest& request,
                                                    HANDLE launcher_process, DWORD launcher_pid) {
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
  binding.expected_launcher_pid = launcher_pid;
  binding.expected_guard_pid = GetCurrentProcessId();
  binding.expected_launcher_start_identity_sha256 =
      local_whisper::common::windows_process_start_identity_sha256(launcher_process);
  binding.expected_guard_start_identity_sha256 =
      local_whisper::common::windows_process_start_identity_sha256(GetCurrentProcess());
  return binding;
}

bool owner_control_closed(int descriptor) {
  DWORD available = 0;
  if (!PeekNamedPipe(descriptor_handle(descriptor), nullptr, 0, nullptr, &available, nullptr))
    return true;
  return available != 0U;
}

int wait_for_launcher(HANDLE job, HANDLE launcher, int owner_control) {
  bool terminated = false;
  bool control_open = true;
  while (true) {
    if (WaitForSingleObject(launcher, 0) == WAIT_OBJECT_0) {
      DWORD exit_code = 1;
      return GetExitCodeProcess(launcher, &exit_code) ? static_cast<int>(exit_code) : 1;
    }
    const bool control_closed = control_open && owner_control_closed(owner_control);
    if (control_closed) {
      control_open = false;
      static_cast<void>(_close(owner_control));
    }
    if (!terminated && control_closed) {
      terminated = true;
      if (!TerminateJobObject(job, 1))
        throw std::runtime_error("model launch job termination failed");
    }
    std::this_thread::sleep_for(kPollInterval);
  }
}

std::wstring handle_argument(const wchar_t* name, HANDLE handle) {
  return std::wstring(name) +
         std::to_wstring(static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(handle)));
}

} // namespace

int run_windows_model_launch(int control_descriptor, int acknowledgment_descriptor) {
  const ModelLaunchRequest request =
      ModelLaunchRequestParser{}.parse(read_bootstrap_line(control_descriptor));
  HeldFile launcher = open_held_regular_file(request.launcher_path);
  if (hash_handle(launcher.file.get(), launcher.file_identity.size) != request.launcher_sha256)
    throw std::runtime_error("model launch launcher identity changed");
  HeldFile model = open_held_regular_file(request.model_path);
  validate_model_identity(model, request);
  if (hash_handle(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw std::runtime_error("model launch model digest changed");

  PipePair launcher_control = create_pipe();
  PipePair launcher_authority = create_pipe();
  std::array<UniqueHandle, 4> inherited_descriptors = {
      duplicate_inheritable_descriptor(0), duplicate_inheritable_descriptor(1),
      duplicate_inheritable_descriptor(2),
      duplicate_inheritable_descriptor(acknowledgment_descriptor)};
  const std::array<HANDLE, 6> inherited = {
      inherited_descriptors[0].get(), inherited_descriptors[1].get(),
      inherited_descriptors[2].get(), inherited_descriptors[3].get(),
      launcher_control.read.get(),    launcher_authority.read.get()};
  AttributeList attributes(inherited);
  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = inherited[0];
  startup.StartupInfo.hStdOutput = inherited[1];
  startup.StartupInfo.hStdError = inherited[2];
  startup.lpAttributeList = attributes.get();

  std::wstring command_line = L"local-whisper-launcher --local-whisper-launcher-v2 ";
  command_line += handle_argument(L"--control-handle=", launcher_control.read.get()) + L" ";
  command_line += handle_argument(L"--ack-handle=", inherited_descriptors[3].get()) + L" ";
  command_line += handle_argument(L"--authority-handle=", launcher_authority.read.get());
  PROCESS_INFORMATION information{};
  const DWORD flags = CREATE_NO_WINDOW | CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT;
  if (!CreateProcessW(launcher.absolute_path.c_str(), command_line.data(), nullptr, nullptr, TRUE,
                      flags, nullptr, nullptr, &startup.StartupInfo, &information)) {
    throw std::runtime_error("model launch launcher creation failed");
  }
  UniqueHandle launcher_process(information.hProcess);
  UniqueHandle launcher_thread(information.hThread);
  launcher_control.read.reset();
  launcher_authority.read.reset();
  for (auto& handle : inherited_descriptors)
    handle.reset();
  static_cast<void>(_close(acknowledgment_descriptor));

  UniqueHandle job(CreateJobObjectW(nullptr, nullptr));
  if (!job.valid())
    throw std::runtime_error("model launch job creation failed");
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(job.get(), JobObjectExtendedLimitInformation, &limits,
                               sizeof(limits)) ||
      !AssignProcessToJobObject(job.get(), launcher_process.get())) {
    static_cast<void>(TerminateProcess(launcher_process.get(), 1));
    throw std::runtime_error("model launch job assignment failed");
  }

  try {
    const auto binding = binding_for(request, launcher_process.get(), information.dwProcessId);
    const auto authority_request = local_whisper::common::encode_authority_record(
        local_whisper::common::AuthorityRequest{binding});
    const std::string encoded_request(reinterpret_cast<const char*>(authority_request.data()),
                                      authority_request.size());
    const std::string launcher_bootstrap = request.launcher_bootstrap + '\t' +
                                           base64url_encode(encoded_request) + '\t' +
                                           std::to_string(request.worker_bootstrap_bytes) + '\n';
    write_exact(launcher_control.write.get(),
                std::span<const std::uint8_t>(
                    reinterpret_cast<const std::uint8_t*>(launcher_bootstrap.data()),
                    launcher_bootstrap.size()));
    const auto launcher_transfer = WindowsModelAuthorityServer::duplicate_to_launcher(
        model.file.get(), launcher_process.get(), binding);
    const auto transfer_bytes = local_whisper::common::encode_authority_record(launcher_transfer);
    write_exact(launcher_authority.write.get(), transfer_bytes);
    launcher_authority.write.reset();
    if (ResumeThread(launcher_thread.get()) == static_cast<DWORD>(-1))
      throw std::runtime_error("model launch launcher resume failed");
    launcher_thread.reset();
    return wait_for_launcher(job.get(), launcher_process.get(), control_descriptor);
  } catch (...) {
    static_cast<void>(TerminateJobObject(job.get(), 1));
    throw;
  }
}

} // namespace local_whisper::fs_guard

#endif
