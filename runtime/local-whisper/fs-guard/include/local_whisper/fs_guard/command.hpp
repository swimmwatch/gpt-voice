#pragma once

#include <string>
#include <variant>
#include <vector>

namespace local_whisper::fs_guard {

struct ProcessIdentityCommand {
  std::string process_id;
};
struct InitCommand {
  std::string platform;
  std::string root_path;
};
struct LockCommand {
  std::string root_token;
  std::string artifact_name;
  std::string instance_nonce;
  std::string process_id;
  std::string process_identity;
  std::string operation;
  std::string artifact_id;
};
struct CreateStagingCommand {
  std::string root_token;
  std::string artifact_kind;
  std::string artifact_name;
  std::string nonce;
};
struct CreateFileCommand {
  std::string directory_token;
  std::string file_name;
  std::string mode;
};
struct WriteFileCommand {
  std::string file_token;
  std::string encoded_bytes;
};
struct SealFileCommand {
  std::string file_token;
};
struct ListCommand {
  std::string directory_token;
  std::vector<std::string> expected_entries;
};
struct ListNamespaceCommand {
  std::string root_token;
  std::string namespace_name;
};
struct OpenArtifactCommand {
  std::string root_token;
  std::string namespace_name;
  std::string artifact_name;
};
struct PromoteCommand {
  std::string root_token;
  std::string staging_token;
  std::string namespace_name;
  std::string artifact_name;
};
struct QuarantineCommand {
  std::string root_token;
  std::string artifact_token;
  std::string namespace_name;
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
                 ListNamespaceCommand, OpenArtifactCommand, PromoteCommand, QuarantineCommand,
                 DeleteFileCommand, DeleteStagingFileCommand, RemoveQuarantineCommand,
                 RemoveStagingCommand, RevalidateCommand, ReleaseCommand>;

[[nodiscard]] Command parse_command(const std::string& name,
                                    const std::vector<std::string>& arguments);

} // namespace local_whisper::fs_guard
