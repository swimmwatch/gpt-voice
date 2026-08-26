#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace local_whisper::common::test_support {

struct Sha256Vector final {
  std::string name;
  std::vector<std::uint8_t> bytes;
  std::string expected_hex;
};

inline std::vector<Sha256Vector> shared_sha256_vectors() {
  return {
      {"empty", {}, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
      {"abc", {'a', 'b', 'c'}, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},
      {"55-a", std::vector<std::uint8_t>(55U, 'a'),
       "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318"},
      {"56-a", std::vector<std::uint8_t>(56U, 'a'),
       "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"},
      {"63-a", std::vector<std::uint8_t>(63U, 'a'),
       "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34"},
      {"64-a", std::vector<std::uint8_t>(64U, 'a'),
       "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"},
      {"65-a", std::vector<std::uint8_t>(65U, 'a'),
       "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0"},
      {"two-block-a", std::vector<std::uint8_t>(128U, 'a'),
       "6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e"},
  };
}

} // namespace local_whisper::common::test_support
