#include "local_whisper/whisper_cpp/model_file_validator.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <algorithm>
#include <filesystem>
#include <string>
#include <utility>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::size_t kMaximumModelPathBytes = 131'072U;

class UniqueDescriptor final {
public:
  explicit UniqueDescriptor(int descriptor = -1) noexcept : descriptor_(descriptor) {}
  ~UniqueDescriptor() noexcept {
    if (descriptor_ >= 0)
      static_cast<void>(close(descriptor_));
  }
  UniqueDescriptor(const UniqueDescriptor&) = delete;
  UniqueDescriptor& operator=(const UniqueDescriptor&) = delete;
  UniqueDescriptor(UniqueDescriptor&& other) noexcept
      : descriptor_(std::exchange(other.descriptor_, -1)) {}
  UniqueDescriptor& operator=(UniqueDescriptor&&) = delete;
  [[nodiscard]] int get() const noexcept { return descriptor_; }

private:
  int descriptor_;
};

[[nodiscard]] bool has_control_character(const std::string& value) {
  return std::any_of(value.begin(), value.end(),
                     [](const unsigned char byte) { return byte <= 0x1fU || byte == 0x7fU; });
}

} // namespace

void PlatformModelFileValidator::validate(const std::string& model_path,
                                          std::uint64_t expected_bytes) const {
  if (model_path.empty() || model_path.size() > kMaximumModelPathBytes ||
      has_control_character(model_path) || expected_bytes == 0U) {
    throw CoreError(FailureCode::model_authority_invalid, "model path metadata invalid");
  }
  const std::filesystem::path path(model_path);
  if (!path.is_absolute() || path.lexically_normal().native() != path.native()) {
    throw CoreError(FailureCode::model_authority_invalid, "model path form invalid");
  }
  const UniqueDescriptor descriptor(open(model_path.c_str(), O_PATH | O_CLOEXEC | O_NOFOLLOW));
  struct stat metadata {};
  if (descriptor.get() < 0 || fstat(descriptor.get(), &metadata) != 0 ||
      !S_ISREG(metadata.st_mode) || metadata.st_size <= 0 ||
      static_cast<std::uint64_t>(metadata.st_size) != expected_bytes) {
    throw CoreError(FailureCode::model_authority_invalid, "model file metadata invalid");
  }
}

} // namespace local_whisper::whisper_cpp
