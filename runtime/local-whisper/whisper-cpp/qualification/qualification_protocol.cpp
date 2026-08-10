#include "local_whisper/whisper_cpp/qualification_protocol.hpp"

#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/nlohmann_json.hpp"
#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <string_view>
#include <utility>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

using Json = nlohmann::json;

constexpr std::array<std::string_view, 9> kCommandKeys = {
    "schemaVersion", "family",    "variant",  "modelSizeBytes", "modelSha256",
    "wavSizeBytes",  "wavSha256", "language", "cpuThreads"};

bool has_exact_keys(const Json& document) {
  if (!document.is_object() || document.size() != kCommandKeys.size() + 1U)
    return false;
  return std::all_of(kCommandKeys.begin(), kCommandKeys.end(),
                     [&document](std::string_view key) { return document.contains(key); }) &&
         document.contains("selectedOrdinal");
}

bool valid_model_pair(std::string_view family, std::string_view variant) {
  if (variant == "full")
    return family == "tiny" || family == "base" || family == "small" || family == "medium";
  return variant == "q5_0" && (family == "large-v3" || family == "large-v3-turbo");
}

std::array<std::uint8_t, 32> parse_digest(const Json& value) {
  if (!value.is_string())
    throw CoreError(FailureCode::invalid_settings, "qualification digest must be a string");
  const auto text = value.get<std::string>();
  if (text.size() != 64U)
    throw CoreError(FailureCode::invalid_settings, "qualification digest length is invalid");
  std::array<std::uint8_t, 32> digest{};
  for (std::size_t index = 0; index < digest.size(); ++index) {
    const auto high = text[index * 2U];
    const auto low = text[index * 2U + 1U];
    const auto nibble = [](char value) -> std::optional<std::uint8_t> {
      if (value >= '0' && value <= '9')
        return static_cast<std::uint8_t>(value - '0');
      if (value >= 'a' && value <= 'f')
        return static_cast<std::uint8_t>(value - 'a' + 10);
      return std::nullopt;
    };
    const auto high_value = nibble(high);
    const auto low_value = nibble(low);
    if (!high_value.has_value() || !low_value.has_value())
      throw CoreError(FailureCode::invalid_settings, "qualification digest spelling is invalid");
    digest[index] = static_cast<std::uint8_t>((*high_value << 4U) | *low_value);
  }
  return digest;
}

std::uint64_t positive_u64(const Json& value, const char* message) {
  if (!value.is_number_unsigned())
    throw CoreError(FailureCode::invalid_settings, message);
  const auto parsed = value.get<std::uint64_t>();
  if (parsed == 0U)
    throw CoreError(FailureCode::invalid_settings, message);
  return parsed;
}

struct DescriptorIdentity final {
  std::uint64_t size;
  std::uint64_t device;
  std::uint64_t inode;
  bool valid;
};

DescriptorIdentity descriptor_identity(int descriptor, std::uint64_t maximum_size) {
  struct stat metadata {};
  const int flags = fcntl(descriptor, F_GETFL);
  const off_t offset = lseek(descriptor, 0, SEEK_CUR);
  const bool valid = flags >= 0 && (flags & O_ACCMODE) == O_RDONLY &&
                     fstat(descriptor, &metadata) == 0 && S_ISREG(metadata.st_mode) &&
                     metadata.st_size > 0 &&
                     static_cast<std::uint64_t>(metadata.st_size) <= maximum_size && offset == 0;
  return {valid ? static_cast<std::uint64_t>(metadata.st_size) : 0U,
          valid ? static_cast<std::uint64_t>(metadata.st_dev) : 0U,
          valid ? static_cast<std::uint64_t>(metadata.st_ino) : 0U, valid};
}

void close_descriptor(int descriptor) noexcept {
  if (descriptor >= 0)
    static_cast<void>(close(descriptor));
}

class DescriptorOwner final {
public:
  explicit DescriptorOwner(int descriptor) noexcept : descriptor_(descriptor) {}
  ~DescriptorOwner() noexcept { close_descriptor(descriptor_); }
  DescriptorOwner(const DescriptorOwner&) = delete;
  DescriptorOwner& operator=(const DescriptorOwner&) = delete;

private:
  int descriptor_;
};

bool identity_matches(int descriptor, std::uint64_t size, std::uint64_t device,
                      std::uint64_t inode) {
  struct stat metadata {};
  return fstat(descriptor, &metadata) == 0 && metadata.st_size >= 0 &&
         static_cast<std::uint64_t>(metadata.st_size) == size &&
         static_cast<std::uint64_t>(metadata.st_dev) == device &&
         static_cast<std::uint64_t>(metadata.st_ino) == inode;
}

} // namespace

QualificationCommand parse_qualification_command(std::span<const std::uint8_t> bytes) {
  if (bytes.empty() || bytes.size() > kQualificationCommandMaxBytes ||
      !local_whisper::common::validate_bounded_json(bytes).valid) {
    throw CoreError(FailureCode::invalid_settings, "qualification command is invalid");
  }
  const auto document = Json::parse(bytes.begin(), bytes.end(), nullptr, false, true);
  if (document.is_discarded() || !has_exact_keys(document) || document["schemaVersion"] != 1 ||
      !document["family"].is_string() || !document["variant"].is_string() ||
      !document["language"].is_string()) {
    throw CoreError(FailureCode::invalid_settings, "qualification command shape is invalid");
  }
  const auto family = document["family"].get<std::string>();
  const auto variant = document["variant"].get<std::string>();
  const auto language = document["language"].get<std::string>();
  if (!valid_model_pair(family, variant) || (language != "en" && language != "ru"))
    throw CoreError(FailureCode::invalid_settings, "qualification command identity is invalid");
  const auto model_size = positive_u64(document["modelSizeBytes"], "model size is invalid");
  const auto wav_size = positive_u64(document["wavSizeBytes"], "WAV size is invalid");
  if (wav_size > kQualificationWavMaxBytes || !document["cpuThreads"].is_number_unsigned())
    throw CoreError(FailureCode::invalid_settings, "qualification command bounds are invalid");
  const auto cpu_threads = document["cpuThreads"].get<std::uint64_t>();
  if (cpu_threads == 0U || cpu_threads > 256U)
    throw CoreError(FailureCode::invalid_settings, "qualification thread count is invalid");
  std::optional<std::uint16_t> selected_ordinal;
  if (!document["selectedOrdinal"].is_null()) {
    if (!document["selectedOrdinal"].is_number_unsigned())
      throw CoreError(FailureCode::invalid_settings, "qualification device ordinal is invalid");
    const auto ordinal = document["selectedOrdinal"].get<std::uint64_t>();
    if (ordinal > std::numeric_limits<std::uint16_t>::max())
      throw CoreError(FailureCode::invalid_settings, "qualification device ordinal is invalid");
    selected_ordinal = static_cast<std::uint16_t>(ordinal);
  }
  return {family,          variant,
          model_size,      parse_digest(document["modelSha256"]),
          wav_size,        parse_digest(document["wavSha256"]),
          language,        static_cast<std::uint32_t>(cpu_threads),
          selected_ordinal};
}

QualificationModelSource::QualificationModelSource(int descriptor)
    : descriptor_(descriptor), initial_size_(0U), initial_device_(0U), initial_inode_(0U),
      valid_(false) {
  const auto identity = descriptor_identity(descriptor_, std::numeric_limits<std::uint64_t>::max());
  initial_size_ = identity.size;
  initial_device_ = identity.device;
  initial_inode_ = identity.inode;
  valid_ = identity.valid;
}

QualificationModelSource::~QualificationModelSource() noexcept { close_descriptor(descriptor_); }

bool QualificationModelSource::is_read_only_regular() const noexcept { return valid_; }

std::uint64_t QualificationModelSource::size_bytes() const {
  if (!valid_ || !identity_matches(descriptor_, initial_size_, initial_device_, initial_inode_))
    throw CoreError(FailureCode::model_corrupt, "qualification model identity changed");
  return initial_size_;
}

std::uint64_t QualificationModelSource::initial_offset() const { return 0U; }

std::optional<std::size_t> QualificationModelSource::read_at(std::uint64_t offset,
                                                             std::span<std::uint8_t> destination) {
  if (!valid_ || offset > static_cast<std::uint64_t>(std::numeric_limits<off_t>::max()))
    return std::nullopt;
  while (true) {
    const ssize_t count =
        pread(descriptor_, destination.data(), destination.size(), static_cast<off_t>(offset));
    if (count < 0 && errno == EINTR)
      continue;
    if (count < 0)
      return std::nullopt;
    return static_cast<std::size_t>(count);
  }
}

std::vector<std::uint8_t>
read_qualification_wav(int descriptor, std::uint64_t expected_bytes,
                       const std::array<std::uint8_t, 32>& expected_sha256) {
  const DescriptorOwner owner(descriptor);
  const auto identity = descriptor_identity(descriptor, kQualificationWavMaxBytes);
  if (!identity.valid || identity.size != expected_bytes)
    throw CoreError(FailureCode::audio_format_unsupported,
                    "qualification WAV authority is invalid");
  std::vector<std::uint8_t> bytes(static_cast<std::size_t>(identity.size));
  std::size_t offset = 0U;
  while (offset < bytes.size()) {
    const ssize_t count =
        pread(descriptor, bytes.data() + offset, bytes.size() - offset, static_cast<off_t>(offset));
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw CoreError(FailureCode::audio_format_unsupported, "qualification WAV read failed");
    offset += static_cast<std::size_t>(count);
  }
  if (!identity_matches(descriptor, identity.size, identity.device, identity.inode) ||
      local_whisper::common::sha256(bytes) != expected_sha256) {
    throw CoreError(FailureCode::audio_format_unsupported, "qualification WAV identity changed");
  }
  return bytes;
}

} // namespace local_whisper::whisper_cpp
