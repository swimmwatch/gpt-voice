#pragma once

#include "local_whisper/fs_guard/backend.hpp"

#include <string>

namespace local_whisper::fs_guard::test {

class RecordingBackend final : public Backend {
public:
  [[nodiscard]] const std::string& last_call() const noexcept { return last_call_; }
  [[nodiscard]] const std::string& last_write_bytes() const noexcept { return last_write_bytes_; }

#define FS_GUARD_RECORD(method, type)                                                              \
  ResponseFields method(const type&) override {                                                    \
    last_call_ = #method;                                                                          \
    return {last_call_};                                                                           \
  }

  FS_GUARD_RECORD(process_identity, ProcessIdentityCommand)
  FS_GUARD_RECORD(initialize, InitCommand)
  FS_GUARD_RECORD(lock, LockCommand)
  FS_GUARD_RECORD(create_staging, CreateStagingCommand)
  FS_GUARD_RECORD(create_file, CreateFileCommand)
  FS_GUARD_RECORD(seal_file, SealFileCommand)
  FS_GUARD_RECORD(list, ListCommand)
  FS_GUARD_RECORD(list_metadata, ListMetadataCommand)
  FS_GUARD_RECORD(list_namespace, ListNamespaceCommand)
  FS_GUARD_RECORD(open_artifact, OpenArtifactCommand)
  FS_GUARD_RECORD(promote, PromoteCommand)
  FS_GUARD_RECORD(quarantine, QuarantineCommand)
  FS_GUARD_RECORD(delete_file, DeleteFileCommand)
  FS_GUARD_RECORD(delete_staging_file, DeleteStagingFileCommand)
  FS_GUARD_RECORD(remove_quarantine, RemoveQuarantineCommand)
  FS_GUARD_RECORD(remove_staging, RemoveStagingCommand)
  FS_GUARD_RECORD(revalidate, RevalidateCommand)
  FS_GUARD_RECORD(release, ReleaseCommand)

#undef FS_GUARD_RECORD

  ResponseFields write_file(const WriteFileCommand& command) override {
    last_call_ = "write_file";
    last_write_bytes_ = command.bytes;
    return {last_call_};
  }

private:
  std::string last_call_;
  std::string last_write_bytes_;
};

} // namespace local_whisper::fs_guard::test
