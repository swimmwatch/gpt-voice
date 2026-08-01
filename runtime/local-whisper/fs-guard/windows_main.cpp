#define NOMINMAX
#include <windows.h>
#include <winternl.h>
#include <aclapi.h>
#include <bcrypt.h>

#include <array>
#include <algorithm>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <cwctype>
#include <iomanip>
#include <iostream>
#include <map>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace {

// Windows safety proof: managed components are opened by NtCreateFile with a
// held RootDirectory handle and FILE_OPEN_REPARSE_POINT. Reparse tags, ADS,
// hard links, ACL widening, volume changes, and file-ID changes fail closed.
// Rename and disposition operate on the held source handle, so there is no
// final-path comparison followed by an unchecked CreateFileW reopen.

constexpr std::size_t kMaxLineBytes = 256U * 1024U;
constexpr ULONG kDirectoryOptions = FILE_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT |
                                    FILE_SYNCHRONOUS_IO_NONALERT | FILE_OPEN_FOR_BACKUP_INTENT;
constexpr ULONG kFileOptions = FILE_NON_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT |
                               FILE_SYNCHRONOUS_IO_NONALERT;
constexpr ACCESS_MASK kDirectoryAccess = FILE_LIST_DIRECTORY | FILE_TRAVERSE |
                                          FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY |
                                          FILE_READ_ATTRIBUTES | FILE_WRITE_ATTRIBUTES |
                                          READ_CONTROL | WRITE_DAC | DELETE | SYNCHRONIZE;
constexpr ACCESS_MASK kTraverseAccess = FILE_LIST_DIRECTORY | FILE_TRAVERSE |
                                         FILE_READ_ATTRIBUTES | READ_CONTROL | SYNCHRONIZE;
constexpr ACCESS_MASK kFileAccess = FILE_READ_DATA | FILE_WRITE_DATA | FILE_APPEND_DATA |
                                     FILE_READ_ATTRIBUTES | FILE_WRITE_ATTRIBUTES |
                                     READ_CONTROL | WRITE_DAC | DELETE | SYNCHRONIZE;
constexpr NTSTATUS kStatusNameCollision = static_cast<NTSTATUS>(0xC0000035L);
constexpr NTSTATUS kStatusNameNotFound = static_cast<NTSTATUS>(0xC0000034L);
constexpr NTSTATUS kStatusPathNotFound = static_cast<NTSTATUS>(0xC000003AL);

using NtCreateFileFunction = NTSTATUS(NTAPI*)(
    PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES, PIO_STATUS_BLOCK, PLARGE_INTEGER,
    ULONG, ULONG, ULONG, ULONG, PVOID, ULONG);

class GuardError final : public std::runtime_error {
 public:
  explicit GuardError(std::string code)
      : std::runtime_error(code), code_(std::move(code)) {}
  const std::string& code() const { return code_; }

 private:
  std::string code_;
};

enum class LeaseKind { kRoot, kDirectory, kFile, kLock };

struct StableIdentity {
  std::uint64_t volume = 0;
  std::string file_id;
  std::uint64_t links = 0;
  std::uint64_t size = 0;
  bool directory = false;
};

struct Lease {
  HANDLE handle = INVALID_HANDLE_VALUE;
  HANDLE parent = INVALID_HANDLE_VALUE;
  LeaseKind kind = LeaseKind::kDirectory;
  std::wstring name;
  std::uint64_t root_volume = 0;
  unsigned int mode = 0;
  bool delete_on_release = false;
  std::map<std::wstring, StableIdentity> namespace_identities;
};

std::map<std::string, Lease> leases;
std::uint64_t next_lease = 1;

NtCreateFileFunction nt_create_file() {
  const HMODULE module = GetModuleHandleW(L"ntdll.dll");
  if (module == nullptr) throw GuardError("UNSUPPORTED");
  const auto function = reinterpret_cast<NtCreateFileFunction>(
      GetProcAddress(module, "NtCreateFile"));
  if (function == nullptr) throw GuardError("UNSUPPORTED");
  return function;
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

bool is_artifact_name(std::string_view value) {
  const std::size_t prefix = value.rfind("model-", 0) == 0 ? 6 :
                             value.rfind("runtime-", 0) == 0 ? 8 : 0;
  if (prefix == 0 || value.size() != prefix + 64) return false;
  for (std::size_t index = prefix; index < value.size(); ++index) {
    const unsigned char character = static_cast<unsigned char>(value[index]);
    if (!std::isxdigit(character) || std::isupper(character)) return false;
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

std::wstring utf8_to_wide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS,
                                         value.data(), static_cast<int>(value.size()),
                                         nullptr, 0);
  if (length <= 0) throw GuardError("INVALID_INPUT");
  std::wstring result(static_cast<std::size_t>(length), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), length) != length) {
    throw GuardError("INVALID_INPUT");
  }
  return result;
}

std::string wide_to_utf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS,
                                         value.data(), static_cast<int>(value.size()),
                                         nullptr, 0, nullptr, nullptr);
  if (length <= 0) throw GuardError("UNSAFE_ENTRY");
  std::string result(static_cast<std::size_t>(length), '\0');
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                          static_cast<int>(value.size()), result.data(), length,
                          nullptr, nullptr) != length) {
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
  FILE_ID_INFO id {};
  FILE_STANDARD_INFO standard {};
  FILE_ATTRIBUTE_TAG_INFO attributes {};
  if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) ||
      !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attributes, sizeof(attributes))) {
    throw GuardError("IO_FAILED");
  }
  if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
      attributes.ReparseTag != 0 || standard.NumberOfLinks != 1) {
    throw GuardError("UNSAFE_ENTRY");
  }
  if (standard.Directory == FALSE) {
    std::array<unsigned char, 64 * 1024> stream_buffer {};
    if (!GetFileInformationByHandleEx(handle, FileStreamInfo,
                                      stream_buffer.data(),
                                      static_cast<DWORD>(stream_buffer.size()))) {
      throw GuardError("UNSAFE_ENTRY");
    }
    std::size_t stream_count = 0;
    std::size_t offset = 0;
    while (true) {
      const auto* stream = reinterpret_cast<const FILE_STREAM_INFO*>(
          stream_buffer.data() + offset);
      const std::wstring stream_name(
          stream->StreamName, stream->StreamNameLength / sizeof(wchar_t));
      ++stream_count;
      if (stream_name != L"::$DATA") throw GuardError("UNSAFE_ENTRY");
      if (stream->NextEntryOffset == 0) break;
      offset += stream->NextEntryOffset;
    }
    if (stream_count != 1) throw GuardError("UNSAFE_ENTRY");
  }
  return StableIdentity{id.VolumeSerialNumber, file_id_hex(id.FileId),
                        standard.NumberOfLinks,
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
  output << value.volume << '|' << value.file_id << '|' << value.links << '|'
         << mode << '|' << parent_value.file_id << '|' << value.size << '|'
         << (value.directory ? "directory" : "regular");
  return output.str();
}

PSID current_user_sid(std::vector<unsigned char>& storage) {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) {
    throw GuardError("IO_FAILED");
  }
  DWORD length = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &length);
  storage.resize(length);
  if (!GetTokenInformation(token, TokenUser, storage.data(), length, &length)) {
    CloseHandle(token);
    throw GuardError("IO_FAILED");
  }
  CloseHandle(token);
  return reinterpret_cast<TOKEN_USER*>(storage.data())->User.Sid;
}

void apply_private_acl(HANDLE handle) {
  std::vector<unsigned char> sid_storage;
  PSID sid = current_user_sid(sid_storage);
  const DWORD acl_size = sizeof(ACL) + sizeof(ACCESS_ALLOWED_ACE) +
                         GetLengthSid(sid) - sizeof(DWORD);
  std::vector<unsigned char> acl_storage(acl_size);
  PACL acl = reinterpret_cast<PACL>(acl_storage.data());
  if (!InitializeAcl(acl, acl_size, ACL_REVISION) ||
      !AddAccessAllowedAceEx(acl, ACL_REVISION,
                             OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE,
                             FILE_ALL_ACCESS, sid)) {
    throw GuardError("IO_FAILED");
  }
  const DWORD result = SetSecurityInfo(
      handle, SE_FILE_OBJECT,
      DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
      sid, nullptr, acl, nullptr);
  if (result != ERROR_SUCCESS) throw GuardError("IO_FAILED");
}

void verify_private_acl(HANDLE handle) {
  PSID owner = nullptr;
  PACL acl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  const DWORD result = GetSecurityInfo(handle, SE_FILE_OBJECT,
                                       OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                                       &owner, nullptr, &acl, nullptr, &descriptor);
  if (result != ERROR_SUCCESS || owner == nullptr || acl == nullptr || acl->AceCount != 1) {
    if (descriptor != nullptr) LocalFree(descriptor);
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
  const bool valid = control_ok && ace_ok && EqualSid(owner, current) != FALSE &&
                     (control & SE_DACL_PROTECTED) != 0 &&
                     ace->Header.AceType == ACCESS_ALLOWED_ACE_TYPE &&
                     EqualSid(&ace->SidStart, current) != FALSE &&
                     (ace->Mask & FILE_ALL_ACCESS) == FILE_ALL_ACCESS;
  LocalFree(descriptor);
  if (!valid) throw GuardError("UNSAFE_ENTRY");
}

HANDLE relative_open(HANDLE parent, const std::wstring& name,
                     ACCESS_MASK access, ULONG disposition, ULONG options,
                     bool& created) {
  if (name.empty() || name == L"." || name == L".." ||
      name.find_first_of(L"\\/:\0") != std::wstring::npos ||
      name.back() == L'.' || name.back() == L' ') {
    throw GuardError("INVALID_INPUT");
  }
  UNICODE_STRING unicode {};
  unicode.Buffer = const_cast<PWSTR>(name.data());
  unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes {};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE,
                             parent, nullptr);
  IO_STATUS_BLOCK status_block {};
  HANDLE handle = INVALID_HANDLE_VALUE;
  const NTSTATUS status = nt_create_file()(
      &handle, access, &attributes, &status_block, nullptr, FILE_ATTRIBUTE_NORMAL,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, disposition, options,
      nullptr, 0);
  if (status == kStatusNameCollision) throw GuardError("CONFLICT");
  if (status == kStatusNameNotFound || status == kStatusPathNotFound) {
    return INVALID_HANDLE_VALUE;
  }
  if (status < 0 || handle == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
  created = status_block.Information == FILE_CREATED;
  return handle;
}

HANDLE duplicate_handle(HANDLE handle) {
  HANDLE duplicate = INVALID_HANDLE_VALUE;
  if (!DuplicateHandle(GetCurrentProcess(), handle, GetCurrentProcess(), &duplicate,
                       0, FALSE, DUPLICATE_SAME_ACCESS)) {
    throw GuardError("IO_FAILED");
  }
  return duplicate;
}

void set_disposition(HANDLE handle) {
  FILE_DISPOSITION_INFO disposition {TRUE};
  if (!SetFileInformationByHandle(handle, FileDispositionInfo,
                                  &disposition, sizeof(disposition))) {
    throw GuardError("IO_FAILED");
  }
}

void rename_handle(HANDLE handle, HANDLE destination_parent,
                   const std::wstring& destination_name) {
  const std::size_t bytes = offsetof(FILE_RENAME_INFO, FileName) +
                            destination_name.size() * sizeof(wchar_t);
  std::vector<unsigned char> storage(bytes);
  auto* information = reinterpret_cast<FILE_RENAME_INFO*>(storage.data());
  information->ReplaceIfExists = FALSE;
  information->RootDirectory = destination_parent;
  information->FileNameLength =
      static_cast<DWORD>(destination_name.size() * sizeof(wchar_t));
  std::memcpy(information->FileName, destination_name.data(),
              information->FileNameLength);
  if (!SetFileInformationByHandle(handle, FileRenameInfo,
                                  information, static_cast<DWORD>(bytes))) {
    throw GuardError(GetLastError() == ERROR_ALREADY_EXISTS ||
                             GetLastError() == ERROR_FILE_EXISTS
                         ? "CONFLICT"
                         : "IO_FAILED");
  }
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

void close_lease(Lease& lease) {
  if (lease.delete_on_release && lease.handle != INVALID_HANDLE_VALUE) {
    try {
      set_disposition(lease.handle);
    } catch (...) {
    }
  }
  if (lease.handle != INVALID_HANDLE_VALUE) CloseHandle(lease.handle);
  if (lease.parent != INVALID_HANDLE_VALUE) CloseHandle(lease.parent);
  lease.handle = INVALID_HANDLE_VALUE;
  lease.parent = INVALID_HANDLE_VALUE;
}

Lease& require_root(const std::string& token) {
  Lease& root = require_lease(token);
  if (root.kind != LeaseKind::kRoot ||
      stable_identity(root.handle).volume != root.root_volume) {
    throw GuardError("IDENTITY_CHANGED");
  }
  return root;
}

HANDLE open_namespace(const Lease& root, const std::wstring& name) {
  const auto expected = root.namespace_identities.find(name);
  if (expected == root.namespace_identities.end()) throw GuardError("INVALID_INPUT");
  bool created = false;
  HANDLE handle = relative_open(root.handle, name, kDirectoryAccess,
                                FILE_OPEN, kDirectoryOptions, created);
  if (handle == INVALID_HANDLE_VALUE) throw GuardError("IDENTITY_CHANGED");
  const StableIdentity identity = stable_identity(handle);
  if (!same_identity(identity, expected->second) ||
      identity.volume != root.root_volume) {
    CloseHandle(handle);
    throw GuardError("IDENTITY_CHANGED");
  }
  verify_private_acl(handle);
  return handle;
}

std::vector<std::wstring> absolute_components(const std::wstring& path,
                                               std::wstring& volume_root) {
  if (path.size() < 4 || !std::iswalpha(path[0]) || path[1] != L':' ||
      (path[2] != L'\\' && path[2] != L'/') ||
      path.back() == L'\\' || path.back() == L'/') {
    throw GuardError("INVALID_INPUT");
  }
  volume_root = L"\\\\?\\" + path.substr(0, 3);
  std::vector<std::wstring> components;
  std::size_t start = 3;
  while (start < path.size()) {
    const std::size_t end = path.find_first_of(L"\\/", start);
    const std::wstring component = path.substr(
        start, end == std::wstring::npos ? path.size() - start : end - start);
    if (component.empty() || component == L"." || component == L".." ||
        component.find(L':') != std::wstring::npos || component.back() == L'.' ||
        component.back() == L' ') {
      throw GuardError("INVALID_INPUT");
    }
    components.push_back(component);
    if (end == std::wstring::npos) break;
    start = end + 1;
  }
  if (components.size() < 3) throw GuardError("INVALID_INPUT");
  return components;
}

Lease initialize_root(const std::string& utf8_path) {
  std::wstring volume_path;
  const auto components = absolute_components(utf8_to_wide(utf8_path), volume_path);
  HANDLE current = CreateFileW(
      volume_path.c_str(), kTraverseAccess,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (current == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
  HANDLE root_parent = INVALID_HANDLE_VALUE;
  std::uint64_t managed_volume = 0;
  try {
    for (std::size_t index = 0; index < components.size(); ++index) {
      const bool managed = index + 2 >= components.size();
      if (managed && managed_volume == 0) managed_volume = stable_identity(current).volume;
      if (index + 1 == components.size()) root_parent = duplicate_handle(current);
      const ACCESS_MASK access = index + 3 >= components.size()
                                     ? kDirectoryAccess
                                     : kTraverseAccess;
      bool created = false;
      HANDLE next = relative_open(current, components[index], access,
                                  FILE_OPEN, kDirectoryOptions, created);
      if (next == INVALID_HANDLE_VALUE) {
        if (!managed) throw GuardError("IO_FAILED");
        next = relative_open(current, components[index], kDirectoryAccess,
                             FILE_CREATE, kDirectoryOptions, created);
        if (next == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
        apply_private_acl(next);
      }
      const StableIdentity identity = stable_identity(next);
      if (managed && identity.volume != managed_volume) {
        CloseHandle(next);
        throw GuardError("UNSAFE_ENTRY");
      }
      if (managed) verify_private_acl(next);
      CloseHandle(current);
      current = next;
    }
    managed_volume = stable_identity(current).volume;
    std::map<std::wstring, StableIdentity> namespace_identities;
    for (const wchar_t* name : {L"runtimes", L"models", L"staging",
                                L"quarantine", L"locks"}) {
      bool created = false;
      HANDLE child = relative_open(current, name, kDirectoryAccess,
                                   FILE_OPEN, kDirectoryOptions, created);
      if (child == INVALID_HANDLE_VALUE) {
        child = relative_open(current, name, kDirectoryAccess,
                              FILE_CREATE, kDirectoryOptions, created);
        if (child == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
        apply_private_acl(child);
      }
      verify_private_acl(child);
      const StableIdentity identity = stable_identity(child);
      if (identity.volume != managed_volume) {
        CloseHandle(child);
        throw GuardError("UNSAFE_ENTRY");
      }
      namespace_identities.emplace(name, identity);
      CloseHandle(child);
    }
    return Lease{current, root_parent, LeaseKind::kRoot, components.back(),
                 managed_volume, 0700, false, std::move(namespace_identities)};
  } catch (...) {
    CloseHandle(current);
    if (root_parent != INVALID_HANDLE_VALUE) CloseHandle(root_parent);
    throw;
  }
}

std::string sha256_file(HANDLE handle) {
  LARGE_INTEGER beginning {};
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN)) {
    throw GuardError("IO_FAILED");
  }
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  BCRYPT_HASH_HANDLE hash = nullptr;
  DWORD object_size = 0;
  DWORD transferred = 0;
  if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0 ||
      BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
                        reinterpret_cast<PUCHAR>(&object_size), sizeof(object_size),
                        &transferred, 0) < 0) {
    if (algorithm != nullptr) BCryptCloseAlgorithmProvider(algorithm, 0);
    throw GuardError("IO_FAILED");
  }
  std::vector<unsigned char> object(object_size);
  std::array<unsigned char, 32> digest {};
  if (BCryptCreateHash(algorithm, &hash, object.data(), object_size,
                       nullptr, 0, 0) < 0) {
    BCryptCloseAlgorithmProvider(algorithm, 0);
    throw GuardError("IO_FAILED");
  }
  std::array<unsigned char, 64 * 1024> buffer {};
  while (true) {
    DWORD count = 0;
    if (!ReadFile(handle, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr)) {
      BCryptDestroyHash(hash);
      BCryptCloseAlgorithmProvider(algorithm, 0);
      throw GuardError("IO_FAILED");
    }
    if (count == 0) break;
    if (BCryptHashData(hash, buffer.data(), count, 0) < 0) {
      BCryptDestroyHash(hash);
      BCryptCloseAlgorithmProvider(algorithm, 0);
      throw GuardError("IO_FAILED");
    }
  }
  const NTSTATUS finish = BCryptFinishHash(hash, digest.data(), digest.size(), 0);
  BCryptDestroyHash(hash);
  BCryptCloseAlgorithmProvider(algorithm, 0);
  if (finish < 0) throw GuardError("IO_FAILED");
  std::ostringstream output;
  output << std::hex << std::setfill('0');
  for (const unsigned char byte : digest) {
    output << std::setw(2) << static_cast<unsigned int>(byte);
  }
  return output.str();
}

std::vector<std::wstring> directory_names(HANDLE directory) {
  std::vector<std::wstring> result;
  std::array<unsigned char, 64 * 1024> buffer {};
  bool restart = true;
  while (true) {
    const FILE_INFO_BY_HANDLE_CLASS information_class =
        restart ? FileIdBothDirectoryRestartInfo : FileIdBothDirectoryInfo;
    if (!GetFileInformationByHandleEx(directory, information_class,
                                      buffer.data(), static_cast<DWORD>(buffer.size()))) {
      if (GetLastError() == ERROR_NO_MORE_FILES) break;
      throw GuardError("IO_FAILED");
    }
    restart = false;
    std::size_t offset = 0;
    while (true) {
      const auto* information = reinterpret_cast<const FILE_ID_BOTH_DIR_INFO*>(
          buffer.data() + offset);
      const std::wstring name(information->FileName,
                              information->FileNameLength / sizeof(wchar_t));
      if (name != L"." && name != L"..") result.push_back(name);
      if (information->NextEntryOffset == 0) break;
      offset += information->NextEntryOffset;
    }
  }
  return result;
}

std::vector<std::string> list_directory(
    Lease& directory, const std::map<std::string, unsigned int>& expected_modes) {
  if (directory.kind != LeaseKind::kDirectory) throw GuardError("INVALID_INPUT");
  std::vector<std::string> result;
  for (const std::wstring& wide_name : directory_names(directory.handle)) {
    const std::string name = wide_to_utf8(wide_name);
    const auto expected = expected_modes.find(name);
    if (!is_file_name(name) || expected == expected_modes.end()) {
      throw GuardError("UNSAFE_ENTRY");
    }
    bool created = false;
    HANDLE file = relative_open(directory.handle, wide_name, kFileAccess,
                                FILE_OPEN, kFileOptions, created);
    if (file == INVALID_HANDLE_VALUE) throw GuardError("IDENTITY_CHANGED");
    verify_private_acl(file);
    const StableIdentity identity = stable_identity(file);
    if (identity.directory || identity.volume != directory.root_volume) {
      CloseHandle(file);
      throw GuardError("UNSAFE_ENTRY");
    }
    result.push_back(name + "~" +
                     identity_string(file, directory.handle, expected->second) +
                     "~" + sha256_file(file));
    CloseHandle(file);
  }
  return result;
}

std::optional<std::string> process_start_identity(DWORD pid) {
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (process == nullptr) {
    if (GetLastError() == ERROR_INVALID_PARAMETER) return std::string{};
    return std::nullopt;
  }
  FILETIME creation {}, exit {}, kernel {}, user {};
  if (!GetProcessTimes(process, &creation, &exit, &kernel, &user)) {
    CloseHandle(process);
    return std::nullopt;
  }
  CloseHandle(process);
  return std::to_string(creation.dwHighDateTime) + "-" +
         std::to_string(creation.dwLowDateTime);
}

void write_all(HANDLE handle, std::string_view data) {
  std::size_t offset = 0;
  while (offset < data.size()) {
    DWORD written = 0;
    const DWORD amount = static_cast<DWORD>(
        std::min<std::size_t>(data.size() - offset, MAXDWORD));
    if (!WriteFile(handle, data.data() + offset, amount, &written, nullptr) || written == 0) {
      throw GuardError("IO_FAILED");
    }
    offset += written;
  }
}

std::string read_small_file(HANDLE handle) {
  LARGE_INTEGER beginning {};
  if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN)) throw GuardError("UNSAFE_ENTRY");
  std::array<char, 2048> buffer {};
  DWORD count = 0;
  if (!ReadFile(handle, buffer.data(), buffer.size() - 1, &count, nullptr) || count == 0 ||
      count >= buffer.size() - 1) {
    throw GuardError("UNSAFE_ENTRY");
  }
  return std::string(buffer.data(), count);
}

std::string acquire_lock(Lease& root, const std::vector<std::string>& arguments) {
  if (arguments.size() != 7 || !is_artifact_name(arguments[1]) ||
      !is_safe_token(arguments[2], 16, 128) || !is_safe_token(arguments[4], 1, 128) ||
      !is_safe_token(arguments[5], 1, 32) || !is_safe_token(arguments[6], 1, 128)) {
    throw GuardError("INVALID_INPUT");
  }
  char* end = nullptr;
  const unsigned long pid = std::strtoul(arguments[3].c_str(), &end, 10);
  if (end == arguments[3].c_str() || *end != '\0' || pid == 0) {
    throw GuardError("INVALID_INPUT");
  }
  HANDLE parent = open_namespace(root, L"locks");
  const std::wstring name = utf8_to_wide("lock-" + arguments[1]);
  for (int attempt = 0; attempt < 2; ++attempt) {
    bool created = false;
    try {
      HANDLE file = relative_open(parent, name, kFileAccess, FILE_CREATE,
                                  kFileOptions, created);
      if (file == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
      apply_private_acl(file);
      const std::string metadata = arguments[2] + "\n" + arguments[3] + "\n" +
                                   arguments[4] + "\n" + arguments[5] + "\n" +
                                   arguments[6] + "\n";
      write_all(file, metadata);
      if (!FlushFileBuffers(file)) throw GuardError("IO_FAILED");
      return add_lease(Lease{file, parent, LeaseKind::kLock, name,
                             root.root_volume, 0600, true, {}});
    } catch (const GuardError& error) {
      if (error.code() != "CONFLICT") {
        CloseHandle(parent);
        throw;
      }
    }
    HANDLE existing = relative_open(parent, name, kFileAccess, FILE_OPEN,
                                    kFileOptions, created);
    if (existing == INVALID_HANDLE_VALUE) continue;
    verify_private_acl(existing);
    const auto fields = split(read_small_file(existing), '\n');
    if (fields.size() < 6 || fields[5] != "") {
      CloseHandle(existing);
      CloseHandle(parent);
      throw GuardError("UNSAFE_ENTRY");
    }
    char* owner_end = nullptr;
    const unsigned long owner_pid = std::strtoul(fields[1].c_str(), &owner_end, 10);
    if (owner_end == fields[1].c_str() || *owner_end != '\0' || owner_pid == 0 ||
        !is_safe_token(fields[0], 16, 128) || !is_safe_token(fields[2], 1, 128) ||
        !is_safe_token(fields[3], 1, 32) || !is_safe_token(fields[4], 1, 128)) {
      CloseHandle(existing);
      CloseHandle(parent);
      throw GuardError("UNSAFE_ENTRY");
    }
    const auto process_identity = process_start_identity(static_cast<DWORD>(owner_pid));
    if (!process_identity.has_value()) {
      CloseHandle(existing);
      CloseHandle(parent);
      throw GuardError("UNSAFE_ENTRY");
    }
    if (*process_identity == fields[2]) {
      CloseHandle(existing);
      CloseHandle(parent);
      throw GuardError("CONFLICT");
    }
    set_disposition(existing);
    CloseHandle(existing);
  }
  CloseHandle(parent);
  throw GuardError("CONFLICT");
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
    const unsigned long pid = std::strtoul(arguments[0].c_str(), &end, 10);
    if (end == arguments[0].c_str() || *end != '\0' || pid == 0) {
      throw GuardError("INVALID_INPUT");
    }
    const auto identity = process_start_identity(static_cast<DWORD>(pid));
    if (!identity.has_value() || identity->empty()) throw GuardError("UNSAFE_ENTRY");
    return {*identity};
  }
  if (command == "INIT") {
    if (arguments.size() != 2 || arguments[0] != "win32") throw GuardError("UNSUPPORTED");
    Lease root = initialize_root(arguments[1]);
    const std::string identity = identity_string(root.handle, root.parent, root.mode);
    const std::string token = add_lease(std::move(root));
    return {token, identity};
  }
  if (arguments.empty()) throw GuardError("INVALID_INPUT");
  if (command == "LOCK") {
    Lease& root = require_root(arguments[0]);
    const std::string token = acquire_lock(root, arguments);
    Lease& lock = require_lease(token);
    return {token, identity_string(lock.handle, lock.parent, lock.mode)};
  }
  if (command == "CREATE_STAGING") {
    if (arguments.size() != 4 ||
        (arguments[1] != "model" && arguments[1] != "runtime") ||
        !is_artifact_name(arguments[2]) || !is_safe_token(arguments[3], 16, 128)) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    HANDLE parent = open_namespace(root, L"staging");
    const std::wstring name = utf8_to_wide("stage-" + arguments[2] + "-" + arguments[3]);
    bool created = false;
    HANDLE directory = relative_open(parent, name, kDirectoryAccess,
                                     FILE_CREATE, kDirectoryOptions, created);
    if (directory == INVALID_HANDLE_VALUE) {
      CloseHandle(parent);
      throw GuardError("IO_FAILED");
    }
    apply_private_acl(directory);
    const std::string token = add_lease(Lease{directory, parent, LeaseKind::kDirectory,
        name, root.root_volume, 0700, false, {}});
    return {token, identity_string(directory, parent, 0700)};
  }
  if (command == "CREATE_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    char* end = nullptr;
    const unsigned long mode = std::strtoul(arguments[2].c_str(), &end, 10);
    if (end == arguments[2].c_str() || *end != '\0' || mode > 0777) {
      throw GuardError("INVALID_INPUT");
    }
    bool created = false;
    HANDLE file = relative_open(directory.handle, utf8_to_wide(arguments[1]),
                                kFileAccess, FILE_CREATE, kFileOptions, created);
    if (file == INVALID_HANDLE_VALUE) throw GuardError("IO_FAILED");
    apply_private_acl(file);
    HANDLE parent = duplicate_handle(directory.handle);
    const std::string token = add_lease(Lease{file, parent, LeaseKind::kFile,
        utf8_to_wide(arguments[1]), directory.root_volume,
        static_cast<unsigned int>(mode), false, {}});
    return {token, identity_string(file, parent, static_cast<unsigned int>(mode))};
  }
  if (command == "WRITE_FILE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& file = require_lease(arguments[0]);
    if (file.kind != LeaseKind::kFile) throw GuardError("INVALID_INPUT");
    write_all(file.handle, base64url_decode(arguments[1]));
    return {};
  }
  if (command == "SEAL_FILE") {
    if (arguments.size() != 1) throw GuardError("INVALID_INPUT");
    Lease& file = require_lease(arguments[0]);
    if (file.kind != LeaseKind::kFile || !FlushFileBuffers(file.handle)) {
      throw GuardError("IO_FAILED");
    }
    return {identity_string(file.handle, file.parent, file.mode)};
  }
  if (command == "LIST") {
    std::map<std::string, unsigned int> expected_modes;
    for (std::size_t index = 1; index < arguments.size(); ++index) {
      const auto expected = split(arguments[index], '|');
      if (expected.size() != 2 || !is_file_name(expected[0])) throw GuardError("INVALID_INPUT");
      char* end = nullptr;
      const unsigned long mode = std::strtoul(expected[1].c_str(), &end, 10);
      if (end == expected[1].c_str() || *end != '\0' || mode > 0777 ||
          !expected_modes.emplace(expected[0], static_cast<unsigned int>(mode)).second) {
        throw GuardError("INVALID_INPUT");
      }
    }
    return list_directory(require_lease(arguments[0]), expected_modes);
  }
  if (command == "LIST_NAMESPACE") {
    if (arguments.size() != 2 || (arguments[1] != "models" && arguments[1] != "runtimes")) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    HANDLE parent = open_namespace(root, utf8_to_wide(arguments[1]));
    std::vector<std::string> result;
    for (const std::wstring& name : directory_names(parent)) {
      HANDLE directory = INVALID_HANDLE_VALUE;
      try {
        bool created = false;
        directory = relative_open(parent, name, kDirectoryAccess,
                                  FILE_OPEN, kDirectoryOptions, created);
        if (directory == INVALID_HANDLE_VALUE ||
            stable_identity(directory).volume != root.root_volume) {
          throw GuardError("UNSAFE_ENTRY");
        }
        verify_private_acl(directory);
        CloseHandle(directory);
        result.push_back(wide_to_utf8(name));
      } catch (const GuardError&) {
        if (directory != INVALID_HANDLE_VALUE) CloseHandle(directory);
        result.push_back("unmanaged-entry");
      }
    }
    CloseHandle(parent);
    return result;
  }
  if (command == "OPEN_ARTIFACT") {
    if (arguments.size() != 3 ||
        (arguments[1] != "models" && arguments[1] != "runtimes") ||
        !is_artifact_name(arguments[2])) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    HANDLE parent = open_namespace(root, utf8_to_wide(arguments[1]));
    bool created = false;
    HANDLE directory = relative_open(parent, utf8_to_wide(arguments[2]),
                                     kDirectoryAccess, FILE_OPEN,
                                     kDirectoryOptions, created);
    if (directory == INVALID_HANDLE_VALUE) {
      CloseHandle(parent);
      return {"MISSING"};
    }
    verify_private_acl(directory);
    const std::string token = add_lease(Lease{directory, parent, LeaseKind::kDirectory,
        utf8_to_wide(arguments[2]), root.root_volume, 0700, false, {}});
    return {token, identity_string(directory, parent, 0700)};
  }
  if (command == "PROMOTE") {
    if (arguments.size() != 4 ||
        (arguments[2] != "models" && arguments[2] != "runtimes") ||
        !is_artifact_name(arguments[3])) {
      throw GuardError("INVALID_INPUT");
    }
    Lease& root = require_root(arguments[0]);
    Lease& staging = require_lease(arguments[1]);
    if (staging.kind != LeaseKind::kDirectory ||
        staging.root_volume != root.root_volume ||
        wide_to_utf8(staging.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    HANDLE destination = open_namespace(root, utf8_to_wide(arguments[2]));
    rename_handle(staging.handle, destination, utf8_to_wide(arguments[3]));
    const std::string result = identity_string(staging.handle, destination, 0700);
    CloseHandle(destination);
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
    if (artifact.kind != LeaseKind::kDirectory ||
        artifact.root_volume != root.root_volume ||
        wide_to_utf8(artifact.name) != arguments[3]) {
      throw GuardError("IDENTITY_CHANGED");
    }
    HANDLE destination = open_namespace(root, L"quarantine");
    const std::wstring name = utf8_to_wide("quarantine-" + arguments[3] + "-" + arguments[4]);
    rename_handle(artifact.handle, destination, name);
    HANDLE duplicate = duplicate_handle(artifact.handle);
    const std::string token = add_lease(Lease{duplicate, destination,
        LeaseKind::kDirectory, name, root.root_volume, 0700, false, {}});
    return {token, identity_string(duplicate, destination, 0700)};
  }
  if (command == "DELETE_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    if (directory.kind != LeaseKind::kDirectory ||
        wide_to_utf8(directory.name).rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    bool created = false;
    HANDLE file = relative_open(directory.handle, utf8_to_wide(arguments[1]),
                                kFileAccess, FILE_OPEN, kFileOptions, created);
    if (file == INVALID_HANDLE_VALUE) throw GuardError("IDENTITY_CHANGED");
    const auto expected = split(arguments[2], '|');
    const unsigned int mode = expected.size() == 7
                                  ? static_cast<unsigned int>(std::strtoul(expected[3].c_str(), nullptr, 10))
                                  : 0;
    if (expected.size() != 7 || identity_string(file, directory.handle, mode) != arguments[2]) {
      CloseHandle(file);
      throw GuardError("IDENTITY_CHANGED");
    }
    set_disposition(file);
    CloseHandle(file);
    return {};
  }
  if (command == "DELETE_STAGING_FILE") {
    if (arguments.size() != 3 || !is_file_name(arguments[1])) throw GuardError("INVALID_INPUT");
    Lease& directory = require_lease(arguments[0]);
    if (directory.kind != LeaseKind::kDirectory ||
        wide_to_utf8(directory.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    bool created = false;
    HANDLE file = relative_open(directory.handle, utf8_to_wide(arguments[1]),
                                kFileAccess, FILE_OPEN, kFileOptions, created);
    if (file == INVALID_HANDLE_VALUE) throw GuardError("IDENTITY_CHANGED");
    const auto expected = split(arguments[2], '|');
    const unsigned int mode = expected.size() == 7
                                  ? static_cast<unsigned int>(std::strtoul(expected[3].c_str(), nullptr, 10))
                                  : 0;
    if (expected.size() != 7 || identity_string(file, directory.handle, mode) != arguments[2]) {
      CloseHandle(file);
      throw GuardError("IDENTITY_CHANGED");
    }
    set_disposition(file);
    CloseHandle(file);
    return {};
  }
  if (command == "REMOVE_QUARANTINE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& root = require_root(arguments[0]);
    Lease& directory = require_lease(arguments[1]);
    if (directory.kind != LeaseKind::kDirectory ||
        directory.root_volume != root.root_volume ||
        wide_to_utf8(directory.name).rfind("quarantine-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    if (!directory_names(directory.handle).empty()) throw GuardError("UNSAFE_ENTRY");
    set_disposition(directory.handle);
    return {};
  }
  if (command == "REMOVE_STAGING") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& root = require_root(arguments[0]);
    Lease& directory = require_lease(arguments[1]);
    if (directory.kind != LeaseKind::kDirectory ||
        directory.root_volume != root.root_volume ||
        wide_to_utf8(directory.name).rfind("stage-", 0) != 0) {
      throw GuardError("INVALID_INPUT");
    }
    if (!directory_names(directory.handle).empty()) throw GuardError("UNSAFE_ENTRY");
    set_disposition(directory.handle);
    return {};
  }
  if (command == "REVALIDATE") {
    if (arguments.size() != 2) throw GuardError("INVALID_INPUT");
    Lease& lease = require_lease(arguments[0]);
    if (identity_string(lease.handle, lease.parent, lease.mode) != arguments[1]) {
      throw GuardError("IDENTITY_CHANGED");
    }
    bool created = false;
    HANDLE named = relative_open(lease.parent, lease.name,
                                 lease.kind == LeaseKind::kFile ? kFileAccess : kDirectoryAccess,
                                 FILE_OPEN,
                                 lease.kind == LeaseKind::kFile ? kFileOptions : kDirectoryOptions,
                                 created);
    if (named == INVALID_HANDLE_VALUE ||
        !same_identity(stable_identity(named), stable_identity(lease.handle))) {
      if (named != INVALID_HANDLE_VALUE) CloseHandle(named);
      throw GuardError("IDENTITY_CHANGED");
    }
    CloseHandle(named);
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
