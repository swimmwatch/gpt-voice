#include "local_whisper/whisper_cpp/model_format_preflight.hpp"

#include "local_whisper/whisper_cpp/checked_arithmetic.hpp"
#include "local_whisper/whisper_cpp/error.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

constexpr std::uint32_t kGgmlFileMagic = 0x67676d6cU;
constexpr std::int32_t kTypeF32 = 0;
constexpr std::int32_t kTypeF16 = 1;
constexpr std::int32_t kFtypeQ50 = 8;
constexpr std::int32_t kTensorTypeQ50 = 6;
constexpr std::uint64_t kQ50BlockElements = 32;
constexpr std::uint64_t kQ50BlockBytes = 22;

std::uint32_t decode_u32(std::span<const std::uint8_t, 4> bytes) {
  return static_cast<std::uint32_t>(bytes[0]) | (static_cast<std::uint32_t>(bytes[1]) << 8U) |
         (static_cast<std::uint32_t>(bytes[2]) << 16U) |
         (static_cast<std::uint32_t>(bytes[3]) << 24U);
}

std::uint32_t read_u32(ExactModelReader& reader) {
  std::array<std::uint8_t, 4> bytes{};
  reader.read_exact(bytes);
  return decode_u32(bytes);
}

std::int32_t read_i32(ExactModelReader& reader) {
  return static_cast<std::int32_t>(read_u32(reader));
}

std::uint64_t positive(std::int32_t value) {
  if (value <= 0)
    throw CoreError(FailureCode::model_load_failed, "model scalar must be positive");
  return static_cast<std::uint64_t>(value);
}

std::string family_for_layers(std::int32_t audio_layers, std::int32_t text_layers) {
  switch (audio_layers) {
  case 4:
    return "tiny";
  case 6:
    return "base";
  case 12:
    return "small";
  case 24:
    return "medium";
  case 32:
    return text_layers <= 8 ? "large-v3-turbo" : "large-v3";
  default:
    throw CoreError(FailureCode::model_load_failed, "model family is not allowlisted");
  }
}

void require_variant(const std::string& variant, std::int32_t ftype) {
  const auto effective_type = ftype % 1000;
  if ((variant == "full" && (effective_type == kTypeF32 || effective_type == kTypeF16)) ||
      (variant == "q5_0" && effective_type == kFtypeQ50)) {
    return;
  }
  throw CoreError(FailureCode::model_load_failed, "model variant is not allowlisted");
}

std::uint64_t tensor_payload(std::int32_t type, std::uint64_t elements,
                             const std::string& variant) {
  if (type == kTypeF32)
    return checked_multiply(elements, 4U);
  if (type == kTypeF16)
    return checked_multiply(elements, 2U);
  if (type == kTensorTypeQ50 && variant == "q5_0" && elements % kQ50BlockElements == 0U)
    return checked_multiply(elements / kQ50BlockElements, kQ50BlockBytes);
  throw CoreError(FailureCode::model_load_failed, "tensor type is not allowlisted");
}

void require_clean_name(const std::string& name) {
  for (const unsigned char value : name) {
    if (value == 0U || value < 0x20U || value == 0x7fU)
      throw CoreError(FailureCode::model_load_failed, "invalid tensor name");
  }
}

} // namespace

ModelFormatPreflight::ModelFormatPreflight(LoaderLimits limits) : limits_(std::move(limits)) {}

ModelFormatEvidence ModelFormatPreflight::validate(ExactModelReader& reader,
                                                   const std::string& expected_family,
                                                   const std::string& expected_variant) const {
  LoaderLimits::require_range(reader.expected_bytes(), limits_.authenticated_model_bytes());
  if (read_u32(reader) != kGgmlFileMagic)
    throw CoreError(FailureCode::model_load_failed, "invalid model magic");

  const auto vocabulary_count = positive(read_i32(reader));
  const auto audio_context = positive(read_i32(reader));
  const auto audio_state = positive(read_i32(reader));
  const auto audio_heads = positive(read_i32(reader));
  const auto audio_layers = positive(read_i32(reader));
  const auto text_context = positive(read_i32(reader));
  const auto text_state = positive(read_i32(reader));
  const auto text_heads = positive(read_i32(reader));
  const auto text_layers = positive(read_i32(reader));
  const auto mel_dimension = positive(read_i32(reader));
  const auto ftype = read_i32(reader);

  LoaderLimits::require_range(vocabulary_count, limits_.vocabulary_count());
  LoaderLimits::require_range(audio_context, limits_.audio_context());
  LoaderLimits::require_range(audio_state, limits_.audio_state());
  LoaderLimits::require_range(audio_heads, limits_.audio_heads());
  LoaderLimits::require_range(audio_layers, limits_.audio_layers());
  LoaderLimits::require_range(text_context, limits_.text_context());
  LoaderLimits::require_range(text_state, limits_.text_state());
  LoaderLimits::require_range(text_heads, limits_.text_heads());
  LoaderLimits::require_range(text_layers, limits_.text_layers());
  LoaderLimits::require_range(mel_dimension, limits_.mel_dimension());
  if (audio_state % audio_heads != 0U || text_state % text_heads != 0U || audio_state != text_state)
    throw CoreError(FailureCode::model_load_failed, "invalid model cross-field dimensions");
  const std::string family = family_for_layers(static_cast<std::int32_t>(audio_layers),
                                               static_cast<std::int32_t>(text_layers));
  if (family != expected_family)
    throw CoreError(FailureCode::model_load_failed, "catalog model family mismatch");
  require_variant(expected_variant, ftype);

  const auto filter_mels = positive(read_i32(reader));
  const auto filter_fft = positive(read_i32(reader));
  if (filter_mels != mel_dimension)
    throw CoreError(FailureCode::model_load_failed, "mel filter dimension mismatch");
  const auto filter_elements = checked_multiply(filter_mels, filter_fft);
  const auto filter_bytes = checked_multiply(filter_elements, sizeof(float));
  LoaderLimits::require_ceiling(filter_elements, limits_.mel_filter_elements());
  LoaderLimits::require_ceiling(filter_bytes, limits_.mel_filter_bytes());
  reader.skip_exact(filter_bytes);

  const auto serialized_vocabulary_count = positive(read_i32(reader));
  if (serialized_vocabulary_count > vocabulary_count)
    throw CoreError(FailureCode::model_load_failed, "serialized vocabulary exceeds header");
  std::uint64_t aggregate_token_bytes = 0;
  for (std::uint64_t index = 0; index < serialized_vocabulary_count; ++index) {
    const auto token_bytes = static_cast<std::uint64_t>(read_u32(reader));
    LoaderLimits::require_range(token_bytes, limits_.token_bytes());
    aggregate_token_bytes = checked_add(aggregate_token_bytes, token_bytes);
    LoaderLimits::require_ceiling(aggregate_token_bytes, limits_.aggregate_token_bytes());
    reader.skip_exact(token_bytes);
  }

  std::unordered_set<std::string> tensor_names;
  std::uint64_t tensor_count = 0;
  std::uint64_t aggregate_payload = 0;
  std::uint64_t aggregate_metadata = aggregate_token_bytes;
  std::array<std::uint8_t, 12> prefix{};
  while (reader.read_optional_record_prefix(prefix)) {
    const auto rank = static_cast<std::uint64_t>(
        static_cast<std::int32_t>(decode_u32(std::span<const std::uint8_t, 4>(prefix.data(), 4))));
    const auto name_bytes = static_cast<std::uint64_t>(static_cast<std::int32_t>(
        decode_u32(std::span<const std::uint8_t, 4>(prefix.data() + 4, 4))));
    const auto type = static_cast<std::int32_t>(
        decode_u32(std::span<const std::uint8_t, 4>(prefix.data() + 8, 4)));
    LoaderLimits::require_range(rank, limits_.tensor_rank());
    LoaderLimits::require_range(name_bytes, limits_.tensor_name_bytes());
    tensor_count = checked_add(tensor_count, 1U);
    LoaderLimits::require_ceiling(tensor_count, limits_.tensor_count());

    std::uint64_t elements = 1;
    for (std::uint64_t dimension_index = 0; dimension_index < rank; ++dimension_index) {
      const auto dimension = positive(read_i32(reader));
      LoaderLimits::require_range(dimension, limits_.tensor_dimension());
      elements = checked_multiply(elements, dimension);
      LoaderLimits::require_ceiling(elements, limits_.tensor_element_product());
    }
    std::vector<std::uint8_t> name_storage(checked_size(name_bytes));
    reader.read_exact(name_storage);
    const std::string name(name_storage.begin(), name_storage.end());
    require_clean_name(name);
    if (!tensor_names.insert(name).second)
      throw CoreError(FailureCode::model_load_failed, "duplicate tensor name");
    const auto dimension_metadata = checked_multiply(rank, 4U);
    const auto tensor_metadata = checked_add(name_bytes, checked_add(12U, dimension_metadata));
    aggregate_metadata = checked_add(aggregate_metadata, tensor_metadata);
    LoaderLimits::require_ceiling(aggregate_metadata, limits_.aggregate_parsed_metadata_bytes());

    const auto payload = tensor_payload(type, elements, expected_variant);
    LoaderLimits::require_ceiling(payload, limits_.tensor_payload_bytes());
    aggregate_payload = checked_add(aggregate_payload, payload);
    LoaderLimits::require_ceiling(aggregate_payload, limits_.aggregate_tensor_payload_bytes());
    reader.skip_exact(payload);
  }
  if (tensor_count == 0U)
    throw CoreError(FailureCode::model_load_failed, "model has no tensors");
  reader.verify_complete();
  return {family, expected_variant, checked_size(tensor_count), aggregate_payload};
}

} // namespace local_whisper::whisper_cpp
