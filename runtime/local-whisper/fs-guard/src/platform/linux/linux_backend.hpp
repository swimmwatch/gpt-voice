#pragma once

#include "local_whisper/fs_guard/backend.hpp"
#include "platform/resource_failure_injector.hpp"

#include <memory>

namespace local_whisper::fs_guard {

class LinuxBackend final : public Backend {
public:
  LinuxBackend();
  explicit LinuxBackend(ResourceFailureInjector& failure_injector);
  ~LinuxBackend() override;

  LinuxBackend(const LinuxBackend&) = delete;
  LinuxBackend& operator=(const LinuxBackend&) = delete;
  LinuxBackend(LinuxBackend&&) noexcept;
  LinuxBackend& operator=(LinuxBackend&&) noexcept;

  ResponseFields process_identity(const ProcessIdentityCommand& command) override;
  ResponseFields initialize(const InitCommand& command) override;
  ResponseFields lock(const LockCommand& command) override;
  ResponseFields create_staging(const CreateStagingCommand& command) override;
  ResponseFields create_file(const CreateFileCommand& command) override;
  ResponseFields write_file(const WriteFileCommand& command) override;
  ResponseFields seal_file(const SealFileCommand& command) override;
  ResponseFields list(const ListCommand& command) override;
  ResponseFields list_metadata(const ListMetadataCommand& command) override;
  ResponseFields list_namespace(const ListNamespaceCommand& command) override;
  ResponseFields open_artifact(const OpenArtifactCommand& command) override;
  ResponseFields promote(const PromoteCommand& command) override;
  ResponseFields quarantine(const QuarantineCommand& command) override;
  ResponseFields delete_file(const DeleteFileCommand& command) override;
  ResponseFields delete_staging_file(const DeleteStagingFileCommand& command) override;
  ResponseFields remove_quarantine(const RemoveQuarantineCommand& command) override;
  ResponseFields remove_staging(const RemoveStagingCommand& command) override;
  ResponseFields revalidate(const RevalidateCommand& command) override;
  ResponseFields release(const ReleaseCommand& command) override;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace local_whisper::fs_guard
