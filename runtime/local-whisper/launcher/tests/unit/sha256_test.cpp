#include "local_whisper/launcher/sha256.hpp"

#include <gtest/gtest.h>

#include <array>
#include <stdexcept>
#include <string>

namespace local_whisper::launcher {
namespace {

std::string digest(const std::string& input) {
  Sha256 hash;
  hash.update(reinterpret_cast<const unsigned char*>(input.data()), input.size());
  return hash.finish_hex();
}

TEST(Sha256Test, MatchesStandardVectors) {
  EXPECT_EQ(digest(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  EXPECT_EQ(digest("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  EXPECT_EQ(digest(std::string(1'000'000, 'a')),
            "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
}

TEST(Sha256Test, SupportsChunkedUpdatesAndSingleFinish) {
  Sha256 hash;
  const std::array<unsigned char, 2> first = {'a', 'b'};
  const std::array<unsigned char, 1> second = {'c'};
  hash.update(first.data(), first.size());
  hash.update(second.data(), second.size());
  EXPECT_EQ(hash.finish_hex(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  EXPECT_THROW(static_cast<void>(hash.finish_hex()), std::runtime_error);
  EXPECT_THROW(hash.update(nullptr, 1), std::runtime_error);
}

} // namespace
} // namespace local_whisper::launcher
