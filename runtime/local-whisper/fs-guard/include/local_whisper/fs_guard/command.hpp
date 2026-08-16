#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace local_whisper::fs_guard {

class Platform final {
public:
  enum class Value { kLinux, kWindows };

  Platform() noexcept = default;
  Platform(Value value) noexcept;
  Platform(const char* value);
  Platform(const std::string& value);
  Platform(std::string_view value);

  [[nodiscard]] Value value() const noexcept;
  [[nodiscard]] std::string_view text() const noexcept;

private:
  Value value_ = Value::kLinux;
};

class ArtifactKind final {
public:
  enum class Value { kModel, kRuntime };

  ArtifactKind() noexcept = default;
  ArtifactKind(Value value) noexcept;
  ArtifactKind(const char* value);
  ArtifactKind(const std::string& value);
  ArtifactKind(std::string_view value);

  [[nodiscard]] Value value() const noexcept;
  [[nodiscard]] std::string_view text() const noexcept;

private:
  Value value_ = Value::kModel;
};

class ArtifactNamespace final {
public:
  enum class Value { kModels, kRuntimes };

  ArtifactNamespace() noexcept = default;
  ArtifactNamespace(Value value) noexcept;
  ArtifactNamespace(const char* value);
  ArtifactNamespace(const std::string& value);
  ArtifactNamespace(std::string_view value);

  [[nodiscard]] Value value() const noexcept;
  [[nodiscard]] std::string_view text() const noexcept;

private:
  Value value_ = Value::kModels;
};

class LeaseOperation final {
public:
  enum class Value { kDelete, kIntegrity, kLoad, kPromote, kQuarantine, kStaging, kVerify };

  LeaseOperation() noexcept = default;
  LeaseOperation(Value value) noexcept;
  LeaseOperation(const char* value);
  LeaseOperation(const std::string& value);
  LeaseOperation(std::string_view value);

  [[nodiscard]] Value value() const noexcept;
  [[nodiscard]] std::string_view text() const noexcept;

private:
  Value value_ = Value::kDelete;
};

class ProcessId final {
public:
  ProcessId() noexcept = default;
  ProcessId(std::uint32_t value);
  ProcessId(const char* value);
  ProcessId(const std::string& value);
  ProcessId(std::string_view value);

  [[nodiscard]] std::uint32_t value() const noexcept;
  [[nodiscard]] std::string text() const;

private:
  std::uint32_t value_ = 1U;
};

class FileMode final {
public:
  FileMode() noexcept = default;
  FileMode(unsigned int value);
  FileMode(const char* value);
  FileMode(const std::string& value);
  FileMode(std::string_view value);

  [[nodiscard]] unsigned int value() const noexcept;

private:
  unsigned int value_ = 0U;
};

struct ExpectedEntry final {
  std::string name;
  FileMode mode;

  ExpectedEntry(std::string name, FileMode mode);
  ExpectedEntry(const char* encoded);
  ExpectedEntry(const std::string& encoded);
};

struct ProcessIdentityCommand {
  ProcessId process_id;
};
struct InitCommand {
  Platform platform;
  std::string root_path;
};
struct LockCommand {
  std::string root_token;
  std::string artifact_name;
  std::string instance_nonce;
  ProcessId process_id;
  std::string process_identity;
  LeaseOperation operation;
  std::string artifact_id;
};
struct CreateStagingCommand {
  std::string root_token;
  ArtifactKind artifact_kind;
  std::string artifact_name;
  std::string nonce;
};
struct CreateFileCommand {
  std::string directory_token;
  std::string file_name;
  FileMode mode;
};
struct WriteFileCommand {
  std::string file_token;
  std::string bytes;
};
struct SealFileCommand {
  std::string file_token;
};
struct ListCommand {
  std::string directory_token;
  std::vector<ExpectedEntry> expected_entries;
};
struct ListMetadataCommand {
  std::string directory_token;
  std::vector<ExpectedEntry> expected_entries;
};
struct ListNamespaceCommand {
  std::string root_token;
  ArtifactNamespace namespace_name;
};
struct OpenArtifactCommand {
  std::string root_token;
  ArtifactNamespace namespace_name;
  std::string artifact_name;
};
struct PromoteCommand {
  std::string root_token;
  std::string staging_token;
  ArtifactNamespace namespace_name;
  std::string artifact_name;
};
struct QuarantineCommand {
  std::string root_token;
  std::string artifact_token;
  ArtifactNamespace namespace_name;
  std::string artifact_name;
  std::string nonce;
};
struct DeleteFileCommand {
  std::string directory_token;
  std::string file_name;
  std::string identity;
};
struct DeleteStagingFileCommand {
  std::string directory_token;
  std::string file_name;
  std::string identity;
};
struct RemoveQuarantineCommand {
  std::string root_token;
  std::string directory_token;
};
struct RemoveStagingCommand {
  std::string root_token;
  std::string directory_token;
};
struct RevalidateCommand {
  std::string token;
  std::string identity;
};
struct ReleaseCommand {
  std::string token;
};

using Command =
    std::variant<ProcessIdentityCommand, InitCommand, LockCommand, CreateStagingCommand,
                 CreateFileCommand, WriteFileCommand, SealFileCommand, ListCommand,
                 ListMetadataCommand, ListNamespaceCommand, OpenArtifactCommand, PromoteCommand,
                 QuarantineCommand, DeleteFileCommand, DeleteStagingFileCommand,
                 RemoveQuarantineCommand, RemoveStagingCommand, RevalidateCommand, ReleaseCommand>;

[[nodiscard]] Command parse_command(const std::string& name, std::vector<std::string> arguments);

} // namespace local_whisper::fs_guard
