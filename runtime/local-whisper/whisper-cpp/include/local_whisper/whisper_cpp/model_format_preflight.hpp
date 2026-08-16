#pragma once

#include "local_whisper/whisper_cpp/exact_model_reader.hpp"
#include "local_whisper/whisper_cpp/loader_limits.hpp"

#include <cstddef>
#include <cstdint>
#include <string>

namespace local_whisper::whisper_cpp {

struct ModelFormatEvidence final {
  std::string family;
  std::string variant;
  std::size_t tensor_count;
  std::uint64_t tensor_payload_bytes;
};

/** Deprecated custom model preflight retained for focused rollback/reference tests only. */
class ModelFormatPreflight final {
public:
  explicit ModelFormatPreflight(LoaderLimits limits);

  [[nodiscard]] ModelFormatEvidence validate(ExactModelReader& reader,
                                             const std::string& expected_family,
                                             const std::string& expected_variant) const;

private:
  LoaderLimits limits_;
};

} // namespace local_whisper::whisper_cpp
