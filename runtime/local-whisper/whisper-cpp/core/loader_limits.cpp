#include "local_whisper/whisper_cpp/loader_limits.hpp"

#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper_loader_limits.hpp"

namespace local_whisper::whisper_cpp {
namespace generated_limits = local_whisper::whisper_cpp::generated;

LoaderLimits::LoaderLimits() {
  if (generated_limits::kTableId != std::string_view("whisper-cpp-loader-limits-v1") ||
      generated_limits::kTableSha256 !=
          std::string_view("e625802a6fbf31aba996150df44babc2f5784ab7ce28aa1408ae67bacd53f715")) {
    throw CoreError(FailureCode::model_load_failed, "loader limit identity mismatch");
  }
}

std::string_view LoaderLimits::table_id() const noexcept { return generated_limits::kTableId; }
std::string_view LoaderLimits::table_sha256() const noexcept {
  return generated_limits::kTableSha256;
}
RangeLimit LoaderLimits::authenticated_model_bytes() const noexcept {
  return generated_limits::kAuthenticatedModelBytes;
}
RangeLimit LoaderLimits::vocabulary_count() const noexcept {
  return generated_limits::kVocabularyCount;
}
RangeLimit LoaderLimits::audio_context() const noexcept { return generated_limits::kAudioContext; }
RangeLimit LoaderLimits::audio_state() const noexcept { return generated_limits::kAudioState; }
RangeLimit LoaderLimits::audio_heads() const noexcept { return generated_limits::kAudioHeads; }
RangeLimit LoaderLimits::audio_layers() const noexcept { return generated_limits::kAudioLayers; }
RangeLimit LoaderLimits::text_context() const noexcept { return generated_limits::kTextContext; }
RangeLimit LoaderLimits::text_state() const noexcept { return generated_limits::kTextState; }
RangeLimit LoaderLimits::text_heads() const noexcept { return generated_limits::kTextHeads; }
RangeLimit LoaderLimits::text_layers() const noexcept { return generated_limits::kTextLayers; }
RangeLimit LoaderLimits::mel_dimension() const noexcept { return generated_limits::kMelDimension; }
RangeLimit LoaderLimits::token_bytes() const noexcept { return generated_limits::kTokenBytes; }
RangeLimit LoaderLimits::tensor_rank() const noexcept { return generated_limits::kTensorRank; }
RangeLimit LoaderLimits::tensor_name_bytes() const noexcept {
  return generated_limits::kTensorNameBytes;
}
RangeLimit LoaderLimits::tensor_dimension() const noexcept {
  return generated_limits::kTensorDimension;
}
std::uint64_t LoaderLimits::mel_filter_elements() const noexcept {
  return generated_limits::kMelFilterElements;
}
std::uint64_t LoaderLimits::mel_filter_bytes() const noexcept {
  return generated_limits::kMelFilterBytes;
}
std::uint64_t LoaderLimits::aggregate_token_bytes() const noexcept {
  return generated_limits::kAggregateTokenBytes;
}
std::uint64_t LoaderLimits::tensor_count() const noexcept { return generated_limits::kTensorCount; }
std::uint64_t LoaderLimits::tensor_element_product() const noexcept {
  return generated_limits::kTensorElementProduct;
}
std::uint64_t LoaderLimits::tensor_payload_bytes() const noexcept {
  return generated_limits::kTensorPayloadBytes;
}
std::uint64_t LoaderLimits::aggregate_tensor_payload_bytes() const noexcept {
  return generated_limits::kAggregateTensorPayloadBytes;
}
std::uint64_t LoaderLimits::aggregate_parsed_metadata_bytes() const noexcept {
  return generated_limits::kAggregateParsedMetadataBytes;
}

void LoaderLimits::require_range(std::uint64_t value, RangeLimit range) {
  if (value < range.minimum || value > range.maximum)
    throw CoreError(FailureCode::model_load_failed, "model field outside reviewed limits");
}

void LoaderLimits::require_ceiling(std::uint64_t value, std::uint64_t maximum) {
  if (value > maximum)
    throw CoreError(FailureCode::model_load_failed, "model aggregate exceeds reviewed limit");
}

} // namespace local_whisper::whisper_cpp
