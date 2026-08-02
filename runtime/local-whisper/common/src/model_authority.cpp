#include "local_whisper/common/model_authority.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <stdexcept>
#include <type_traits>

namespace local_whisper::common {
namespace {

constexpr std::array<std::uint8_t, 8> kRequestDomain = {'L', 'W', 'A', 'R', '1', 0, 0, 0};
constexpr std::array<std::uint8_t, 8> kTransferDomain = {'L', 'W', 'A', 'T', '1', 0, 0, 0};
constexpr std::array<std::uint8_t, 8> kAcknowledgmentDomain = {'L', 'W', 'A', 'A', '1', 0, 0, 0};

class Writer final {
public:
  explicit Writer(std::size_t size) : bytes_(size) {}

  template <std::size_t Size> void fixed(const std::array<std::uint8_t, Size>& value) {
    require(Size);
    std::copy(value.begin(), value.end(), bytes_.begin() + static_cast<std::ptrdiff_t>(offset_));
    offset_ += Size;
  }

  void u8(std::uint8_t value) {
    require(1);
    bytes_[offset_++] = value;
  }

  void u64(std::uint64_t value) {
    require(8);
    for (int shift = 56; shift >= 0; shift -= 8)
      bytes_[offset_++] = static_cast<std::uint8_t>(value >> static_cast<unsigned int>(shift));
  }

  [[nodiscard]] std::vector<std::uint8_t> finish() {
    if (offset_ != bytes_.size())
      throw std::runtime_error("incomplete authority record");
    return std::move(bytes_);
  }

private:
  void require(std::size_t count) const {
    if (count > bytes_.size() - offset_)
      throw std::runtime_error("authority overflow");
  }

  std::vector<std::uint8_t> bytes_;
  std::size_t offset_ = 0;
};

class Reader final {
public:
  explicit Reader(std::span<const std::uint8_t> bytes) : bytes_(bytes) {}

  template <std::size_t Size> std::array<std::uint8_t, Size> fixed() {
    require(Size);
    std::array<std::uint8_t, Size> result{};
    std::copy_n(bytes_.begin() + static_cast<std::ptrdiff_t>(offset_), Size, result.begin());
    offset_ += Size;
    return result;
  }

  std::uint8_t u8() {
    require(1);
    return bytes_[offset_++];
  }

  std::uint64_t u64() {
    require(8);
    std::uint64_t result = 0;
    for (std::size_t index = 0; index < 8; ++index)
      result = (result << 8U) | bytes_[offset_++];
    return result;
  }

  void finish() const {
    if (offset_ != bytes_.size())
      throw std::runtime_error("trailing authority bytes");
  }

private:
  void require(std::size_t count) const {
    if (count > bytes_.size() - offset_)
      throw std::runtime_error("truncated authority record");
  }

  std::span<const std::uint8_t> bytes_;
  std::size_t offset_ = 0;
};

void write_binding(Writer& writer, const AuthorityBinding& binding) {
  if (binding.expected_launcher_pid == 0U || binding.expected_guard_pid == 0U)
    throw std::runtime_error("authority PID");
  writer.fixed(binding.operation_nonce);
  writer.fixed(binding.app_ownership_nonce);
  writer.u64(binding.configuration_epoch);
  writer.fixed(binding.lease_token_sha256);
  writer.fixed(binding.model_identity_sha256);
  writer.fixed(binding.child_manifest_sha256);
  writer.u8(static_cast<std::uint8_t>(binding.artifact_kind));
  writer.u8(3);
  writer.u64(binding.expected_launcher_pid);
  writer.u64(binding.expected_guard_pid);
  writer.fixed(binding.expected_launcher_start_identity_sha256);
  writer.fixed(binding.expected_guard_start_identity_sha256);
}

AuthorityBinding read_binding(Reader& reader) {
  AuthorityBinding binding{};
  binding.operation_nonce = reader.fixed<16>();
  binding.app_ownership_nonce = reader.fixed<16>();
  binding.configuration_epoch = reader.u64();
  binding.lease_token_sha256 = reader.fixed<32>();
  binding.model_identity_sha256 = reader.fixed<32>();
  binding.child_manifest_sha256 = reader.fixed<32>();
  const auto artifact_kind = reader.u8();
  const auto logical_slot = reader.u8();
  binding.expected_launcher_pid = reader.u64();
  binding.expected_guard_pid = reader.u64();
  binding.expected_launcher_start_identity_sha256 = reader.fixed<32>();
  binding.expected_guard_start_identity_sha256 = reader.fixed<32>();
  if ((artifact_kind != 1U && artifact_kind != 2U) || logical_slot != 3U ||
      binding.expected_launcher_pid == 0U || binding.expected_guard_pid == 0U)
    throw std::runtime_error("authority binding");
  binding.artifact_kind = static_cast<AuthorityArtifactKind>(artifact_kind);
  return binding;
}

void validate_transfer(std::uint8_t hop, AuthorityCarrierKind kind, std::uint64_t value) {
  const bool valid =
      (hop == 1U && kind == AuthorityCarrierKind::linux_rights && value == 0U) ||
      (hop == 1U && kind == AuthorityCarrierKind::windows_launcher_handle && value != 0U) ||
      (hop == 2U && kind == AuthorityCarrierKind::linux_worker_fd && value == 3U) ||
      (hop == 2U && kind == AuthorityCarrierKind::windows_worker_handle && value != 0U);
  if (!valid)
    throw std::runtime_error("authority carrier");
}

} // namespace

AuthorityRecord decode_authority_record(std::span<const std::uint8_t> bytes) {
  if (bytes.size() != kAuthorityRequestBytes && bytes.size() != kAuthorityTransferBytes &&
      bytes.size() != kAuthorityAcknowledgmentBytes)
    throw std::runtime_error("authority length");
  Reader reader(bytes);
  const auto domain = reader.fixed<8>();
  const auto binding = read_binding(reader);
  if (domain == kRequestDomain && bytes.size() == kAuthorityRequestBytes) {
    reader.finish();
    return AuthorityRequest{binding};
  }
  if (domain == kTransferDomain && bytes.size() == kAuthorityTransferBytes) {
    const auto hop = reader.u8();
    const auto kind = static_cast<AuthorityCarrierKind>(reader.u8());
    const auto value = reader.u64();
    reader.finish();
    validate_transfer(hop, kind, value);
    return AuthorityTransfer{binding, hop, kind, value};
  }
  if (domain == kAcknowledgmentDomain && bytes.size() == kAuthorityAcknowledgmentBytes) {
    const auto hop = reader.u8();
    const auto kind = static_cast<AuthorityCarrierKind>(reader.u8());
    const auto value = reader.u64();
    const auto worker_pid = reader.u64();
    const auto worker_identity = reader.fixed<32>();
    reader.finish();
    validate_transfer(hop, kind, value);
    if (hop != 2U || worker_pid == 0U ||
        (kind != AuthorityCarrierKind::linux_worker_fd &&
         kind != AuthorityCarrierKind::windows_worker_handle))
      throw std::runtime_error("authority acknowledgment");
    return AuthorityAcknowledgment{binding, kind, value, worker_pid, worker_identity};
  }
  throw std::runtime_error("authority domain");
}

std::vector<std::uint8_t> encode_authority_record(const AuthorityRecord& record) {
  return std::visit(
      [](const auto& value) -> std::vector<std::uint8_t> {
        using Record = std::decay_t<decltype(value)>;
        if constexpr (std::is_same_v<Record, AuthorityRequest>) {
          Writer writer(kAuthorityRequestBytes);
          writer.fixed(kRequestDomain);
          write_binding(writer, value.binding);
          return writer.finish();
        } else if constexpr (std::is_same_v<Record, AuthorityTransfer>) {
          validate_transfer(value.hop, value.carrier_kind, value.carrier_value);
          Writer writer(kAuthorityTransferBytes);
          writer.fixed(kTransferDomain);
          write_binding(writer, value.binding);
          writer.u8(value.hop);
          writer.u8(static_cast<std::uint8_t>(value.carrier_kind));
          writer.u64(value.carrier_value);
          return writer.finish();
        } else {
          validate_transfer(2, value.carrier_kind, value.carrier_value);
          if (value.worker_pid == 0U)
            throw std::runtime_error("worker PID");
          Writer writer(kAuthorityAcknowledgmentBytes);
          writer.fixed(kAcknowledgmentDomain);
          write_binding(writer, value.binding);
          writer.u8(2);
          writer.u8(static_cast<std::uint8_t>(value.carrier_kind));
          writer.u64(value.carrier_value);
          writer.u64(value.worker_pid);
          writer.fixed(value.worker_start_identity_sha256);
          return writer.finish();
        }
      },
      record);
}

bool AuthorityReplayGuard::consume(const std::array<std::uint8_t, 16>& operation_nonce) {
  if (std::find(consumed_.begin(), consumed_.end(), operation_nonce) != consumed_.end())
    return false;
  consumed_.push_back(operation_nonce);
  return true;
}

} // namespace local_whisper::common
