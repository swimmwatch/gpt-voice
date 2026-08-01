#include "local_whisper/fs_guard/command.hpp"

#include "local_whisper/fs_guard/error.hpp"

#include <gtest/gtest.h>

#include <string>
#include <utility>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

const std::string kArtifactName = "model-" + std::string(64, 'a');

TEST(CommandParserTest, ParsesEverySupportedCommand) {
  const std::vector<std::pair<std::string, std::vector<std::string>>> cases = {
      {"PROCESS_IDENTITY", {"1"}},
      {"INIT", {"linux", "/tmp/example"}},
      {"LOCK",
       {"root", kArtifactName, "1234567890abcdef", "1", "identity", "download", kArtifactName}},
      {"CREATE_STAGING", {"root", "model", kArtifactName, "1234567890abcdef"}},
      {"CREATE_FILE", {"directory", "file-model", "384"}},
      {"WRITE_FILE", {"file", "aGVsbG8"}},
      {"SEAL_FILE", {"file"}},
      {"LIST", {"directory", "file-model|384"}},
      {"LIST_NAMESPACE", {"root", "models"}},
      {"OPEN_ARTIFACT", {"root", "models", kArtifactName}},
      {"PROMOTE", {"root", "staging", "models", kArtifactName}},
      {"QUARANTINE", {"root", "artifact", "models", kArtifactName, "1234567890abcdef"}},
      {"DELETE_FILE", {"directory", "file-model", "identity"}},
      {"DELETE_STAGING_FILE", {"directory", "file-model", "identity"}},
      {"REMOVE_QUARANTINE", {"root", "directory"}},
      {"REMOVE_STAGING", {"root", "directory"}},
      {"REVALIDATE", {"token", "identity"}},
      {"RELEASE", {"token"}},
  };

  for (const auto& [name, arguments] : cases) {
    EXPECT_NO_THROW(static_cast<void>(parse_command(name, arguments))) << name;
  }
}

TEST(CommandParserTest, RejectsUnknownCommandsAndInvalidValues) {
  EXPECT_THROW(static_cast<void>(parse_command("UNKNOWN", {})), GuardError);
  EXPECT_THROW(static_cast<void>(parse_command("PROCESS_IDENTITY", {"0"})), GuardError);
  EXPECT_THROW(static_cast<void>(parse_command("INIT", {"darwin", "/tmp"})), GuardError);
  EXPECT_THROW(
      static_cast<void>(parse_command("CREATE_STAGING", {"root", "model", "../escape", "short"})),
      GuardError);
  EXPECT_THROW(static_cast<void>(parse_command("CREATE_FILE", {"directory", "../file", "511"})),
               GuardError);
  EXPECT_THROW(static_cast<void>(parse_command("LIST_NAMESPACE", {"root", "staging"})), GuardError);
}

TEST(CommandParserTest, RejectsWrongArgumentCountsForEveryCommand) {
  for (const char* name : {"PROCESS_IDENTITY", "INIT", "LOCK", "CREATE_STAGING", "CREATE_FILE",
                           "WRITE_FILE", "SEAL_FILE", "LIST", "LIST_NAMESPACE", "OPEN_ARTIFACT",
                           "PROMOTE", "QUARANTINE", "DELETE_FILE", "DELETE_STAGING_FILE",
                           "REMOVE_QUARANTINE", "REMOVE_STAGING", "REVALIDATE", "RELEASE"}) {
    EXPECT_THROW(static_cast<void>(parse_command(name, {})), GuardError) << name;
  }
}

} // namespace
} // namespace local_whisper::fs_guard
