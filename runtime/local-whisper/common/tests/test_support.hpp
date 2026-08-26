#pragma once

#include "local_whisper/common/nlohmann_json.hpp"

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

namespace local_whisper::common::test_support {

inline std::filesystem::path fixture_root() { return LOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT; }

inline std::vector<std::uint8_t> read_binary(const std::string& relative_path) {
  std::ifstream input(fixture_root() / relative_path, std::ios::binary);
  if (!input)
    throw std::runtime_error("fixture unavailable");
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

inline nlohmann::json manifest() {
  std::ifstream input(fixture_root() / "manifest.json");
  if (!input)
    throw std::runtime_error("manifest unavailable");
  return nlohmann::json::parse(input);
}

} // namespace local_whisper::common::test_support
