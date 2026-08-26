#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace local_whisper::launcher {

constexpr std::size_t kMaximumLaunchRequestBytes = 64U * 1024U;

enum class WorkerLaunchMode { full_load, probe, registry };

struct IdentityExpectation final {
  std::string device_or_volume_id;
  std::string file_id;
  std::uint64_t link_count = 0;
  std::uint32_t mode = 0;
  std::string parent_file_id;
  std::uint64_t size_bytes = 0;
  bool directory = false;
};

struct LaunchRequest final {
  std::string app_instance_nonce;
  WorkerLaunchMode launch_mode = WorkerLaunchMode::probe;
  std::string worker_path;
  std::string working_directory;
  std::string worker_sha256;
  IdentityExpectation worker_identity;
  IdentityExpectation directory_identity;
  std::vector<std::uint8_t> model_authority_request;
  std::uint32_t worker_bootstrap_bytes = 0;
};

class LaunchRequestParser final {
public:
  [[nodiscard]] LaunchRequest parse(const std::string& line) const;
};

[[nodiscard]] std::string read_bootstrap_line(int descriptor);

} // namespace local_whisper::launcher
