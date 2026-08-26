#include "local_whisper/common/linux_process_identity.hpp"

#include "local_whisper/common/sha256.hpp"

#include <cstddef>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>

namespace local_whisper::common {

std::array<std::uint8_t, 32> linux_process_start_identity_sha256(pid_t process_id) {
  if (process_id <= 0)
    throw std::runtime_error("invalid process identity PID");
  std::ifstream input("/proc/" + std::to_string(process_id) + "/stat", std::ios::binary);
  std::string stat;
  std::getline(input, stat);
  const std::size_t command_end = stat.rfind(')');
  if (!input || command_end == std::string::npos || command_end + 2U >= stat.size())
    throw std::runtime_error("process identity unavailable");
  std::istringstream fields(stat.substr(command_end + 2U));
  std::string value;
  for (std::size_t index = 0; index <= 19; ++index) {
    if (!(fields >> value))
      throw std::runtime_error("process identity malformed");
  }
  const std::string canonical = std::to_string(process_id) + ":" + value;
  return sha256(std::span<const std::uint8_t>(
      reinterpret_cast<const std::uint8_t*>(canonical.data()), canonical.size()));
}

} // namespace local_whisper::common
