#include "local_whisper/whisper_cpp/model_file_validator.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <cstdint>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace local_whisper::whisper_cpp {
namespace {

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

class ValidatedTemporaryRoot final {
public:
  ValidatedTemporaryRoot() {
    std::array<char, 64U> pattern{};
    constexpr std::string_view prefix = "/tmp/local-whisper-model-validator-XXXXXX";
    std::copy(prefix.begin(), prefix.end(), pattern.begin());
    char* created = mkdtemp(pattern.data());
    if (created == nullptr)
      throw std::runtime_error("temporary root unavailable");
    path_ = created;
  }

  ~ValidatedTemporaryRoot() noexcept {
    std::error_code error;
    if (path_.string().starts_with("/tmp/local-whisper-model-validator-"))
      static_cast<void>(std::filesystem::remove_all(path_, error));
  }

  ValidatedTemporaryRoot(const ValidatedTemporaryRoot&) = delete;
  ValidatedTemporaryRoot& operator=(const ValidatedTemporaryRoot&) = delete;

  [[nodiscard]] std::filesystem::path child(std::string_view name) const { return path_ / name; }
  [[nodiscard]] const std::filesystem::path& path() const noexcept { return path_; }

private:
  std::filesystem::path path_;
};

void write_exact_file(const std::filesystem::path& path, std::string_view contents) {
  const UniqueDescriptor descriptor(
      open(path.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600));
  if (descriptor.get() < 0)
    throw std::runtime_error("fixture file unavailable");
  std::size_t offset = 0U;
  while (offset < contents.size()) {
    const auto count = write(descriptor.get(), contents.data() + offset, contents.size() - offset);
    if (count < 0 && errno == EINTR)
      continue;
    if (count <= 0)
      throw std::runtime_error("fixture write failed");
    offset += static_cast<std::size_t>(count);
  }
}

TEST(ModelFileValidator, AcceptsOnlyExactAbsoluteRegularFileMetadata) {
  const ValidatedTemporaryRoot root;
  const auto model = root.child("model.bin");
  write_exact_file(model, "model-data");
  const PlatformModelFileValidator validator;

  EXPECT_NO_THROW(validator.validate(model.string(), 10U));
  EXPECT_THROW(validator.validate(model.string(), 9U), CoreError);
  EXPECT_THROW(validator.validate(model.string(), 0U), CoreError);
  EXPECT_THROW(validator.validate("relative-model.bin", 10U), CoreError);
  EXPECT_THROW(validator.validate((root.path() / "." / "model.bin").string(), 10U), CoreError);
  EXPECT_THROW(validator.validate(model.string() + "\n", 10U), CoreError);
  EXPECT_THROW(validator.validate(root.path().string(), 10U), CoreError);
}

TEST(ModelFileValidator, RejectsFinalLinksFifosAndMissingFilesWithoutDisclosingPath) {
  const ValidatedTemporaryRoot root;
  const auto model = root.child("private-model-marker.bin");
  const auto link = root.child("model-link.bin");
  const auto fifo = root.child("model-fifo.bin");
  write_exact_file(model, "model-data");
  ASSERT_EQ(symlink(model.c_str(), link.c_str()), 0);
  ASSERT_EQ(mkfifo(fifo.c_str(), 0600), 0);
  const PlatformModelFileValidator validator;

  for (const auto& path : {link, fifo, root.child("missing.bin")}) {
    try {
      validator.validate(path.string(), 10U);
      FAIL() << "unsafe model path accepted";
    } catch (const CoreError& error) {
      EXPECT_EQ(std::string(error.what()).find(root.path().string()), std::string::npos);
      EXPECT_EQ(std::string(error.what()).find("private-model-marker"), std::string::npos);
    }
  }
}

} // namespace
} // namespace local_whisper::whisper_cpp
