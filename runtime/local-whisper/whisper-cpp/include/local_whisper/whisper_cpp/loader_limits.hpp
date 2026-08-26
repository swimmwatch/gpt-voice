#pragma once

#include <cstdint>
#include <string_view>

namespace local_whisper::whisper_cpp {

struct RangeLimit final {
  std::uint64_t minimum;
  std::uint64_t maximum;
};

class LoaderLimits final {
public:
  LoaderLimits();

  [[nodiscard]] std::string_view table_id() const noexcept;
  [[nodiscard]] std::string_view table_sha256() const noexcept;
  [[nodiscard]] RangeLimit authenticated_model_bytes() const noexcept;
  [[nodiscard]] RangeLimit vocabulary_count() const noexcept;
  [[nodiscard]] RangeLimit audio_context() const noexcept;
  [[nodiscard]] RangeLimit audio_state() const noexcept;
  [[nodiscard]] RangeLimit audio_heads() const noexcept;
  [[nodiscard]] RangeLimit audio_layers() const noexcept;
  [[nodiscard]] RangeLimit text_context() const noexcept;
  [[nodiscard]] RangeLimit text_state() const noexcept;
  [[nodiscard]] RangeLimit text_heads() const noexcept;
  [[nodiscard]] RangeLimit text_layers() const noexcept;
  [[nodiscard]] RangeLimit mel_dimension() const noexcept;
  [[nodiscard]] RangeLimit token_bytes() const noexcept;
  [[nodiscard]] RangeLimit tensor_rank() const noexcept;
  [[nodiscard]] RangeLimit tensor_name_bytes() const noexcept;
  [[nodiscard]] RangeLimit tensor_dimension() const noexcept;
  [[nodiscard]] std::uint64_t mel_filter_elements() const noexcept;
  [[nodiscard]] std::uint64_t mel_filter_bytes() const noexcept;
  [[nodiscard]] std::uint64_t aggregate_token_bytes() const noexcept;
  [[nodiscard]] std::uint64_t tensor_count() const noexcept;
  [[nodiscard]] std::uint64_t tensor_element_product() const noexcept;
  [[nodiscard]] std::uint64_t tensor_payload_bytes() const noexcept;
  [[nodiscard]] std::uint64_t aggregate_tensor_payload_bytes() const noexcept;
  [[nodiscard]] std::uint64_t aggregate_parsed_metadata_bytes() const noexcept;

  static void require_range(std::uint64_t value, RangeLimit range);
  static void require_ceiling(std::uint64_t value, std::uint64_t maximum);
};

} // namespace local_whisper::whisper_cpp
