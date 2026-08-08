#include "local_whisper/whisper_cpp/checked_arithmetic.hpp"
#include "local_whisper/whisper_cpp/loader_limits.hpp"

#include "local_whisper/whisper_cpp/error.hpp"

#include <gtest/gtest.h>

#include <array>
#include <cstdint>

namespace local_whisper::whisper_cpp {
namespace {

TEST(LoaderLimits, PreservesReviewedIdentityAndEveryRangeBoundary) {
  const LoaderLimits limits;
  EXPECT_EQ(limits.table_id(), "whisper-cpp-loader-limits-v1");
  EXPECT_EQ(limits.table_sha256(),
            "e625802a6fbf31aba996150df44babc2f5784ab7ce28aa1408ae67bacd53f715");
  const std::array ranges = {
      limits.authenticated_model_bytes(),
      limits.vocabulary_count(),
      limits.audio_context(),
      limits.audio_state(),
      limits.audio_heads(),
      limits.audio_layers(),
      limits.text_context(),
      limits.text_state(),
      limits.text_heads(),
      limits.text_layers(),
      limits.mel_dimension(),
      limits.token_bytes(),
      limits.tensor_rank(),
      limits.tensor_name_bytes(),
      limits.tensor_dimension(),
  };
  for (const auto range : ranges) {
    EXPECT_NO_THROW(LoaderLimits::require_range(range.minimum, range));
    EXPECT_NO_THROW(LoaderLimits::require_range(range.maximum, range));
    if (range.minimum > 0U) {
      EXPECT_THROW(LoaderLimits::require_range(range.minimum - 1U, range), CoreError);
    }
    EXPECT_THROW(LoaderLimits::require_range(range.maximum + 1U, range), CoreError);
  }
}

TEST(LoaderLimits, PreservesEveryAggregateCeilingAndCheckedProducts) {
  const LoaderLimits limits;
  const std::array ceilings = {
      limits.mel_filter_elements(),
      limits.mel_filter_bytes(),
      limits.aggregate_token_bytes(),
      limits.tensor_count(),
      limits.tensor_element_product(),
      limits.tensor_payload_bytes(),
      limits.aggregate_tensor_payload_bytes(),
      limits.aggregate_parsed_metadata_bytes(),
  };
  for (const auto ceiling : ceilings) {
    EXPECT_NO_THROW(LoaderLimits::require_ceiling(ceiling - 1U, ceiling));
    EXPECT_NO_THROW(LoaderLimits::require_ceiling(ceiling, ceiling));
    EXPECT_THROW(LoaderLimits::require_ceiling(ceiling + 1U, ceiling), CoreError);
  }
  EXPECT_EQ(checked_multiply(32U, 22U), 704U);
  EXPECT_THROW(static_cast<void>(checked_multiply(UINT64_MAX, 2U)), CoreError);
  EXPECT_THROW(static_cast<void>(checked_add(UINT64_MAX, 1U)), CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
