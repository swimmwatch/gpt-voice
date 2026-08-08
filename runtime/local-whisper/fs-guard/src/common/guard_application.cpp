#include "local_whisper/fs_guard/guard_application.hpp"

#include "local_whisper/fs_guard/backend.hpp"
#include "local_whisper/fs_guard/bounded_line_reader.hpp"
#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"

#include <istream>
#include <ostream>
#include <string>
#include <type_traits>
#include <variant>

namespace local_whisper::fs_guard {

ResponseFields dispatch_command(Backend& backend, const Command& command) {
  return std::visit(
      [&backend](const auto& typed_command) -> ResponseFields {
        using T = std::decay_t<decltype(typed_command)>;
        if constexpr (std::is_same_v<T, ProcessIdentityCommand>) {
          return backend.process_identity(typed_command);
        } else if constexpr (std::is_same_v<T, InitCommand>) {
          return backend.initialize(typed_command);
        } else if constexpr (std::is_same_v<T, LockCommand>) {
          return backend.lock(typed_command);
        } else if constexpr (std::is_same_v<T, CreateStagingCommand>) {
          return backend.create_staging(typed_command);
        } else if constexpr (std::is_same_v<T, CreateFileCommand>) {
          return backend.create_file(typed_command);
        } else if constexpr (std::is_same_v<T, WriteFileCommand>) {
          return backend.write_file(typed_command);
        } else if constexpr (std::is_same_v<T, SealFileCommand>) {
          return backend.seal_file(typed_command);
        } else if constexpr (std::is_same_v<T, ListCommand>) {
          return backend.list(typed_command);
        } else if constexpr (std::is_same_v<T, ListNamespaceCommand>) {
          return backend.list_namespace(typed_command);
        } else if constexpr (std::is_same_v<T, OpenArtifactCommand>) {
          return backend.open_artifact(typed_command);
        } else if constexpr (std::is_same_v<T, PromoteCommand>) {
          return backend.promote(typed_command);
        } else if constexpr (std::is_same_v<T, QuarantineCommand>) {
          return backend.quarantine(typed_command);
        } else if constexpr (std::is_same_v<T, DeleteFileCommand>) {
          return backend.delete_file(typed_command);
        } else if constexpr (std::is_same_v<T, DeleteStagingFileCommand>) {
          return backend.delete_staging_file(typed_command);
        } else if constexpr (std::is_same_v<T, RemoveQuarantineCommand>) {
          return backend.remove_quarantine(typed_command);
        } else if constexpr (std::is_same_v<T, RemoveStagingCommand>) {
          return backend.remove_staging(typed_command);
        } else if constexpr (std::is_same_v<T, RevalidateCommand>) {
          return backend.revalidate(typed_command);
        } else {
          return backend.release(typed_command);
        }
      },
      command);
}

GuardApplication::GuardApplication(Backend& backend) noexcept : backend_(backend) {}

int GuardApplication::run(std::istream& input, std::ostream& output) {
  BoundedLineReader reader(kMaxLineBytes);
  while (true) {
    const LineReadResult line = reader.read(input);
    if (line.status == LineReadStatus::kEnd)
      return 0;
    if (line.status == LineReadStatus::kOverflow)
      return 1;
    std::string request_id = "0";
    try {
      const Request request = parse_request(line.payload, request_id);
      output << serialize_response(request.id, true, dispatch_command(backend_, request.command));
    } catch (const GuardError& error) {
      output << serialize_response(request_id, false, {std::string(error.code())});
    } catch (...) {
      output << serialize_response(request_id, false, {"IO_FAILED"});
    }
    output.flush();
  }
}

} // namespace local_whisper::fs_guard
