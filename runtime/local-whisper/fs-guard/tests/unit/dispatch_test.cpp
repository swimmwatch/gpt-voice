#include "local_whisper/fs_guard/backend.hpp"

#include "fake_backend.hpp"

#include <gtest/gtest.h>

#include <string>
#include <utility>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

TEST(CommandDispatchTest, RoutesEveryVariantToTheInjectedBackend) {
  test::RecordingBackend backend;
  const std::vector<std::pair<Command, std::string>> cases = {
      {ProcessIdentityCommand{"1"}, "process_identity"},
      {InitCommand{"linux", "/tmp"}, "initialize"},
      {LockCommand{}, "lock"},
      {CreateStagingCommand{}, "create_staging"},
      {CreateFileCommand{}, "create_file"},
      {WriteFileCommand{}, "write_file"},
      {SealFileCommand{}, "seal_file"},
      {ListCommand{}, "list"},
      {ListNamespaceCommand{}, "list_namespace"},
      {OpenArtifactCommand{}, "open_artifact"},
      {PromoteCommand{}, "promote"},
      {QuarantineCommand{}, "quarantine"},
      {DeleteFileCommand{}, "delete_file"},
      {DeleteStagingFileCommand{}, "delete_staging_file"},
      {RemoveQuarantineCommand{}, "remove_quarantine"},
      {RemoveStagingCommand{}, "remove_staging"},
      {RevalidateCommand{}, "revalidate"},
      {ReleaseCommand{}, "release"},
  };

  for (const auto& [command, expected] : cases) {
    EXPECT_EQ(dispatch_command(backend, command), ResponseFields({expected}));
    EXPECT_EQ(backend.last_call(), expected);
  }
}

} // namespace
} // namespace local_whisper::fs_guard
