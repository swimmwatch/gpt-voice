#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <span>
#include <variant>
#include <vector>

namespace local_whisper::common {

constexpr std::size_t kAuthorityRequestBytes = 234;
constexpr std::size_t kAuthorityTransferBytes = 244;
constexpr std::size_t kAuthorityAcknowledgmentBytes = 284;

enum class AuthorityArtifactKind : std::uint8_t { regular_file = 1, directory = 2 };
enum class AuthorityCarrierKind : std::uint8_t {
  linux_rights = 1,
  windows_launcher_handle = 2,
  linux_worker_fd = 3,
  windows_worker_handle = 4
};

struct AuthorityBinding {
  std::array<std::uint8_t, 16> operation_nonce;
  std::array<std::uint8_t, 16> app_ownership_nonce;
  std::uint64_t configuration_epoch;
  std::array<std::uint8_t, 32> lease_token_sha256;
  std::array<std::uint8_t, 32> model_identity_sha256;
  std::uint64_t expected_artifact_bytes;
  std::array<std::uint8_t, 32> artifact_content_sha256;
  AuthorityArtifactKind artifact_kind;
  std::uint64_t expected_launcher_pid;
  std::uint64_t expected_guard_pid;
  std::array<std::uint8_t, 32> expected_launcher_start_identity_sha256;
  std::array<std::uint8_t, 32> expected_guard_start_identity_sha256;

  bool operator==(const AuthorityBinding&) const = default;
};

struct AuthorityRequest {
  AuthorityBinding binding;
};
struct AuthorityTransfer {
  AuthorityBinding binding;
  std::uint8_t hop;
  AuthorityCarrierKind carrier_kind;
  std::uint64_t carrier_value;
};
struct AuthorityAcknowledgment {
  AuthorityBinding binding;
  AuthorityCarrierKind carrier_kind;
  std::uint64_t carrier_value;
  std::uint64_t worker_pid;
  std::array<std::uint8_t, 32> worker_start_identity_sha256;
};

using AuthorityRecord = std::variant<AuthorityRequest, AuthorityTransfer, AuthorityAcknowledgment>;

[[nodiscard]] AuthorityRecord decode_authority_record(std::span<const std::uint8_t> bytes);
[[nodiscard]] std::vector<std::uint8_t> encode_authority_record(const AuthorityRecord& record);

class AuthorityReplayGuard final {
public:
  [[nodiscard]] bool consume(const std::array<std::uint8_t, 16>& operation_nonce);

private:
  std::vector<std::array<std::uint8_t, 16>> consumed_;
};

} // namespace local_whisper::common
