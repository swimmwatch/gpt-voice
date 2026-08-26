#include "local_whisper/whisper_cpp/exact_model_reader.hpp"

#include "local_whisper/common/sha256.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "test_model_source.hpp"

#include <gtest/gtest.h>

#include <array>
#include <cstdint>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

using test_support::MemoryModelSource;

TEST(ExactModelReader, AccumulatesShortReadsAndVerifiesEveryAuthenticatedByte) {
  const std::vector<std::uint8_t> bytes = {1, 2, 3, 4, 5, 6, 7};
  MemoryModelSource source(bytes, 2);
  ExactModelReader reader(source, bytes.size(), local_whisper::common::sha256(bytes));
  std::array<std::uint8_t, 3> prefix{};
  EXPECT_TRUE(reader.read_optional_record_prefix(prefix));
  EXPECT_EQ(prefix, (std::array<std::uint8_t, 3>{1, 2, 3}));
  reader.skip_exact(4);
  EXPECT_TRUE(reader.eof());
  EXPECT_FALSE(reader.read_optional_record_prefix(prefix));
  EXPECT_NO_THROW(reader.verify_complete());
  reader.rewind_after_verified_pass();
  reader.skip_exact(bytes.size());
  EXPECT_NO_THROW(reader.verify_complete());
  reader.close();
  reader.close();
  EXPECT_TRUE(reader.closed());
  EXPECT_EQ(reader.close_count(), 1U);
}

TEST(ExactModelReader, RejectsAuthorityAndSameHandleMutations) {
  const std::vector<std::uint8_t> bytes = {1, 2, 3};
  MemoryModelSource source(bytes);
  source.set_valid_authority(false);
  EXPECT_THROW(ExactModelReader(source, bytes.size(), local_whisper::common::sha256(bytes)),
               CoreError);
  source.set_valid_authority(true);
  source.set_initial_offset(1);
  EXPECT_THROW(ExactModelReader(source, bytes.size(), local_whisper::common::sha256(bytes)),
               CoreError);
  source.set_initial_offset(0);
  std::array<std::uint8_t, 32> zero_digest{};
  EXPECT_THROW(ExactModelReader(source, bytes.size(), zero_digest), CoreError);

  ExactModelReader reader(source, bytes.size(), local_whisper::common::sha256(bytes));
  reader.skip_exact(bytes.size());
  source.set_reported_size(bytes.size() + 1U);
  EXPECT_THROW(reader.verify_complete(), CoreError);
}

TEST(ExactModelReader, RejectsPartialEofUnderlyingErrorsAndOutOfObjectReads) {
  const std::vector<std::uint8_t> bytes = {1, 2, 3};
  MemoryModelSource partial(bytes);
  partial.set_reported_size(4);
  ExactModelReader partial_reader(partial, 4, local_whisper::common::sha256(bytes));
  EXPECT_THROW(partial_reader.skip_exact(4), CoreError);

  MemoryModelSource failed(bytes);
  ExactModelReader failed_reader(failed, bytes.size(), local_whisper::common::sha256(bytes));
  failed.set_fail_reads(true);
  EXPECT_THROW(failed_reader.skip_exact(1), CoreError);

  MemoryModelSource bounded(bytes);
  ExactModelReader bounded_reader(bounded, bytes.size(), local_whisper::common::sha256(bytes));
  EXPECT_THROW(bounded_reader.skip_exact(4), CoreError);
}

TEST(ExactModelReader, RequiresObservedEofAtAuthenticatedBoundary) {
  const std::vector<std::uint8_t> bytes = {1, 2, 3};
  MemoryModelSource source(bytes);
  ExactModelReader reader(source, bytes.size(), local_whisper::common::sha256(bytes));
  reader.skip_exact(bytes.size());
  source.set_tail_after_reported_size(true);
  EXPECT_THROW(reader.verify_complete(), CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
