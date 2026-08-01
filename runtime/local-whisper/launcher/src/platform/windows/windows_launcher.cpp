#include "local_whisper/launcher/platform_launcher.hpp"

#include "local_whisper/launcher/sha256.hpp"

#define NOMINMAX
#include <windows.h>

#include <io.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <cwctype>
#include <filesystem>
#include <iomanip>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace local_whisper::launcher {
namespace {

constexpr auto kPollInterval = std::chrono::milliseconds(50);
constexpr DWORD kDirectoryAccess = FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
constexpr DWORD kWorkerAccess = GENERIC_READ | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
constexpr DWORD kLockedShareMode = FILE_SHARE_READ | FILE_SHARE_WRITE;

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
  explicit AttributeList(const std::array<HANDLE, 3>& inherited_handles) {
    SIZE_T byte_count = 0;
    static_cast<void>(InitializeProcThreadAttributeList(nullptr, 1, 0, &byte_count));
    if (byte_count == 0)
      throw std::runtime_error("launcher attribute sizing failed");
    storage_.resize(byte_count);
    list_ = reinterpret_cast<PPROC_THREAD_ATTRIBUTE_LIST>(storage_.data());
    if (!InitializeProcThreadAttributeList(list_, 1, 0, &byte_count) ||
        !UpdateProcThreadAttribute(list_, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                   const_cast<HANDLE*>(inherited_handles.data()),
                                   sizeof(inherited_handles), nullptr, nullptr)) {
      throw std::runtime_error("launcher attribute setup failed");
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

struct StableIdentity final {
  std::uint64_t volume = 0;
  std::string file_id;
  std::uint64_t links = 0;
  std::uint64_t size = 0;
  bool directory = false;
};

struct ParsedPath final {
  wchar_t drive = L'\0';
  std::vector<std::wstring> components;
};

std::wstring utf8_to_wide(const std::string& value) {
  if (value.empty())
    throw std::runtime_error("launcher path empty");
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                         static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0)
    throw std::runtime_error("launcher path encoding invalid");
  std::wstring result(static_cast<std::size_t>(length), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), length) != length) {
    throw std::runtime_error("launcher path encoding invalid");
  }
  return result;
}

ParsedPath parse_absolute_path(const std::wstring& path) {
  if (path.size() < 4 || std::iswalpha(path[0]) == 0 || path[1] != L':' ||
      (path[2] != L'\\' && path[2] != L'/') || path.back() == L'\\' || path.back() == L'/') {
    throw std::runtime_error("launcher path invalid");
  }
  ParsedPath result;
  result.drive = static_cast<wchar_t>(std::towupper(path[0]));
  std::size_t start = 3;
  while (start < path.size()) {
    const std::size_t end = path.find_first_of(L"\\/", start);
    const std::wstring component =
        path.substr(start, end == std::wstring::npos ? path.size() - start : end - start);
    if (component.empty() || component == L"." || component == L".." ||
        component.find(L':') != std::wstring::npos || component.back() == L'.' ||
        component.back() == L' ') {
      throw std::runtime_error("launcher path component invalid");
    }
    result.components.push_back(component);
    if (end == std::wstring::npos)
      break;
    start = end + 1;
  }
  if (result.components.empty())
    throw std::runtime_error("launcher path invalid");
  return result;
}

bool equal_path_component(const std::wstring& left, const std::wstring& right) {
  return _wcsicmp(left.c_str(), right.c_str()) == 0;
}

void require_worker_below_directory(const ParsedPath& worker, const ParsedPath& directory) {
  if (worker.drive != directory.drive ||
      worker.components.size() != directory.components.size() + 1)
    throw std::runtime_error("launcher worker path invalid");
  for (std::size_t index = 0; index < directory.components.size(); ++index) {
    if (!equal_path_component(worker.components[index], directory.components[index]))
      throw std::runtime_error("launcher worker path invalid");
  }
}

std::wstring extended_path(const ParsedPath& path, std::size_t component_count) {
  std::wstring result = L"\\\\?\\";
  result.push_back(path.drive);
  result += L":\\";
  for (std::size_t index = 0; index < component_count; ++index) {
    if (index != 0)
      result.push_back(L'\\');
    result += path.components.at(index);
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

void reject_alternate_streams(HANDLE handle) {
  std::array<unsigned char, 64 * 1024> storage{};
  if (!GetFileInformationByHandleEx(handle, FileStreamInfo, storage.data(),
                                    static_cast<DWORD>(storage.size()))) {
    throw std::runtime_error("launcher stream identity failed");
  }
  std::size_t offset = 0;
  std::size_t count = 0;
  while (true) {
    const auto* stream = reinterpret_cast<const FILE_STREAM_INFO*>(storage.data() + offset);
    const std::wstring name(stream->StreamName, stream->StreamNameLength / sizeof(wchar_t));
    ++count;
    if (name != L"::$DATA")
      throw std::runtime_error("launcher alternate stream rejected");
    if (stream->NextEntryOffset == 0)
      break;
    offset += stream->NextEntryOffset;
    if (offset >= storage.size())
      throw std::runtime_error("launcher stream identity invalid");
  }
  if (count != 1)
    throw std::runtime_error("launcher stream identity invalid");
}

StableIdentity stable_identity(HANDLE handle) {
  FILE_ID_INFO id{};
  FILE_STANDARD_INFO standard{};
  FILE_ATTRIBUTE_TAG_INFO attributes{};
  if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) ||
      !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes,
                                    sizeof(attributes))) {
    throw std::runtime_error("launcher identity read failed");
  }
  if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
      attributes.ReparseTag != 0 || standard.NumberOfLinks != 1 ||
      standard.EndOfFile.QuadPart < 0) {
    throw std::runtime_error("launcher unsafe identity");
  }
  if (standard.Directory == FALSE)
    reject_alternate_streams(handle);
  return StableIdentity{id.VolumeSerialNumber, file_id_hex(id.FileId), standard.NumberOfLinks,
                        static_cast<std::uint64_t>(standard.EndOfFile.QuadPart),
                        standard.Directory != FALSE};
}

void validate_identity(HANDLE handle, HANDLE parent, const IdentityExpectation& expected) {
  const StableIdentity value = stable_identity(handle);
  const StableIdentity parent_value = stable_identity(parent);
  const std::uint32_t expected_mode = expected.directory ? 0700U : 0500U;
  if (std::to_string(value.volume) != expected.device_or_volume_id ||
      value.file_id != expected.file_id || value.links != expected.link_count ||
      expected.mode != expected_mode || parent_value.file_id != expected.parent_file_id ||
      value.size != expected.size_bytes || value.directory != expected.directory) {
    throw std::runtime_error("launcher identity changed");
  }
}

std::vector<UniqueHandle> hold_directory_path(const ParsedPath& directory) {
  std::vector<UniqueHandle> handles;
  handles.reserve(directory.components.size() + 1);
  const std::wstring volume = extended_path(directory, 0);
  handles.emplace_back(
      CreateFileW(volume.c_str(), kDirectoryAccess, kLockedShareMode, nullptr, OPEN_EXISTING,
                  FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  if (!handles.back().valid())
    throw std::runtime_error("launcher volume open failed");
  static_cast<void>(stable_identity(handles.back().get()));

  for (std::size_t index = 0; index < directory.components.size(); ++index) {
    const std::wstring current = extended_path(directory, index + 1);
    handles.emplace_back(
        CreateFileW(current.c_str(), kDirectoryAccess, kLockedShareMode, nullptr, OPEN_EXISTING,
                    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    if (!handles.back().valid() || !stable_identity(handles.back().get()).directory)
      throw std::runtime_error("launcher directory open failed");
  }
  return handles;
}

std::string hash_handle(HANDLE handle) {
  LARGE_INTEGER beginning{};
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
    throw std::runtime_error("launcher seek failed");
  Sha256 hash;
  std::array<unsigned char, 64 * 1024> buffer{};
  while (true) {
    DWORD count = 0;
    if (!ReadFile(handle, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr))
      throw std::runtime_error("launcher read failed");
    if (count == 0)
      break;
    hash.update(buffer.data(), count);
  }
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
    throw std::runtime_error("launcher seek failed");
  return hash.finish_hex();
}

UniqueHandle duplicate_inheritable_descriptor(int descriptor) {
  const intptr_t native = _get_osfhandle(descriptor);
  if (native == -1)
    throw std::runtime_error("launcher inherited descriptor invalid");
  HANDLE duplicate = INVALID_HANDLE_VALUE;
  if (!DuplicateHandle(GetCurrentProcess(), reinterpret_cast<HANDLE>(native), GetCurrentProcess(),
                       &duplicate, 0, TRUE, DUPLICATE_SAME_ACCESS)) {
    throw std::runtime_error("launcher inherited handle duplication failed");
  }
  return UniqueHandle(duplicate);
}

void write_acknowledgment(int descriptor, DWORD worker_pid) {
  const std::string line = "READY\t" + std::to_string(worker_pid) + "\n";
  std::size_t offset = 0;
  while (offset < line.size()) {
    const int count =
        _write(descriptor, line.data() + offset, static_cast<unsigned int>(line.size() - offset));
    if (count <= 0)
      throw std::runtime_error("launcher acknowledgment failed");
    offset += static_cast<std::size_t>(count);
  }
}

std::vector<wchar_t> sanitized_environment() {
  std::vector<std::wstring> entries;
  for (const wchar_t* key : {L"SystemRoot", L"WINDIR"}) {
    const DWORD length = GetEnvironmentVariableW(key, nullptr, 0);
    if (length == 0)
      continue;
    std::wstring value(static_cast<std::size_t>(length), L'\0');
    const DWORD written = GetEnvironmentVariableW(key, value.data(), length);
    if (written == 0 || written >= length)
      throw std::runtime_error("launcher environment read failed");
    value.resize(written);
    entries.emplace_back(std::wstring(key) + L"=" + value);
  }
  std::sort(entries.begin(), entries.end(),
            [](const std::wstring& left, const std::wstring& right) {
              return _wcsicmp(left.c_str(), right.c_str()) < 0;
            });
  std::vector<wchar_t> block;
  for (const auto& entry : entries) {
    block.insert(block.end(), entry.begin(), entry.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  if (entries.empty())
    block.push_back(L'\0');
  return block;
}

std::uint32_t active_job_processes(HANDLE job) {
  JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information{};
  if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, &information,
                                 sizeof(information), nullptr)) {
    throw std::runtime_error("launcher job query failed");
  }
  return information.ActiveProcesses;
}

bool ownership_control_closed(int descriptor) {
  const intptr_t native = _get_osfhandle(descriptor);
  if (native == -1)
    return true;
  DWORD available = 0;
  if (!PeekNamedPipe(reinterpret_cast<HANDLE>(native), nullptr, 0, nullptr, &available, nullptr))
    return true;
  return available != 0;
}

int wait_for_job(HANDLE job, HANDLE worker_process, int control_descriptor) {
  bool termination_started = false;
  while (true) {
    const std::uint32_t active = active_job_processes(job);
    if (active == 0) {
      DWORD exit_code = 1;
      if (!GetExitCodeProcess(worker_process, &exit_code) || exit_code == STILL_ACTIVE)
        return 1;
      return static_cast<int>(exit_code);
    }
    const bool worker_exited = WaitForSingleObject(worker_process, 0) == WAIT_OBJECT_0;
    if ((worker_exited || ownership_control_closed(control_descriptor)) && !termination_started) {
      termination_started = true;
      if (!TerminateJobObject(job, 1))
        throw std::runtime_error("launcher job termination failed");
    }
    std::this_thread::sleep_for(kPollInterval);
  }
}

class WindowsLauncher final : public PlatformLauncher {
public:
  int run(const LaunchRequest& request, int control_descriptor,
          int acknowledgment_descriptor) override {
    const ParsedPath working_directory =
        parse_absolute_path(utf8_to_wide(request.working_directory));
    const ParsedPath worker_path = parse_absolute_path(utf8_to_wide(request.worker_path));
    require_worker_below_directory(worker_path, working_directory);

    std::vector<UniqueHandle> directory_handles = hold_directory_path(working_directory);
    if (directory_handles.size() < 2)
      throw std::runtime_error("launcher directory parent unavailable");
    HANDLE directory = directory_handles.back().get();
    HANDLE directory_parent = directory_handles[directory_handles.size() - 2].get();
    validate_identity(directory, directory_parent, request.directory_identity);

    const std::wstring worker_application =
        extended_path(worker_path, worker_path.components.size());
    UniqueHandle worker_file(CreateFileW(worker_application.c_str(), kWorkerAccess, FILE_SHARE_READ,
                                         nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT,
                                         nullptr));
    if (!worker_file.valid())
      throw std::runtime_error("launcher worker open failed");
    validate_identity(worker_file.get(), directory, request.worker_identity);
    if (hash_handle(worker_file.get()) != request.worker_sha256)
      throw std::runtime_error("launcher digest changed");
    validate_identity(worker_file.get(), directory, request.worker_identity);

    UniqueHandle job(CreateJobObjectW(nullptr, nullptr));
    if (!job.valid())
      throw std::runtime_error("launcher job creation failed");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (!SetInformationJobObject(job.get(), JobObjectExtendedLimitInformation, &limits,
                                 sizeof(limits))) {
      throw std::runtime_error("launcher job configuration failed");
    }

    std::array<UniqueHandle, 3> inherited = {duplicate_inheritable_descriptor(0),
                                             duplicate_inheritable_descriptor(1),
                                             duplicate_inheritable_descriptor(2)};
    const std::array<HANDLE, 3> inherited_values = {inherited[0].get(), inherited[1].get(),
                                                    inherited[2].get()};
    AttributeList attributes(inherited_values);
    STARTUPINFOEXW startup{};
    startup.StartupInfo.cb = sizeof(startup);
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = inherited_values[0];
    startup.StartupInfo.hStdOutput = inherited_values[1];
    startup.StartupInfo.hStdError = inherited_values[2];
    startup.lpAttributeList = attributes.get();

    std::vector<wchar_t> environment = sanitized_environment();
    std::wstring command_line = L"local-whisper-worker --local-whisper-worker-v1";
    PROCESS_INFORMATION process_information{};
    const std::wstring working_directory_path =
        extended_path(working_directory, working_directory.components.size());
    const DWORD flags = CREATE_NO_WINDOW | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT |
                        EXTENDED_STARTUPINFO_PRESENT;
    if (!CreateProcessW(worker_application.c_str(), command_line.data(), nullptr, nullptr, TRUE,
                        flags, environment.data(), working_directory_path.c_str(),
                        &startup.StartupInfo, &process_information)) {
      throw std::runtime_error("launcher worker creation failed");
    }
    UniqueHandle worker_process(process_information.hProcess);
    UniqueHandle worker_thread(process_information.hThread);
    if (!AssignProcessToJobObject(job.get(), worker_process.get())) {
      static_cast<void>(TerminateProcess(worker_process.get(), 1));
      throw std::runtime_error("launcher job assignment failed");
    }
    if (ResumeThread(worker_thread.get()) == static_cast<DWORD>(-1)) {
      static_cast<void>(TerminateJobObject(job.get(), 1));
      throw std::runtime_error("launcher worker resume failed");
    }
    worker_thread.reset();
    write_acknowledgment(acknowledgment_descriptor, process_information.dwProcessId);
    static_cast<void>(_close(acknowledgment_descriptor));
    return wait_for_job(job.get(), worker_process.get(), control_descriptor);
  }
};

} // namespace

std::unique_ptr<PlatformLauncher> make_platform_launcher() {
  return std::make_unique<WindowsLauncher>();
}

} // namespace local_whisper::launcher
