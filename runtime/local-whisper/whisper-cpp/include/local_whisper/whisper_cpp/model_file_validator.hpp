#pragma once

#include <cstdint>
#include <string>

namespace local_whisper::whisper_cpp {

class ModelFileValidator {
public:
  virtual ~ModelFileValidator() = default;
  virtual void validate(const std::string& model_path, std::uint64_t expected_bytes) const = 0;
};

/** Performs the platform-native metadata check immediately before whisper.cpp reopens the path. */
class PlatformModelFileValidator final : public ModelFileValidator {
public:
  void validate(const std::string& model_path, std::uint64_t expected_bytes) const override;
};

} // namespace local_whisper::whisper_cpp
