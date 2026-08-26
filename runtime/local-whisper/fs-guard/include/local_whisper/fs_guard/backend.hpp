#pragma once

#include "local_whisper/fs_guard/command.hpp"

#include <cstddef>
#include <string>
#include <vector>

namespace local_whisper::fs_guard {

using ResponseFields = std::vector<std::string>;

// Every platform retains the same bounded number of native-resource leases.
inline constexpr std::size_t kMaxLiveLeases = 64;

class Backend {
public:
  virtual ~Backend() = default;

  virtual ResponseFields process_identity(const ProcessIdentityCommand& command) = 0;
  virtual ResponseFields initialize(const InitCommand& command) = 0;
  virtual ResponseFields lock(const LockCommand& command) = 0;
  virtual ResponseFields create_staging(const CreateStagingCommand& command) = 0;
  virtual ResponseFields create_file(const CreateFileCommand& command) = 0;
  virtual ResponseFields write_file(const WriteFileCommand& command) = 0;
  virtual ResponseFields seal_file(const SealFileCommand& command) = 0;
  virtual ResponseFields list(const ListCommand& command) = 0;
  virtual ResponseFields list_metadata(const ListMetadataCommand& command) = 0;
  virtual ResponseFields list_namespace(const ListNamespaceCommand& command) = 0;
  virtual ResponseFields open_artifact(const OpenArtifactCommand& command) = 0;
  virtual ResponseFields promote(const PromoteCommand& command) = 0;
  virtual ResponseFields quarantine(const QuarantineCommand& command) = 0;
  virtual ResponseFields delete_file(const DeleteFileCommand& command) = 0;
  virtual ResponseFields delete_staging_file(const DeleteStagingFileCommand& command) = 0;
  virtual ResponseFields remove_quarantine(const RemoveQuarantineCommand& command) = 0;
  virtual ResponseFields remove_staging(const RemoveStagingCommand& command) = 0;
  virtual ResponseFields revalidate(const RevalidateCommand& command) = 0;
  virtual ResponseFields release(const ReleaseCommand& command) = 0;
};

[[nodiscard]] ResponseFields dispatch_command(Backend& backend, const Command& command);

} // namespace local_whisper::fs_guard
