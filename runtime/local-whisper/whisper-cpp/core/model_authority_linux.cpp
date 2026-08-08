#include "local_whisper/whisper_cpp/model_authority.hpp"

#include "local_whisper/common/authority_bootstrap.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <memory>
#include <optional>
#include <span>
#include <utility>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

constexpr int kLogicalModelDescriptor = 3;

class UniqueDescriptor final {
public:
  explicit UniqueDescriptor(int descriptor = -1) noexcept : descriptor_(descriptor) {}
  ~UniqueDescriptor() noexcept { reset(); }
  UniqueDescriptor(const UniqueDescriptor&) = delete;
  UniqueDescriptor& operator=(const UniqueDescriptor&) = delete;
  UniqueDescriptor(UniqueDescriptor&& other) noexcept : descriptor_(other.release()) {}
  UniqueDescriptor& operator=(UniqueDescriptor&& other) noexcept {
    if (this != &other)
      reset(other.release());
    return *this;
  }
  [[nodiscard]] int get() const noexcept { return descriptor_; }
  [[nodiscard]] int release() noexcept { return std::exchange(descriptor_, -1); }
  void reset(int descriptor = -1) noexcept {
    if (descriptor_ >= 0)
      static_cast<void>(close(descriptor_));
    descriptor_ = descriptor;
  }

private:
  int descriptor_;
};

class LinuxDescriptorSource final : public RandomAccessModelSource {
public:
  explicit LinuxDescriptorSource(UniqueDescriptor descriptor) : descriptor_(std::move(descriptor)) {
    struct stat metadata {};
    const int flags = fcntl(descriptor_.get(), F_GETFL);
    const off_t offset = lseek(descriptor_.get(), 0, SEEK_CUR);
    valid_ = flags >= 0 && (flags & O_ACCMODE) == O_RDONLY &&
             fstat(descriptor_.get(), &metadata) == 0 && S_ISREG(metadata.st_mode) &&
             metadata.st_size > 0 && offset == 0;
  }

  [[nodiscard]] bool is_read_only_regular() const noexcept override { return valid_; }
  [[nodiscard]] std::uint64_t size_bytes() const override {
    struct stat metadata {};
    if (fstat(descriptor_.get(), &metadata) != 0 || metadata.st_size < 0)
      throw CoreError(FailureCode::model_corrupt, "model descriptor identity changed");
    return static_cast<std::uint64_t>(metadata.st_size);
  }
  [[nodiscard]] std::uint64_t initial_offset() const override { return 0U; }
  [[nodiscard]] std::optional<std::size_t> read_at(std::uint64_t offset,
                                                   std::span<std::uint8_t> destination) override {
    if (offset > static_cast<std::uint64_t>(std::numeric_limits<off_t>::max()))
      return std::nullopt;
    while (true) {
      const ssize_t count = pread(descriptor_.get(), destination.data(), destination.size(),
                                  static_cast<off_t>(offset));
      if (count < 0 && errno == EINTR)
        continue;
      if (count < 0)
        return std::nullopt;
      return static_cast<std::size_t>(count);
    }
  }

private:
  UniqueDescriptor descriptor_;
  bool valid_ = false;
};

} // namespace

class ModelAuthority::Impl final {
public:
  Impl(local_whisper::common::AuthorityBinding binding, UniqueDescriptor descriptor)
      : binding_(std::move(binding)), source_(std::move(descriptor)) {}

  local_whisper::common::AuthorityBinding binding_;
  LinuxDescriptorSource source_;
};

ModelAuthority::ModelAuthority(std::unique_ptr<Impl> impl) : impl_(std::move(impl)) {}
ModelAuthority::~ModelAuthority() noexcept = default;
ModelAuthority::ModelAuthority(ModelAuthority&&) noexcept = default;
ModelAuthority& ModelAuthority::operator=(ModelAuthority&&) noexcept = default;

ModelAuthority ModelAuthority::receive_from_standard_channels() {
  UniqueDescriptor descriptor(kLogicalModelDescriptor);
  const auto binding = local_whisper::common::receive_worker_model_bootstrap(
      STDIN_FILENO, STDOUT_FILENO, kLogicalModelDescriptor);
  if (binding.artifact_kind != local_whisper::common::AuthorityArtifactKind::regular_file)
    throw CoreError(FailureCode::model_authority_invalid,
                    "Whisper.cpp requires regular model file");
  return ModelAuthority(std::make_unique<Impl>(binding, std::move(descriptor)));
}

const local_whisper::common::AuthorityBinding& ModelAuthority::binding() const noexcept {
  return impl_->binding_;
}

RandomAccessModelSource& ModelAuthority::source() noexcept { return impl_->source_; }

} // namespace local_whisper::whisper_cpp
