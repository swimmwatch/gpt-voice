#include "local_whisper/fs_guard/command.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"
#include "local_whisper/fs_guard/validation.hpp"

#include <charconv>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <set>
#include <utility>

namespace local_whisper::fs_guard {
namespace {

[[noreturn]] void invalid_input() { throw GuardError(ErrorCode::kInvalidInput); }

void require_count(const std::vector<std::string>& arguments, const std::size_t count) {
  if (arguments.size() != count)
    invalid_input();
}

[[noreturn]] void unsupported() { throw GuardError(ErrorCode::kUnsupported); }

std::uint32_t parse_process_id(const std::string_view value) {
  if (!is_positive_decimal(value))
    invalid_input();
  std::uint64_t parsed = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), parsed);
  if (error != std::errc{} || end != value.data() + value.size() ||
      parsed > std::numeric_limits<std::uint32_t>::max()) {
    invalid_input();
  }
  return static_cast<std::uint32_t>(parsed);
}

unsigned int parse_mode(const std::string_view value) {
  if (!is_mode(value))
    invalid_input();
  unsigned int parsed = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), parsed);
  if (error != std::errc{} || end != value.data() + value.size())
    invalid_input();
  return parsed;
}

} // namespace

Platform::Platform(const Value value) noexcept : value_(value) {}

Platform::Platform(const char* value) : Platform(std::string_view(value)) {}

Platform::Platform(const std::string& value) : Platform(std::string_view(value)) {}

Platform::Platform(const std::string_view value) {
  if (value == "linux") {
    value_ = Value::kLinux;
  } else if (value == "win32") {
    value_ = Value::kWindows;
  } else {
    unsupported();
  }
}

Platform::Value Platform::value() const noexcept { return value_; }

std::string_view Platform::text() const noexcept {
  return value_ == Value::kLinux ? "linux" : "win32";
}

ArtifactKind::ArtifactKind(const Value value) noexcept : value_(value) {}

ArtifactKind::ArtifactKind(const char* value) : ArtifactKind(std::string_view(value)) {}

ArtifactKind::ArtifactKind(const std::string& value) : ArtifactKind(std::string_view(value)) {}

ArtifactKind::ArtifactKind(const std::string_view value) {
  if (value == "model") {
    value_ = Value::kModel;
  } else if (value == "runtime") {
    value_ = Value::kRuntime;
  } else {
    invalid_input();
  }
}

ArtifactKind::Value ArtifactKind::value() const noexcept { return value_; }

std::string_view ArtifactKind::text() const noexcept {
  return value_ == Value::kModel ? "model" : "runtime";
}

ArtifactNamespace::ArtifactNamespace(const Value value) noexcept : value_(value) {}

ArtifactNamespace::ArtifactNamespace(const char* value)
    : ArtifactNamespace(std::string_view(value)) {}

ArtifactNamespace::ArtifactNamespace(const std::string& value)
    : ArtifactNamespace(std::string_view(value)) {}

ArtifactNamespace::ArtifactNamespace(const std::string_view value) {
  if (value == "models") {
    value_ = Value::kModels;
  } else if (value == "runtimes") {
    value_ = Value::kRuntimes;
  } else {
    invalid_input();
  }
}

ArtifactNamespace::Value ArtifactNamespace::value() const noexcept { return value_; }

std::string_view ArtifactNamespace::text() const noexcept {
  return value_ == Value::kModels ? "models" : "runtimes";
}

LeaseOperation::LeaseOperation(const Value value) noexcept : value_(value) {}

LeaseOperation::LeaseOperation(const char* value) : LeaseOperation(std::string_view(value)) {}

LeaseOperation::LeaseOperation(const std::string& value)
    : LeaseOperation(std::string_view(value)) {}

LeaseOperation::LeaseOperation(const std::string_view value) {
  if (value == "delete") {
    value_ = Value::kDelete;
  } else if (value == "integrity") {
    value_ = Value::kIntegrity;
  } else if (value == "load") {
    value_ = Value::kLoad;
  } else if (value == "promote") {
    value_ = Value::kPromote;
  } else if (value == "quarantine") {
    value_ = Value::kQuarantine;
  } else if (value == "staging") {
    value_ = Value::kStaging;
  } else if (value == "verify") {
    value_ = Value::kVerify;
  } else {
    invalid_input();
  }
}

LeaseOperation::Value LeaseOperation::value() const noexcept { return value_; }

std::string_view LeaseOperation::text() const noexcept {
  switch (value_) {
  case Value::kDelete:
    return "delete";
  case Value::kIntegrity:
    return "integrity";
  case Value::kLoad:
    return "load";
  case Value::kPromote:
    return "promote";
  case Value::kQuarantine:
    return "quarantine";
  case Value::kStaging:
    return "staging";
  case Value::kVerify:
    return "verify";
  }
  return {};
}

ProcessId::ProcessId(const std::uint32_t value) : value_(value) {
  if (value == 0U)
    invalid_input();
}

ProcessId::ProcessId(const char* value) : ProcessId(std::string_view(value)) {}

ProcessId::ProcessId(const std::string& value) : ProcessId(std::string_view(value)) {}

ProcessId::ProcessId(const std::string_view value) : value_(parse_process_id(value)) {}

std::uint32_t ProcessId::value() const noexcept { return value_; }

std::string ProcessId::text() const { return std::to_string(value_); }

FileMode::FileMode(const unsigned int value) : value_(value) {
  if (value > 0777U)
    invalid_input();
}

FileMode::FileMode(const char* value) : FileMode(std::string_view(value)) {}

FileMode::FileMode(const std::string& value) : FileMode(std::string_view(value)) {}

FileMode::FileMode(const std::string_view value) : value_(parse_mode(value)) {}

unsigned int FileMode::value() const noexcept { return value_; }

ExpectedEntry::ExpectedEntry(std::string entry_name, const FileMode entry_mode)
    : name(std::move(entry_name)), mode(entry_mode) {}

ExpectedEntry::ExpectedEntry(const char* encoded) : ExpectedEntry(std::string(encoded)) {}

ExpectedEntry::ExpectedEntry(const std::string& encoded) {
  const auto fields = split(encoded, '|');
  if (fields.size() != 2 || !is_file_name(fields[0]))
    invalid_input();
  name = fields[0];
  mode = FileMode(fields[1]);
}

Command parse_command(const std::string& name, const std::vector<std::string>& arguments) {
  if (name == "PROCESS_IDENTITY") {
    require_count(arguments, 1);
    return ProcessIdentityCommand{arguments[0]};
  }
  if (name == "INIT") {
    require_count(arguments, 2);
    return InitCommand{arguments[0], arguments[1]};
  }
  if (name == "LOCK") {
    require_count(arguments, 7);
    if (!is_artifact_name(arguments[1]) || !is_safe_token(arguments[2], 16, 128) ||
        !is_safe_token(arguments[4], 1, 128) || !is_safe_token(arguments[6], 1, 128)) {
      invalid_input();
    }
    return LockCommand{arguments[0], arguments[1], arguments[2], arguments[3],
                       arguments[4], arguments[5], arguments[6]};
  }
  if (name == "CREATE_STAGING") {
    require_count(arguments, 4);
    if (!is_artifact_name(arguments[2]) || !is_safe_token(arguments[3], 16, 128)) {
      invalid_input();
    }
    return CreateStagingCommand{arguments[0], arguments[1], arguments[2], arguments[3]};
  }
  if (name == "CREATE_FILE") {
    require_count(arguments, 3);
    if (!is_file_name(arguments[1]))
      invalid_input();
    return CreateFileCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "WRITE_FILE") {
    require_count(arguments, 2);
    return WriteFileCommand{arguments[0], base64url_decode(arguments[1])};
  }
  if (name == "SEAL_FILE") {
    require_count(arguments, 1);
    return SealFileCommand{arguments[0]};
  }
  if (name == "LIST") {
    if (arguments.empty())
      invalid_input();
    std::vector<ExpectedEntry> expected;
    expected.reserve(arguments.size() - 1);
    std::set<std::string> names;
    for (std::size_t index = 1; index < arguments.size(); ++index) {
      const auto& entry = arguments[index];
      const auto fields = split(entry, '|');
      if (fields.size() != 2 || !is_file_name(fields[0]) || !names.insert(fields[0]).second)
        invalid_input();
      expected.push_back({std::move(fields[0]), FileMode(fields[1])});
    }
    return ListCommand{arguments[0], std::move(expected)};
  }
  if (name == "LIST_NAMESPACE") {
    require_count(arguments, 2);
    return ListNamespaceCommand{arguments[0], arguments[1]};
  }
  if (name == "OPEN_ARTIFACT") {
    require_count(arguments, 3);
    if (!is_artifact_name(arguments[2])) {
      invalid_input();
    }
    return OpenArtifactCommand{arguments[0], arguments[1], arguments[2]};
  }
  if (name == "PROMOTE") {
    require_count(arguments, 4);
    if (!is_artifact_name(arguments[3])) {
      invalid_input();
    }
    return PromoteCommand{arguments[0], arguments[1], arguments[2], arguments[3]};
  }
  if (name == "QUARANTINE") {
    require_count(arguments, 5);
    if (!is_artifact_name(arguments[3]) || !is_safe_token(arguments[4], 16, 128)) {
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
