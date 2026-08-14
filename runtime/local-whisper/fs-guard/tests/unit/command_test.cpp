#include "local_whisper/fs_guard/command.hpp"

#include "local_whisper/fs_guard/error.hpp"

#include <gtest/gtest.h>

#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

const std::string kArtifactName = "model-" + std::string(64, 'a');

TEST(CommandParserTest, ParsesEverySupportedCommand) {
  const std::vector<std::pair<std::string, std::vector<std::string>>> cases = {
      {"PROCESS_IDENTITY", {"1"}},
      {"INIT", {"linux", "/tmp/example"}},
      {"LOCK",
       {"root", kArtifactName, "1234567890abcdef", "1", "identity", "staging", kArtifactName}},
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
  EXPECT_THROW(static_cast<void>(parse_command("PROCESS_IDENTITY", {"4294967296"})), GuardError);
  EXPECT_THROW(
      static_cast<void>(parse_command("LOCK", {"root", kArtifactName, "1234567890abcdef", "1",
                                               "identity", "download", kArtifactName})),
      GuardError);
  EXPECT_THROW(
      static_cast<void>(parse_command("LIST", {"directory", "file-model|384", "file-model|384"})),
      GuardError);
  EXPECT_THROW(static_cast<void>(parse_command("LIST", {"directory", "file-model|invalid"})),
               GuardError);
}

TEST(CommandParserTest, ConvertsWireValuesToClosedDomainsBeforeDispatch) {
  const Command create = parse_command("CREATE_FILE", {"directory", "file-model", "384"});
  const auto& create_command = std::get<CreateFileCommand>(create);
  EXPECT_EQ(create_command.mode.value(), 384U);

  const Command write = parse_command("WRITE_FILE", {"file", "aGVsbG8"});
  EXPECT_EQ(std::get<WriteFileCommand>(write).bytes, "hello");

  const Command list = parse_command("LIST", {"directory", "file-model|384"});
  const auto& list_command = std::get<ListCommand>(list);
  ASSERT_EQ(list_command.expected_entries.size(), 1U);
  EXPECT_EQ(list_command.expected_entries[0].name, "file-model");
  EXPECT_EQ(list_command.expected_entries[0].mode.value(), 384U);
}

TEST(CommandParserTest, AcceptsOnlyCanonicalLinuxRuntimeLaunchFileNames) {
  for (const char* name : {"worker", "libcudart.so.12", "libcublas.so.12", "libcublasLt.so.12"}) {
    EXPECT_NO_THROW(static_cast<void>(parse_command("CREATE_FILE", {"directory", name, "384"})))
        << name;
  }
  for (const char* name :
       {"libcuda.so.1", "libcudart.so.", "libcublas.so.012", "libcublasLt.so.12.1"}) {
    EXPECT_THROW(static_cast<void>(parse_command("CREATE_FILE", {"directory", name, "384"})),
                 GuardError)
        << name;
  }
}

TEST(CommandParserTest, AcceptsOnlyCanonicalWindowsRuntimeLaunchFileNames) {
  for (const char* name :
       {"worker.exe", "msvcp140.dll", "msvcp140_atomic_wait.dll", "vcruntime140.dll",
        "vcruntime140_1.dll", "cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll"}) {
    EXPECT_NO_THROW(static_cast<void>(parse_command("CREATE_FILE", {"directory", name, "0"})))
        << name;
  }
  for (const char* name :
       {"worker.com", "msvcp140d.dll", "msvcp140_atomic_waitd.dll", "vcruntime140_2.dll",
        "cudart64_13.dll", "cublas64_11.dll", "cublaslt64_12.dll"}) {
    EXPECT_THROW(static_cast<void>(parse_command("CREATE_FILE", {"directory", name, "0"})),
                 GuardError)
        << name;
  }
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
