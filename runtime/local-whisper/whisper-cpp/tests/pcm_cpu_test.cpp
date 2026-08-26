#include "local_whisper/whisper_cpp/cpu_probe.hpp"
#include "local_whisper/whisper_cpp/error.hpp"
#include "local_whisper/whisper_cpp/pcm_audio.hpp"

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <vector>

namespace local_whisper::whisper_cpp {
namespace {

void write_u16(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint16_t value) {
  bytes[offset] = static_cast<std::uint8_t>(value);
  bytes[offset + 1U] = static_cast<std::uint8_t>(value >> 8U);
}

void write_u32(std::vector<std::uint8_t>& bytes, std::size_t offset, std::uint32_t value) {
  for (std::size_t index = 0; index < 4U; ++index)
    bytes[offset + index] = static_cast<std::uint8_t>(value >> (index * 8U));
}

std::vector<std::uint8_t> wav_fixture() {
  std::vector<std::uint8_t> bytes(48U);
  for (const auto& [offset, text] : {std::pair<std::size_t, const char*>(0U, "RIFF"),
                                     {8U, "WAVE"},
                                     {12U, "fmt "},
                                     {36U, "data"}}) {
    for (std::size_t index = 0; index < 4U; ++index)
      bytes[offset + index] = static_cast<std::uint8_t>(text[index]);
  }
  write_u32(bytes, 4U, 40U);
  write_u32(bytes, 16U, 16U);
  write_u16(bytes, 20U, 1U);
  write_u16(bytes, 22U, 1U);
  write_u32(bytes, 24U, 16'000U);
  write_u32(bytes, 28U, 32'000U);
  write_u16(bytes, 32U, 2U);
  write_u16(bytes, 34U, 16U);
  write_u32(bytes, 40U, 4U);
  write_u16(bytes, 44U, 0x8000U);
  write_u16(bytes, 46U, 0x7fffU);
  return bytes;
}

TEST(PcmAudio, ConvertsCanonicalPcm16WithoutTemporaryFiles) {
  const auto audio = PcmAudio::from_canonical_wav(wav_fixture());
  ASSERT_EQ(audio.samples().size(), 2U);
  EXPECT_FLOAT_EQ(audio.samples()[0], -1.0F);
  EXPECT_NEAR(audio.samples()[1], 1.0F, 0.0001F);
  auto malformed = wav_fixture();
  malformed[24] = 0U;
  EXPECT_THROW(static_cast<void>(PcmAudio::from_canonical_wav(malformed)), CoreError);
}

TEST(CpuProbe, ExecutesBoundedBaselineComputeAndValidatesThreadRange) {
  const CpuProbe probe;
  const auto evidence = probe.run(1U);
  EXPECT_GT(evidence.logical_processors, 0U);
  EXPECT_EQ(evidence.resolved_threads, 1U);
  EXPECT_NE(evidence.compute_digest, 0U);
  const auto maximum = probe.run(kMaxLogicalProcessorCount);
  EXPECT_EQ(maximum.resolved_threads, maximum.logical_processors);
  EXPECT_THROW(static_cast<void>(probe.run(0U)), CoreError);
  EXPECT_THROW(static_cast<void>(probe.run(kMaxLogicalProcessorCount + 1U)), CoreError);
}

} // namespace
} // namespace local_whisper::whisper_cpp
