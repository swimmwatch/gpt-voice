#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace local_whisper::fs_guard {

struct ModelLaunchFileIdentity final {
  std::string device_id;
  std::string file_id;
  std::uint64_t link_count = 0;
  std::uint32_t mode = 0;
  std::string parent_file_id;
  std::uint64_t size_bytes = 0;
};

struct ModelLaunchRequest final {
  std::string app_instance_nonce;
  std::string launcher_path;
  std::string launcher_sha256;
  std::string launcher_bootstrap;
  std::string model_path;
  std::string model_sha256;
  std::uint64_t model_size_bytes = 0;
  ModelLaunchFileIdentity model_identity;
  std::uint64_t configuration_epoch = 0;
  std::string lease_token_sha256;
  std::string model_identity_sha256;
  std::array<std::uint8_t, 16> operation_nonce{};
  std::uint32_t worker_bootstrap_bytes = 0;
};

class ModelLaunchRequestParser final {
public:
  [[nodiscard]] ModelLaunchRequest parse(const std::string& line) const;
};

[[nodiscard]] std::string read_model_launch_bootstrap(int descriptor);

} // namespace local_whisper::fs_guard
