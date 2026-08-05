#include "local_whisper/whisper_cpp/model_format_preflight.hpp"

#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "test_model_source.hpp"

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <string_view>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

using test_support::MemoryModelSource;

constexpr std::uint32_t kGgmlFtypeMostlyQ50V2 = 2'008U;
constexpr std::uint32_t kGgmlTensorTypeQ50 = 6U;

void append_u32(std::vector<std::uint8_t>& output, std::uint32_t value) {
  output.push_back(static_cast<std::uint8_t>(value));
  output.push_back(static_cast<std::uint8_t>(value >> 8U));
  output.push_back(static_cast<std::uint8_t>(value >> 16U));
  output.push_back(static_cast<std::uint8_t>(value >> 24U));
}

void append_tensor(std::vector<std::uint8_t>& output, std::string_view name,
                   std::uint32_t type = 0U, std::uint32_t dimension = 1U,
                   std::size_t payload_bytes = 4U) {
  append_u32(output, 1U);
  append_u32(output, static_cast<std::uint32_t>(name.size()));
  append_u32(output, type);
  append_u32(output, dimension);
  output.insert(output.end(), name.begin(), name.end());
  output.insert(output.end(), payload_bytes, 0U);
}

std::vector<std::uint8_t> model_fixture(bool duplicate_tensor = false, std::uint32_t ftype = 1U,
                                        std::uint32_t audio_layers = 4U,
                                        std::uint32_t text_layers = 4U) {
  std::vector<std::uint8_t> output;
  append_u32(output, 0x67676d6cU);
  for (const std::uint32_t value :
       {1U, 1U, 1U, 1U, audio_layers, 1U, 1U, 1U, text_layers, 1U, ftype})
    append_u32(output, value);
  append_u32(output, 1U);
  append_u32(output, 1U);
  append_u32(output, 0U);
  append_u32(output, 1U);
  append_u32(output, 1U);
  output.push_back('a');
  append_tensor(output, "tensor");
  if (duplicate_tensor)
    append_tensor(output, "tensor");
  return output;
}

ModelFormatEvidence validate(std::vector<std::uint8_t> bytes, const std::string& family = "tiny",
                             const std::string& variant = "full") {
  MemoryModelSource source(bytes, 3U);
  ExactModelReader reader(source, bytes.size(), local_whisper::common::sha256(bytes));
  return ModelFormatPreflight(LoaderLimits()).validate(reader, family, variant);
}

TEST(ModelFormatPreflight, AcceptsBoundedModelAndRejectsEveryOneByteShortBoundary) {
  const auto complete = model_fixture();
  const auto evidence = validate(complete);
  EXPECT_EQ(evidence.family, "tiny");
  EXPECT_EQ(evidence.variant, "full");
  EXPECT_EQ(evidence.tensor_count, 1U);
  EXPECT_EQ(evidence.tensor_payload_bytes, 4U);

  for (std::size_t cut = 1; cut < complete.size(); ++cut) {
    std::vector<std::uint8_t> truncated(complete.begin(), complete.begin() + cut);
    EXPECT_THROW(static_cast<void>(validate(std::move(truncated))), CoreError) << "cut=" << cut;
  }
}

TEST(ModelFormatPreflight, RejectsFamilyVariantTensorTypeDuplicatesAndOverflowDimensions) {
  EXPECT_THROW(static_cast<void>(validate(model_fixture(), "base")), CoreError);
  EXPECT_THROW(static_cast<void>(validate(model_fixture(), "tiny", "q5_0")), CoreError);
  EXPECT_THROW(static_cast<void>(validate(model_fixture(true))), CoreError);

  auto unknown_type = model_fixture();
  const auto tensor_type_offset = unknown_type.size() - (4U + 6U + 4U + 4U);
  unknown_type[tensor_type_offset] = 99U;
  EXPECT_THROW(static_cast<void>(validate(std::move(unknown_type))), CoreError);

  auto oversized_dimension = model_fixture();
  const auto dimension_offset = oversized_dimension.size() - (4U + 6U + 4U);
  oversized_dimension[dimension_offset] = 1U;
  oversized_dimension[dimension_offset + 2U] = 0x20U;
  EXPECT_THROW(static_cast<void>(validate(std::move(oversized_dimension))), CoreError);
}

TEST(ModelFormatPreflight, AcceptsUpstreamQ50FileTypeAndReviewedTensorEncoding) {
  auto q5 = model_fixture(false, kGgmlFtypeMostlyQ50V2, 32U, 4U);
  const auto tensor_offset = q5.size() - 26U;
  q5.resize(q5.size() - 4U);
  q5[tensor_offset + 12U] = 32U;
  q5.insert(q5.end(), 22U, 0U);
  q5[tensor_offset + 8U] = kGgmlTensorTypeQ50;
  const auto evidence = validate(std::move(q5), "large-v3-turbo", "q5_0");
  EXPECT_EQ(evidence.family, "large-v3-turbo");
  EXPECT_EQ(evidence.variant, "q5_0");
  EXPECT_EQ(evidence.tensor_payload_bytes, 22U);
}

} // namespace
} // namespace local_whisper::whisper_cpp
