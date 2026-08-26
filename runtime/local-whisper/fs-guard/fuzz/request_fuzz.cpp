#include "local_whisper/fs_guard/protocol.hpp"

#include "local_whisper/fs_guard/error.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, const std::size_t size) {
  try {
    const std::string_view line(reinterpret_cast<const char*>(data), size);
    std::string request_id;
    static_cast<void>(local_whisper::fs_guard::parse_request(line, request_id));
  } catch (const local_whisper::fs_guard::GuardError&) {
  }
  return 0;
}
