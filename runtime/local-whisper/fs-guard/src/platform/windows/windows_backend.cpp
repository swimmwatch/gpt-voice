#define NOMINMAX
#include "platform/windows/windows_backend.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"
#include "local_whisper/fs_guard/validation.hpp"
#include "platform/windows/cng_sha256.hpp"
#include "platform/windows/unique_handle.hpp"

#include <aclapi.h>
#include <windows.h>
#include <winternl.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cwctype>
#include <iomanip>
#include <map>
#include <memory>
#include <optional>
#include <span>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace local_whisper::fs_guard {

// Windows safety proof: managed components are opened by NtCreateFile with a
// held RootDirectory handle and FILE_OPEN_REPARSE_POINT. Reparse tags, ADS,
// hard links, ACL widening, volume changes, and file-ID changes fail closed.
// Rename and disposition operate on the held source handle, so there is no
// final-path comparison followed by an unchecked CreateFileW reopen.

class WindowsBackend::Impl final {
public:
  explicit Impl(ResourceFailureInjector* failure_injector) noexcept
      : failure_injector_(failure_injector) {}

  static constexpr ULONG kDirectoryOptions = FILE_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT |
                                             FILE_SYNCHRONOUS_IO_NONALERT |
                                             FILE_OPEN_FOR_BACKUP_INTENT;
  static constexpr ULONG kFileOptions =
      FILE_NON_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT;
  static constexpr ACCESS_MASK kDirectoryAccess =
      FILE_LIST_DIRECTORY | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY |
      FILE_READ_ATTRIBUTES | FILE_WRITE_ATTRIBUTES | FILE_DELETE_CHILD | READ_CONTROL | WRITE_DAC |
      WRITE_OWNER | DELETE | SYNCHRONIZE;
  static constexpr ACCESS_MASK kTraverseAccess =
      FILE_LIST_DIRECTORY | FILE_TRAVERSE | FILE_READ_ATTRIBUTES | READ_CONTROL | SYNCHRONIZE;
  static constexpr ACCESS_MASK kFileAccess =
      FILE_READ_DATA | FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_READ_ATTRIBUTES |
      FILE_WRITE_ATTRIBUTES | READ_CONTROL | WRITE_DAC | WRITE_OWNER | DELETE | SYNCHRONIZE;
  static constexpr ACCESS_MASK kFileInspectionAccess =
      FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL | SYNCHRONIZE;
  static constexpr NTSTATUS kStatusNameCollision = static_cast<NTSTATUS>(0xC0000035L);
  static constexpr NTSTATUS kStatusNameNotFound = static_cast<NTSTATUS>(0xC0000034L);
  static constexpr NTSTATUS kStatusPathNotFound = static_cast<NTSTATUS>(0xC000003AL);
  static constexpr FILE_INFORMATION_CLASS kFileRenameInformation =
      static_cast<FILE_INFORMATION_CLASS>(10);

  using NtCreateFileFunction = NTSTATUS(NTAPI*)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES,
                                                PIO_STATUS_BLOCK, PLARGE_INTEGER, ULONG, ULONG,
                                                ULONG, ULONG, PVOID, ULONG);
  using NtSetInformationFileFunction = NTSTATUS(NTAPI*)(HANDLE, PIO_STATUS_BLOCK, PVOID, ULONG,
                                                        FILE_INFORMATION_CLASS);

  ~Impl() noexcept {
    for (auto& [token, lease] : leases) {
      static_cast<void>(token);
      close_lease(lease);
    }
  }

  enum class LeaseKind { kRoot, kDirectory, kFile, kLock };

  struct StableIdentity {
    std::uint64_t volume = 0;
    std::string file_id;
    std::uint64_t links = 0;
    std::uint64_t size = 0;
    bool directory = false;
  };

  struct Lease {
    UniqueHandle handle;
    UniqueHandle parent;
    LeaseKind kind = LeaseKind::kDirectory;
    std::wstring name;
    std::uint64_t root_volume = 0;
    unsigned int mode = 0;
    bool delete_on_release = false;
    std::map<std::wstring, StableIdentity> namespace_identities;
    std::map<std::wstring, unsigned int> file_modes;
  };

  std::map<std::string, Lease> leases;
  std::uint64_t next_lease = 1;

  void before_resource_acquisition() const {
    if (failure_injector_ != nullptr)
      failure_injector_->before_resource_acquisition();
  }

  UniqueHandle open_volume(const std::wstring& volume_path) {
    before_resource_acquisition();
    return UniqueHandle(
        CreateFileW(volume_path.c_str(), kTraverseAccess,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
                    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  }

  UniqueHandle open_process(DWORD pid) {
    before_resource_acquisition();
    return UniqueHandle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid));
  }

  void require_lease_capacity() const {
    if (leases.size() >= kMaxLiveLeases)
      throw GuardError("IO_FAILED");
  }

  NtCreateFileFunction nt_create_file() {
    const HMODULE module = GetModuleHandleW(L"ntdll.dll");
    if (module == nullptr)
      throw GuardError("UNSUPPORTED");
    const auto function =
        reinterpret_cast<NtCreateFileFunction>(GetProcAddress(module, "NtCreateFile"));
    if (function == nullptr)
      throw GuardError("UNSUPPORTED");
    return function;
  }

  NtSetInformationFileFunction nt_set_information_file() {
    const HMODULE module = GetModuleHandleW(L"ntdll.dll");
    if (module == nullptr)
      throw GuardError("UNSUPPORTED");
    const auto function = reinterpret_cast<NtSetInformationFileFunction>(
        GetProcAddress(module, "NtSetInformationFile"));
    if (function == nullptr)
      throw GuardError("UNSUPPORTED");
    return function;
  }

  std::wstring utf8_to_wide(const std::string& value) {
    if (value.empty())
      return {};
    const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                           static_cast<int>(value.size()), nullptr, 0);
    if (length <= 0)
      throw GuardError("INVALID_INPUT");
    std::wstring result(static_cast<std::size_t>(length), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                            static_cast<int>(value.size()), result.data(), length) != length) {
      throw GuardError("INVALID_INPUT");
    }
    return result;
  }

  std::string wide_to_utf8(const std::wstring& value) {
    if (value.empty())
      return {};
    const int length =
        WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                            static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (length <= 0)
      throw GuardError("UNSAFE_ENTRY");
    std::string result(static_cast<std::size_t>(length), '\0');
    if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                            static_cast<int>(value.size()), result.data(), length, nullptr,
                            nullptr) != length) {
      throw GuardError("UNSAFE_ENTRY");
    }
    return result;
  }

  std::string file_id_hex(const FILE_ID_128& value) {
    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (const unsigned char byte : value.Identifier) {
      output << std::setw(2) << static_cast<unsigned int>(byte);
    }
    return output.str();
  }

  StableIdentity stable_identity(HANDLE handle) {
    FILE_ID_INFO id{};
    FILE_STANDARD_INFO standard{};
    FILE_ATTRIBUTE_TAG_INFO attributes{};
    if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
        !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) ||
        !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes,
                                      sizeof(attributes))) {
      throw GuardError("IO_FAILED");
    }
    if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
        attributes.ReparseTag != 0 || standard.NumberOfLinks != 1) {
      throw GuardError("UNSAFE_ENTRY");
    }
    if (standard.Directory == FALSE) {
      std::array<unsigned char, 64 * 1024> stream_buffer{};
      if (!GetFileInformationByHandleEx(handle, FileStreamInfo, stream_buffer.data(),
                                        static_cast<DWORD>(stream_buffer.size()))) {
        throw GuardError("UNSAFE_ENTRY");
      }
      std::size_t stream_count = 0;
      std::size_t offset = 0;
      while (true) {
        const auto* stream =
            reinterpret_cast<const FILE_STREAM_INFO*>(stream_buffer.data() + offset);
        const std::wstring stream_name(stream->StreamName,
                                       stream->StreamNameLength / sizeof(wchar_t));
        ++stream_count;
        if (stream_name != L"::$DATA")
          throw GuardError("UNSAFE_ENTRY");
        if (stream->NextEntryOffset == 0)
          break;
        offset += stream->NextEntryOffset;
      }
      if (stream_count != 1)
        throw GuardError("UNSAFE_ENTRY");
    }
    return StableIdentity{id.VolumeSerialNumber, file_id_hex(id.FileId), standard.NumberOfLinks,
                          static_cast<std::uint64_t>(standard.EndOfFile.QuadPart),
                          standard.Directory != FALSE};
  }

  bool same_identity(const StableIdentity& left, const StableIdentity& right) {
    return left.volume == right.volume && left.file_id == right.file_id &&
           left.directory == right.directory;
  }

  std::string identity_string(HANDLE handle, HANDLE parent, unsigned int mode) {
    const StableIdentity value = stable_identity(handle);
    const StableIdentity parent_value = stable_identity(parent);
    std::ostringstream output;
    output << value.volume << '|' << value.file_id << '|' << value.links << '|' << mode << '|'
           << parent_value.file_id << '|' << value.size << '|'
           << (value.directory ? "directory" : "regular");
    return output.str();
  }

  PSID current_user_sid(std::vector<unsigned char>& storage) {
    HANDLE raw_token = nullptr;
    before_resource_acquisition();
    const bool opened = OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw_token) != FALSE;
    UniqueHandle token(raw_token);
    if (!opened) {
      throw GuardError("IO_FAILED");
    }
    DWORD length = 0;
    GetTokenInformation(token.get(), TokenUser, nullptr, 0, &length);
    storage.resize(length);
    if (!GetTokenInformation(token.get(), TokenUser, storage.data(), length, &length)) {
      throw GuardError("IO_FAILED");
    }
    return reinterpret_cast<TOKEN_USER*>(storage.data())->User.Sid;
  }

  void apply_private_acl(HANDLE handle) {
    std::vector<unsigned char> sid_storage;
    PSID sid = current_user_sid(sid_storage);
    const DWORD acl_size =
        sizeof(ACL) + sizeof(ACCESS_ALLOWED_ACE) + GetLengthSid(sid) - sizeof(DWORD);
    std::vector<unsigned char> acl_storage(acl_size);
    PACL acl = reinterpret_cast<PACL>(acl_storage.data());
    if (!InitializeAcl(acl, acl_size, ACL_REVISION) ||
        !AddAccessAllowedAceEx(acl, ACL_REVISION, OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE,
                               FILE_ALL_ACCESS, sid)) {
      throw GuardError("IO_FAILED");
    }
    const DWORD result = SetSecurityInfo(handle, SE_FILE_OBJECT,
                                         OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION |
                                             PROTECTED_DACL_SECURITY_INFORMATION,
                                         sid, nullptr, acl, nullptr);
    if (result != ERROR_SUCCESS)
      throw GuardError("IO_FAILED");
  }

  void verify_private_acl(HANDLE handle) {
    PSID owner = nullptr;
    PACL acl = nullptr;
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    before_resource_acquisition();
    const DWORD result = GetSecurityInfo(handle, SE_FILE_OBJECT,
                                         OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                                         &owner, nullptr, &acl, nullptr, &descriptor);
    class UniqueSecurityDescriptor final {
    public:
      explicit UniqueSecurityDescriptor(PSECURITY_DESCRIPTOR value) noexcept : value_(value) {}
      ~UniqueSecurityDescriptor() noexcept {
        if (value_ != nullptr)
          LocalFree(value_);
      }
      UniqueSecurityDescriptor(const UniqueSecurityDescriptor&) = delete;
      UniqueSecurityDescriptor& operator=(const UniqueSecurityDescriptor&) = delete;

    private:
      PSECURITY_DESCRIPTOR value_;
    } owned_descriptor(descriptor);
    if (result != ERROR_SUCCESS || owner == nullptr || acl == nullptr || acl->AceCount != 1) {
      throw GuardError("UNSAFE_ENTRY");
    }
    std::vector<unsigned char> sid_storage;
    PSID current = current_user_sid(sid_storage);
    void* raw_ace = nullptr;
    SECURITY_DESCRIPTOR_CONTROL control = 0;
    DWORD revision = 0;
    const bool control_ok = GetSecurityDescriptorControl(descriptor, &control, &revision) != FALSE;
    const bool ace_ok = GetAce(acl, 0, &raw_ace) != FALSE;
    const auto* ace = static_cast<ACCESS_ALLOWED_ACE*>(raw_ace);
    const bool valid =
        control_ok && ace_ok && EqualSid(owner, current) != FALSE &&
        (control & SE_DACL_PROTECTED) != 0 && ace->Header.AceType == ACCESS_ALLOWED_ACE_TYPE &&
        EqualSid(reinterpret_cast<PSID>(const_cast<DWORD*>(&ace->SidStart)), current) != FALSE &&
        (ace->Mask & FILE_ALL_ACCESS) == FILE_ALL_ACCESS;
    if (!valid)
      throw GuardError("UNSAFE_ENTRY");
  }

  UniqueHandle relative_open(HANDLE parent, const std::wstring& name, ACCESS_MASK access,
                             ULONG disposition, ULONG options, bool& created) {
    if (name.empty() || name == L"." || name == L".." ||
        name.find_first_of(L"\\/:\0") != std::wstring::npos || name.back() == L'.' ||
        name.back() == L' ') {
      throw GuardError("INVALID_INPUT");
    }
    UNICODE_STRING unicode{};
    unicode.Buffer = const_cast<PWSTR>(name.data());
    unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
    unicode.MaximumLength = unicode.Length;
    OBJECT_ATTRIBUTES attributes{};
    InitializeObjectAttributes(&attributes, &unicode, 0, parent, nullptr);
    IO_STATUS_BLOCK status_block{};
    HANDLE handle = INVALID_HANDLE_VALUE;
    before_resource_acquisition();
    const NTSTATUS status = nt_create_file()(
        &handle, access, &attributes, &status_block, nullptr, FILE_ATTRIBUTE_NORMAL,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, disposition, options, nullptr, 0);
    UniqueHandle owned_handle(handle);
    if (status == kStatusNameCollision)
      throw GuardError("CONFLICT");
    if (status == kStatusNameNotFound || status == kStatusPathNotFound) {
      return {};
    }
    if (status < 0 || !owned_handle.valid()) {
      throw GuardError("IO_FAILED");
    }
    created = status_block.Information == FILE_CREATED;
    return owned_handle;
  }

  UniqueHandle duplicate_handle(HANDLE handle) {
    HANDLE duplicate = INVALID_HANDLE_VALUE;
    before_resource_acquisition();
    const bool duplicated = DuplicateHandle(GetCurrentProcess(), handle, GetCurrentProcess(),
                                            &duplicate, 0, FALSE, DUPLICATE_SAME_ACCESS) != FALSE;
    UniqueHandle owned_duplicate(duplicate);
    if (!duplicated) {
      throw GuardError("IO_FAILED");
    }
    return owned_duplicate;
  }

  std::wstring native_path(HANDLE handle) {
    const DWORD length = GetFinalPathNameByHandleW(handle, nullptr, 0, VOLUME_NAME_DOS);
    if (length == 0)
      throw GuardError("IO_FAILED");
    std::vector<wchar_t> buffer(length);
    const DWORD written = GetFinalPathNameByHandleW(handle, buffer.data(), length, VOLUME_NAME_DOS);
    if (written == 0 || written >= length)
      throw GuardError("IO_FAILED");
    const std::wstring path(buffer.data(), written);
    if (!path.starts_with(L"\\\\?\\"))
      throw GuardError("UNSAFE_ENTRY");
    return L"\\??\\" + path.substr(4);
  }

  void set_disposition(HANDLE handle) {
    FILE_DISPOSITION_INFO disposition{TRUE};
    if (!SetFileInformationByHandle(handle, FileDispositionInfo, &disposition,
                                    sizeof(disposition))) {
      throw GuardError("IO_FAILED");
    }
  }

  void rename_handle(HANDLE handle, HANDLE destination_parent,
                     const std::wstring& destination_name) {
    const std::wstring destination_path =
        native_path(destination_parent) + L"\\" + destination_name;
    const std::size_t bytes =
        offsetof(FILE_RENAME_INFO, FileName) + destination_path.size() * sizeof(wchar_t);
    std::vector<unsigned char> storage(bytes);
    auto* information = reinterpret_cast<FILE_RENAME_INFO*>(storage.data());
    information->ReplaceIfExists = FALSE;
    information->RootDirectory = nullptr;
    information->FileNameLength = static_cast<DWORD>(destination_path.size() * sizeof(wchar_t));
    std::memcpy(information->FileName, destination_path.data(), information->FileNameLength);
    IO_STATUS_BLOCK status_block{};
    const NTSTATUS status = nt_set_information_file()(
        handle, &status_block, information, static_cast<ULONG>(bytes), kFileRenameInformation);
    if (status == kStatusNameCollision)
      throw GuardError("CONFLICT");
    if (status < 0)
      throw GuardError("IO_FAILED");
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

  void close_lease(Lease& lease) {
    if (lease.delete_on_release && lease.handle != INVALID_HANDLE_VALUE) {
      try {
        set_disposition(lease.handle);
      } catch (...) {
      }
    }
    lease.handle.reset();
    lease.parent.reset();
  }

  Lease& require_root(const std::string& token) {
    Lease& root = require_lease(token);
    if (root.kind != LeaseKind::kRoot || stable_identity(root.handle).volume != root.root_volume) {
      throw GuardError("IDENTITY_CHANGED");
    }
    return root;
  }

  UniqueHandle open_namespace(const Lease& root, const std::wstring& name) {
    const auto expected = root.namespace_identities.find(name);
    if (expected == root.namespace_identities.end())
      throw GuardError("INVALID_INPUT");
    bool created = false;
    UniqueHandle handle(
        relative_open(root.handle, name, kDirectoryAccess, FILE_OPEN, kDirectoryOptions, created));
    if (!handle.valid())
      throw GuardError("IDENTITY_CHANGED");
    const StableIdentity identity = stable_identity(handle.get());
    if (!same_identity(identity, expected->second) || identity.volume != root.root_volume) {
      throw GuardError("IDENTITY_CHANGED");
    }
    verify_private_acl(handle.get());
    return handle;
  }

  std::vector<std::wstring> absolute_components(const std::wstring& path,
                                                std::wstring& volume_root) {
    if (path.size() < 4 || !std::iswalpha(path[0]) || path[1] != L':' ||
        (path[2] != L'\\' && path[2] != L'/') || path.back() == L'\\' || path.back() == L'/') {
      throw GuardError("INVALID_INPUT");
    }
    volume_root = L"\\\\?\\" + path.substr(0, 3);
    std::vector<std::wstring> components;
    std::size_t start = 3;
    while (start < path.size()) {
      const std::size_t end = path.find_first_of(L"\\/", start);
      const std::wstring component =
          path.substr(start, end == std::wstring::npos ? path.size() - start : end - start);
      if (component.empty() || component == L"." || component == L".." ||
          component.find(L':') != std::wstring::npos || component.back() == L'.' ||
          component.back() == L' ') {
        throw GuardError("INVALID_INPUT");
      }
      components.push_back(component);
      if (end == std::wstring::npos)
        break;
      start = end + 1;
    }
    if (components.size() < 3)
      throw GuardError("INVALID_INPUT");
    return components;
  }

  Lease initialize_root(const std::string& utf8_path) {
    std::wstring volume_path;
    const auto components = absolute_components(utf8_to_wide(utf8_path), volume_path);
    UniqueHandle current = open_volume(volume_path);
    if (!current.valid())
      throw GuardError("IO_FAILED");
    UniqueHandle root_parent;
    std::uint64_t managed_volume = 0;
    for (std::size_t index = 0; index < components.size(); ++index) {
      const bool managed = index + 2 >= components.size();
      if (managed && managed_volume == 0)
        managed_volume = stable_identity(current.get()).volume;
      if (index + 1 == components.size())
        root_parent = duplicate_handle(current.get());
      const ACCESS_MASK access =
          index + 3 >= components.size() ? kDirectoryAccess : kTraverseAccess;
      bool created = false;
      UniqueHandle next = relative_open(current.get(), components[index], access, FILE_OPEN,
                                        kDirectoryOptions, created);
      if (!next.valid()) {
        if (!managed)
          throw GuardError("IO_FAILED");
        next = relative_open(current.get(), components[index], kDirectoryAccess, FILE_CREATE,
                             kDirectoryOptions, created);
        if (!next.valid())
          throw GuardError("IO_FAILED");
        apply_private_acl(next.get());
      }
      const StableIdentity identity = stable_identity(next.get());
      if (managed && identity.volume != managed_volume)
        throw GuardError("UNSAFE_ENTRY");
      if (managed)
        verify_private_acl(next.get());
      current = std::move(next);
    }
    managed_volume = stable_identity(current.get()).volume;
    std::map<std::wstring, StableIdentity> namespace_identities;
    for (const wchar_t* name : {L"runtimes", L"models", L"staging", L"quarantine", L"locks"}) {
      bool created = false;
      UniqueHandle child = relative_open(current.get(), name, kDirectoryAccess, FILE_OPEN,
                                         kDirectoryOptions, created);
      if (!child.valid()) {
        child = relative_open(current.get(), name, kDirectoryAccess, FILE_CREATE, kDirectoryOptions,
                              created);
        if (!child.valid())
          throw GuardError("IO_FAILED");
        apply_private_acl(child.get());
      }
      verify_private_acl(child.get());
      const StableIdentity identity = stable_identity(child.get());
      if (identity.volume != managed_volume)
        throw GuardError("UNSAFE_ENTRY");
      namespace_identities.emplace(name, identity);
    }
    if (!root_parent.valid())
      throw GuardError("IO_FAILED");
    return Lease{std::move(current),
                 std::move(root_parent),
                 LeaseKind::kRoot,
                 components.back(),
                 managed_volume,
                 0700,
                 false,
                 std::move(namespace_identities)};
  }

  std::string sha256_file(HANDLE handle) {
    LARGE_INTEGER beginning{};
    if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
      throw GuardError("IO_FAILED");
    try {
      windows_crypto::CngSha256 digest([this] { before_resource_acquisition(); });
      std::array<unsigned char, 64 * 1024> buffer{};
      while (true) {
        DWORD count = 0;
        if (!ReadFile(handle, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr))
          throw GuardError("IO_FAILED");
        if (count == 0)
          break;
        digest.update(std::span<const std::uint8_t>(buffer.data(), count));
      }
      return digest.finish();
    } catch (...) {
      throw GuardError("IO_FAILED");
    }
  }

  std::vector<std::wstring> directory_names(HANDLE directory) {
    std::vector<std::wstring> result;
    std::array<unsigned char, 64 * 1024> buffer{};
    bool restart = true;
    while (true) {
      const FILE_INFO_BY_HANDLE_CLASS information_class =
          restart ? FileIdBothDirectoryRestartInfo : FileIdBothDirectoryInfo;
      if (!GetFileInformationByHandleEx(directory, information_class, buffer.data(),
                                        static_cast<DWORD>(buffer.size()))) {
        if (GetLastError() == ERROR_NO_MORE_FILES)
          break;
        throw GuardError("IO_FAILED");
      }
      restart = false;
      std::size_t offset = 0;
      while (true) {
        const auto* information =
            reinterpret_cast<const FILE_ID_BOTH_DIR_INFO*>(buffer.data() + offset);
        const std::wstring name(information->FileName,
                                information->FileNameLength / sizeof(wchar_t));
        if (name != L"." && name != L"..")
          result.push_back(name);
        if (information->NextEntryOffset == 0)
          break;
        offset += information->NextEntryOffset;
      }
    }
    return result;
  }

  std::vector<std::string>
  list_directory(Lease& directory, const std::map<std::string, unsigned int>& expected_modes) {
    if (directory.kind != LeaseKind::kDirectory)
      throw GuardError("INVALID_INPUT");
    const bool require_exact_expectations = !expected_modes.empty();
    std::map<std::string, unsigned int> remaining(expected_modes);
    std::vector<std::string> result;
    for (const std::wstring& wide_name : directory_names(directory.handle)) {
      const std::string name = wide_to_utf8(wide_name);
      const auto expected = remaining.find(name);
      if (!is_file_name(name) || (require_exact_expectations && expected == remaining.end())) {
        throw GuardError("UNSAFE_ENTRY");
      }
      bool created = false;
      UniqueHandle file(relative_open(directory.handle, wide_name, kFileInspectionAccess, FILE_OPEN,
                                      kFileOptions, created));
      if (!file.valid())
        throw GuardError("IDENTITY_CHANGED");
      verify_private_acl(file.get());
      const StableIdentity identity = stable_identity(file.get());
      if (identity.directory || identity.volume != directory.root_volume) {
        throw GuardError("UNSAFE_ENTRY");
      }
      const auto known_mode = directory.file_modes.find(wide_name);
      if (require_exact_expectations) {
        const unsigned int mode =
            known_mode == directory.file_modes.end() ? expected->second : known_mode->second;
        if (expected->second != mode)
          throw GuardError("UNSAFE_ENTRY");
        remaining.erase(expected);
        result.push_back(name + "~" + identity_string(file.get(), directory.handle, mode) + "~" +
                         sha256_file(file.get()));
        continue;
      }
      if (known_mode == directory.file_modes.end())
        throw GuardError("UNSAFE_ENTRY");
      const unsigned int mode = known_mode->second;
      result.push_back(name + "~" + identity_string(file.get(), directory.handle, mode) + "~" +
                       sha256_file(file.get()));
    }
    if (require_exact_expectations && !remaining.empty())
      throw GuardError("UNSAFE_ENTRY");
    return result;
  }

  std::optional<std::string> process_start_identity(DWORD pid) {
    UniqueHandle process(open_process(pid));
    if (!process.valid()) {
      if (GetLastError() == ERROR_INVALID_PARAMETER)
        return std::string{};
      return std::nullopt;
    }
    FILETIME creation{}, exit{}, kernel{}, user{};
    if (!GetProcessTimes(process.get(), &creation, &exit, &kernel, &user)) {
      return std::nullopt;
    }
    return std::to_string(creation.dwHighDateTime) + "-" + std::to_string(creation.dwLowDateTime);
  }

  void write_all(HANDLE handle, std::string_view data) {
    std::size_t offset = 0;
    while (offset < data.size()) {
      DWORD written = 0;
      const DWORD amount =
          static_cast<DWORD>(std::min<std::size_t>(data.size() - offset, MAXDWORD));
      if (!WriteFile(handle, data.data() + offset, amount, &written, nullptr) || written == 0) {
        throw GuardError("IO_FAILED");
      }
      offset += written;
    }
  }

  std::string read_small_file(HANDLE handle) {
    LARGE_INTEGER beginning{};
    if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN))
      throw GuardError("UNSAFE_ENTRY");
    std::array<char, 2048> buffer{};
    DWORD count = 0;
    if (!ReadFile(handle, buffer.data(), static_cast<DWORD>(buffer.size() - 1), &count, nullptr) ||
        count == 0 || count >= buffer.size() - 1) {
      throw GuardError("UNSAFE_ENTRY");
    }
    return std::string(buffer.data(), count);
  }

  std::string acquire_lock(Lease& root, const LockCommand& command) {
    UniqueHandle parent(open_namespace(root, L"locks"));
    const std::wstring name = utf8_to_wide("lock-" + command.artifact_name);
    for (int attempt = 0; attempt < 2; ++attempt) {
      bool created = false;
      try {
        UniqueHandle file(
            relative_open(parent.get(), name, kFileAccess, FILE_CREATE, kFileOptions, created));
        if (!file.valid())
          throw GuardError("IO_FAILED");
        apply_private_acl(file.get());
        const std::string metadata = command.instance_nonce + "\n" + command.process_id.text() +
                                     "\n" + command.process_identity + "\n" +
                                     std::string(command.operation.text()) + "\n" +
                                     command.artifact_id + "\n";
        write_all(file.get(), metadata);
        if (!FlushFileBuffers(file.get()))
          throw GuardError("IO_FAILED");
        return add_lease(Lease{std::move(file),
                               std::move(parent),
                               LeaseKind::kLock,
                               name,
                               root.root_volume,
                               0600,
                               true,
                               {}});
      } catch (const GuardError& error) {
        if (error.code() != "CONFLICT") {
          throw;
        }
      }
      UniqueHandle existing(
          relative_open(parent.get(), name, kFileAccess, FILE_OPEN, kFileOptions, created));
      if (!existing.valid())
        continue;
      verify_private_acl(existing.get());
      const auto fields = split(read_small_file(existing.get()), '\n');
      if (fields.size() < 6 || fields[5] != "") {
        throw GuardError("UNSAFE_ENTRY");
      }
      char* owner_end = nullptr;
      const unsigned long owner_pid = std::strtoul(fields[1].c_str(), &owner_end, 10);
      if (owner_end == fields[1].c_str() || *owner_end != '\0' || owner_pid == 0 ||
          !is_safe_token(fields[0], 16, 128) || !is_safe_token(fields[2], 1, 128) ||
          !is_safe_token(fields[3], 1, 32) || !is_safe_token(fields[4], 1, 128)) {
        throw GuardError("UNSAFE_ENTRY");
      }
      const auto process_identity = process_start_identity(static_cast<DWORD>(owner_pid));
      if (!process_identity.has_value()) {
        throw GuardError("UNSAFE_ENTRY");
      }
      if (*process_identity == fields[2]) {
        throw GuardError("CONFLICT");
      }
      set_disposition(existing.get());
    }
    throw GuardError("CONFLICT");
  }

  ResponseFields process_identity(const ProcessIdentityCommand& command) {
    const auto identity = process_start_identity(static_cast<DWORD>(command.process_id.value()));
    if (!identity.has_value() || identity->empty())
      throw GuardError("UNSAFE_ENTRY");
    return {*identity};
  }

  ResponseFields initialize(const InitCommand& command) {
    if (command.platform.value() != Platform::Value::kWindows)
      throw GuardError("UNSUPPORTED");
    require_lease_capacity();
    Lease root = initialize_root(command.root_path);
    const std::string identity = identity_string(root.handle, root.parent, root.mode);
    const std::string token = add_lease(std::move(root));
    return {token, identity};
  }

  ResponseFields lock(const LockCommand& command) {
    Lease& root = require_root(command.root_token);
    require_lease_capacity();
    const std::string token = acquire_lock(root, command);
    Lease& lock = require_lease(token);
    return {token, identity_string(lock.handle, lock.parent, lock.mode)};
  }

  ResponseFields create_staging(const CreateStagingCommand& command) {
    Lease& root = require_root(command.root_token);
    require_lease_capacity();
    UniqueHandle parent(open_namespace(root, L"staging"));
    const std::wstring name = utf8_to_wide("stage-" + command.artifact_name + "-" + command.nonce);
    bool created = false;
    UniqueHandle directory(relative_open(parent.get(), name, kDirectoryAccess, FILE_CREATE,
                                         kDirectoryOptions, created));
    if (!directory.valid()) {
      throw GuardError("IO_FAILED");
    }
    apply_private_acl(directory.get());
    const std::string identity = identity_string(directory.get(), parent.get(), 0700);
    const std::string token = add_lease(Lease{std::move(directory),
                                              std::move(parent),
                                              LeaseKind::kDirectory,
                                              name,
                                              root.root_volume,
                                              0700,
                                              false,
                                              {}});
    return {token, identity};
  }

  ResponseFields create_file(const CreateFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    require_lease_capacity();
    const unsigned int mode = command.mode.value();
    bool created = false;
    const std::wstring name = utf8_to_wide(command.file_name);
    UniqueHandle file(
        relative_open(directory.handle, name, kFileAccess, FILE_CREATE, kFileOptions, created));
    if (!file.valid())
      throw GuardError("IO_FAILED");
    apply_private_acl(file.get());
    UniqueHandle parent(duplicate_handle(directory.handle));
    const std::string identity = identity_string(file.get(), parent.get(), mode);
    const std::string token = add_lease(Lease{std::move(file),
                                              std::move(parent),
                                              LeaseKind::kFile,
                                              name,
                                              directory.root_volume,
                                              mode,
                                              false,
                                              {}});
    directory.file_modes.emplace(name, mode);
    return {token, identity};
  }

  ResponseFields write_file(const WriteFileCommand& command) {
    Lease& file = require_lease(command.file_token);
    if (file.kind != LeaseKind::kFile)
      throw GuardError("INVALID_INPUT");
    write_all(file.handle, command.bytes);
    return {};
  }

  ResponseFields seal_file(const SealFileCommand& command) {
    Lease& file = require_lease(command.file_token);
    if (file.kind != LeaseKind::kFile || !FlushFileBuffers(file.handle)) {
      throw GuardError("IO_FAILED");
    }
    return {identity_string(file.handle, file.parent, file.mode)};
  }

  ResponseFields list(const ListCommand& command) {
    std::map<std::string, unsigned int> expected_modes;
    for (const ExpectedEntry& expected : command.expected_entries) {
      expected_modes.emplace(expected.name, expected.mode.value());
    }
    return list_directory(require_lease(command.directory_token), expected_modes);
  }

  ResponseFields list_namespace_command(const ListNamespaceCommand& command) {
    Lease& root = require_root(command.root_token);
    UniqueHandle parent(
        open_namespace(root, utf8_to_wide(std::string(command.namespace_name.text()))));
    std::vector<std::string> result;
    for (const std::wstring& name : directory_names(parent.get())) {
      try {
        bool created = false;
        UniqueHandle directory(relative_open(parent.get(), name, kDirectoryAccess, FILE_OPEN,
                                             kDirectoryOptions, created));
        if (!directory.valid() || stable_identity(directory.get()).volume != root.root_volume) {
          throw GuardError("UNSAFE_ENTRY");
        }
        verify_private_acl(directory.get());
        result.push_back(wide_to_utf8(name));
      } catch (const GuardError&) {
        result.push_back("unmanaged-entry");
      }
    }
    return result;
  }

  ResponseFields open_artifact(const OpenArtifactCommand& command) {
    if (!is_artifact_name(command.artifact_name))
      throw GuardError("INVALID_INPUT");
    Lease& root = require_root(command.root_token);
    UniqueHandle parent(
        open_namespace(root, utf8_to_wide(std::string(command.namespace_name.text()))));
    const std::wstring artifact_name = utf8_to_wide(command.artifact_name);
    bool case_alias = false;
    bool exact_name = false;
    for (const std::wstring& candidate : directory_names(parent.get())) {
      if (candidate == artifact_name) {
        exact_name = true;
        break;
      }
      if (CompareStringOrdinal(candidate.data(), static_cast<int>(candidate.size()),
                               artifact_name.data(), static_cast<int>(artifact_name.size()),
                               TRUE) == CSTR_EQUAL) {
        case_alias = true;
      }
    }
    if (!exact_name) {
      if (case_alias)
        throw GuardError("UNSAFE_ENTRY");
      return {"MISSING"};
    }
    bool created = false;
    UniqueHandle directory(relative_open(parent.get(), artifact_name, kDirectoryAccess, FILE_OPEN,
                                         kDirectoryOptions, created));
    if (!directory.valid()) {
      return {"MISSING"};
    }
    verify_private_acl(directory.get());
    require_lease_capacity();
    const std::string identity = identity_string(directory.get(), parent.get(), 0700);
    const std::string token = add_lease(Lease{std::move(directory),
                                              std::move(parent),
                                              LeaseKind::kDirectory,
                                              utf8_to_wide(command.artifact_name),
                                              root.root_volume,
                                              0700,
                                              false,
                                              {}});
    return {token, identity};
  }

  ResponseFields promote(const PromoteCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& staging = require_lease(command.staging_token);
    if (staging.kind != LeaseKind::kDirectory || staging.root_volume != root.root_volume ||
        wide_to_utf8(staging.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    UniqueHandle destination(
        open_namespace(root, utf8_to_wide(std::string(command.namespace_name.text()))));
    rename_handle(staging.handle, destination.get(), utf8_to_wide(command.artifact_name));
    const std::string result = identity_string(staging.handle, destination.get(), 0700);
    return {result};
  }

  ResponseFields quarantine(const QuarantineCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& artifact = require_lease(command.artifact_token);
    if (artifact.kind != LeaseKind::kDirectory || artifact.root_volume != root.root_volume ||
        wide_to_utf8(artifact.name) != command.artifact_name) {
      throw GuardError("IDENTITY_CHANGED");
    }
    require_lease_capacity();
    UniqueHandle destination(open_namespace(root, L"quarantine"));
    const std::wstring name =
        utf8_to_wide("quarantine-" + command.artifact_name + "-" + command.nonce);
    rename_handle(artifact.handle, destination.get(), name);
    UniqueHandle duplicate(duplicate_handle(artifact.handle));
    const std::string identity = identity_string(duplicate.get(), destination.get(), 0700);
    const std::string token = add_lease(Lease{std::move(duplicate),
                                              std::move(destination),
                                              LeaseKind::kDirectory,
                                              name,
                                              root.root_volume,
                                              0700,
                                              false,
                                              {}});
    return {token, identity};
  }

  ResponseFields delete_file(const DeleteFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory ||
        wide_to_utf8(directory.name).rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    bool created = false;
    UniqueHandle file(relative_open(directory.handle, utf8_to_wide(command.file_name), kFileAccess,
                                    FILE_OPEN, kFileOptions, created));
    if (!file.valid())
      throw GuardError("IDENTITY_CHANGED");
    const auto expected = split(command.identity, '|');
    const unsigned int mode =
        expected.size() == 7
            ? static_cast<unsigned int>(std::strtoul(expected[3].c_str(), nullptr, 10))
            : 0;
    if (expected.size() != 7 ||
        identity_string(file.get(), directory.handle, mode) != command.identity) {
      throw GuardError("IDENTITY_CHANGED");
    }
    set_disposition(file.get());
    directory.file_modes.erase(utf8_to_wide(command.file_name));
    return {};
  }

  ResponseFields delete_staging_file(const DeleteStagingFileCommand& command) {
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory ||
        wide_to_utf8(directory.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    bool created = false;
    UniqueHandle file(relative_open(directory.handle, utf8_to_wide(command.file_name), kFileAccess,
                                    FILE_OPEN, kFileOptions, created));
    if (!file.valid())
      throw GuardError("IDENTITY_CHANGED");
    const auto expected = split(command.identity, '|');
    const unsigned int mode =
        expected.size() == 7
            ? static_cast<unsigned int>(std::strtoul(expected[3].c_str(), nullptr, 10))
            : 0;
    if (expected.size() != 7 ||
        identity_string(file.get(), directory.handle, mode) != command.identity) {
      throw GuardError("IDENTITY_CHANGED");
    }
    set_disposition(file.get());
    directory.file_modes.erase(utf8_to_wide(command.file_name));
    return {};
  }

  ResponseFields remove_quarantine(const RemoveQuarantineCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.root_volume != root.root_volume ||
        wide_to_utf8(directory.name).rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    if (!directory_names(directory.handle).empty())
      throw GuardError("UNSAFE_ENTRY");
    set_disposition(directory.handle);
    return {};
  }

  ResponseFields remove_staging(const RemoveStagingCommand& command) {
    Lease& root = require_root(command.root_token);
    Lease& directory = require_lease(command.directory_token);
    if (directory.kind != LeaseKind::kDirectory || directory.root_volume != root.root_volume ||
        wide_to_utf8(directory.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    if (!directory_names(directory.handle).empty())
      throw GuardError("UNSAFE_ENTRY");
    set_disposition(directory.handle);
    return {};
  }

  ResponseFields revalidate(const RevalidateCommand& command) {
    Lease& lease = require_lease(command.token);
    const auto expected = split(command.identity, '|');
    const auto current = split(identity_string(lease.handle, lease.parent, lease.mode), '|');
    if (expected.size() != 7 || current.size() != 7)
      throw GuardError("INVALID_INPUT");
    const bool directory = current[6] == "directory";
    for (std::size_t index = 0; index < current.size(); ++index) {
      if (directory && index == 5)
        continue;
      if (current[index] != expected[index])
        throw GuardError("IDENTITY_CHANGED");
    }
    bool created = false;
    UniqueHandle named(relative_open(
        lease.parent, lease.name, lease.kind == LeaseKind::kFile ? kFileAccess : kDirectoryAccess,
        FILE_OPEN, lease.kind == LeaseKind::kFile ? kFileOptions : kDirectoryOptions, created));
    if (!named.valid() ||
        !same_identity(stable_identity(named.get()), stable_identity(lease.handle))) {
      throw GuardError("IDENTITY_CHANGED");
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

WindowsBackend::WindowsBackend() : impl_(std::make_unique<Impl>(nullptr)) {}
WindowsBackend::WindowsBackend(ResourceFailureInjector& failure_injector)
    : impl_(std::make_unique<Impl>(&failure_injector)) {}
WindowsBackend::~WindowsBackend() = default;
WindowsBackend::WindowsBackend(WindowsBackend&&) noexcept = default;
WindowsBackend& WindowsBackend::operator=(WindowsBackend&&) noexcept = default;

ResponseFields WindowsBackend::process_identity(const ProcessIdentityCommand& command) {
  return impl_->process_identity(command);
}

ResponseFields WindowsBackend::initialize(const InitCommand& command) {
  return impl_->initialize(command);
}

ResponseFields WindowsBackend::lock(const LockCommand& command) { return impl_->lock(command); }

ResponseFields WindowsBackend::create_staging(const CreateStagingCommand& command) {
  return impl_->create_staging(command);
}

ResponseFields WindowsBackend::create_file(const CreateFileCommand& command) {
  return impl_->create_file(command);
}

ResponseFields WindowsBackend::write_file(const WriteFileCommand& command) {
  return impl_->write_file(command);
}

ResponseFields WindowsBackend::seal_file(const SealFileCommand& command) {
  return impl_->seal_file(command);
}

ResponseFields WindowsBackend::list(const ListCommand& command) { return impl_->list(command); }

ResponseFields WindowsBackend::list_namespace(const ListNamespaceCommand& command) {
  return impl_->list_namespace_command(command);
}

ResponseFields WindowsBackend::open_artifact(const OpenArtifactCommand& command) {
  return impl_->open_artifact(command);
}

ResponseFields WindowsBackend::promote(const PromoteCommand& command) {
  return impl_->promote(command);
}

ResponseFields WindowsBackend::quarantine(const QuarantineCommand& command) {
  return impl_->quarantine(command);
}

ResponseFields WindowsBackend::delete_file(const DeleteFileCommand& command) {
  return impl_->delete_file(command);
}

ResponseFields WindowsBackend::delete_staging_file(const DeleteStagingFileCommand& command) {
  return impl_->delete_staging_file(command);
}

ResponseFields WindowsBackend::remove_quarantine(const RemoveQuarantineCommand& command) {
  return impl_->remove_quarantine(command);
}

ResponseFields WindowsBackend::remove_staging(const RemoveStagingCommand& command) {
  return impl_->remove_staging(command);
}

ResponseFields WindowsBackend::revalidate(const RevalidateCommand& command) {
  return impl_->revalidate(command);
}

ResponseFields WindowsBackend::release(const ReleaseCommand& command) {
  return impl_->release(command);
}

} // namespace local_whisper::fs_guard
