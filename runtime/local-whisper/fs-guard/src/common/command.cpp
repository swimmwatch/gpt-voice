#include "local_whisper/fs_guard/command.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/validation.hpp"

#include <cstddef>
#include <utility>

namespace local_whisper::fs_guard {
namespace {

[[noreturn]] void invalid_input() { throw GuardError(ErrorCode::kInvalidInput); }

void require_count(const std::vector<std::string>& arguments, const std::size_t count) {
  if (arguments.size() != count)
    invalid_input();
}

bool is_namespace(const std::string& value) { return value == "models" || value == "runtimes"; }

} // namespace

Command parse_command(const std::string& name, const std::vector<std::string>& arguments) {
  if (name == "PROCESS_IDENTITY") {
    require_count(arguments, 1);
    if (!is_positive_decimal(arguments[0]))
      invalid_input();
    return ProcessIdentityCommand{arguments[0]};
  }
  if (name == "INIT") {
    require_count(arguments, 2);
    if (arguments[0] != "linux" && arguments[0] != "win32") {
      throw GuardError(ErrorCode::kUnsupported);
    }
    return InitCommand{arguments[0], arguments[1]};
  }
  if (name == "LOCK") {
    require_count(arguments, 7);
    if (!is_artifact_name(arguments[1]) || !is_safe_token(arguments[2], 16, 128) ||
        !is_positive_decimal(arguments[3]) || !is_safe_token(arguments[4], 1, 128) ||
        !is_safe_token(arguments[5], 1, 32) || !is_safe_token(arguments[6], 1, 128)) {
      invalid_input();
    }
    return LockCommand{arguments[0], arguments[1], arguments[2], arguments[3],
                       arguments[4], arguments[5], arguments[6]};
  }
  if (name == "CREATE_STAGING") {
    require_count(arguments, 4);
    if ((arguments[1] != "model" && arguments[1] != "runtime") || !is_artifact_name(arguments[2]) ||
        !is_safe_token(arguments[3], 16, 128)) {
      invalid_input();
    }
    return CreateStagingCommand{arguments[0], arguments[1], arguments[2], arguments[3]};
  }
  if (name == "CREATE_FILE") {
    require_count(arguments, 3);
    if (!is_file_name(arguments[1]) || !is_mode(arguments[2]))
      invalid_input();
    return CreateFileCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "WRITE_FILE") {
    require_count(arguments, 2);
    return WriteFileCommand{arguments[0], arguments[1]};
  }
  if (name == "SEAL_FILE") {
    require_count(arguments, 1);
    return SealFileCommand{arguments[0]};
  }
  if (name == "LIST") {
    if (arguments.empty())
      invalid_input();
    std::vector<std::string> expected(arguments.begin() + 1, arguments.end());
    for (const auto& entry : expected) {
      const auto fields = split(entry, '|');
      if (fields.size() != 2 || !is_file_name(fields[0]))
        invalid_input();
    }
    return ListCommand{arguments[0], std::move(expected)};
  }
  if (name == "LIST_NAMESPACE") {
    require_count(arguments, 2);
    if (!is_namespace(arguments[1]))
      invalid_input();
    return ListNamespaceCommand{arguments[0], arguments[1]};
  }
  if (name == "OPEN_ARTIFACT") {
    require_count(arguments, 3);
    if (!is_namespace(arguments[1]) || !is_artifact_name(arguments[2])) {
      invalid_input();
    }
    return OpenArtifactCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "PROMOTE") {
    require_count(arguments, 4);
    if (!is_namespace(arguments[2]) || !is_artifact_name(arguments[3])) {
      invalid_input();
    }
    return PromoteCommand{arguments[0], arguments[1], arguments[2], arguments[3]};
  }
  if (name == "QUARANTINE") {
    require_count(arguments, 5);
    if (!is_namespace(arguments[2]) || !is_artifact_name(arguments[3]) ||
        !is_safe_token(arguments[4], 16, 128)) {
      invalid_input();
    }
    return QuarantineCommand{arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]};
  }
  if (name == "DELETE_FILE") {
    require_count(arguments, 3);
    if (!is_file_name(arguments[1]))
      invalid_input();
    return DeleteFileCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "DELETE_STAGING_FILE") {
    require_count(arguments, 3);
    if (!is_file_name(arguments[1]))
      invalid_input();
    return DeleteStagingFileCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "REMOVE_QUARANTINE") {
    require_count(arguments, 2);
    return RemoveQuarantineCommand{arguments[0], arguments[1]};
  }
  if (name == "REMOVE_STAGING") {
    require_count(arguments, 2);
    return RemoveStagingCommand{arguments[0], arguments[1]};
  }
  if (name == "REVALIDATE") {
    require_count(arguments, 2);
    return RevalidateCommand{arguments[0], arguments[1]};
  }
  if (name == "RELEASE") {
    require_count(arguments, 1);
    return ReleaseCommand{arguments[0]};
  }
  invalid_input();
}

} // namespace local_whisper::fs_guard
