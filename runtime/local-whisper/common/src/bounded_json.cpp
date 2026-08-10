#include "local_whisper/common/bounded_json.hpp"
#include "local_whisper/common/nlohmann_json.hpp"

#include <charconv>
#include <cstdint>
#include <limits>
#include <string_view>
#include <unordered_set>
#include <utility>
#include <vector>

namespace local_whisper::common {
namespace {

constexpr std::size_t kMaxRawBytes = 1'048'576;
constexpr std::size_t kMaxEvents = 4'096;
constexpr std::size_t kMaxDepth = 16;
constexpr std::size_t kMaxMembers = 128;
constexpr std::size_t kMaxElements = 256;
constexpr std::size_t kMaxKeyBytes = 128;
constexpr std::size_t kMaxStringBytes = 262'144;
constexpr std::int64_t kSafeIntegerMax = 9'007'199'254'740'991LL;

bool is_delimiter(char value) {
  return value == ' ' || value == '\t' || value == '\r' || value == '\n' || value == ',' ||
         value == ']' || value == '}';
}

bool validate_integer_token(std::string_view token) {
  if (token.empty())
    return false;
  std::size_t offset = 0;
  if (token.front() == '-') {
    offset = 1;
    if (offset == token.size() || token[offset] == '0')
      return false;
  }
  if (token[offset] == '0') {
    if (offset + 1 != token.size())
      return false;
  } else {
    if (token[offset] < '1' || token[offset] > '9')
      return false;
    for (std::size_t index = offset + 1; index < token.size(); ++index) {
      if (token[index] < '0' || token[index] > '9')
        return false;
    }
  }
  std::int64_t parsed = 0;
  const auto result = std::from_chars(token.data(), token.data() + token.size(), parsed);
  return result.ec == std::errc{} && result.ptr == token.data() + token.size() &&
         parsed >= -kSafeIntegerMax && parsed <= kSafeIntegerMax;
}

bool validate_number_lexemes(std::string_view source) {
  bool in_string = false;
  bool escaped = false;
  for (std::size_t index = 0; index < source.size();) {
    const char value = source[index];
    if (in_string) {
      if (escaped)
        escaped = false;
      else if (value == '\\')
        escaped = true;
      else if (value == '"')
        in_string = false;
      ++index;
      continue;
    }
    if (value == '"') {
      in_string = true;
      ++index;
      continue;
    }
    if (value != '-' && (value < '0' || value > '9')) {
      ++index;
      continue;
    }
    std::size_t end = index + 1;
    while (end < source.size() && !is_delimiter(source[end]) && source[end] != ':' &&
           source[end] != '[' && source[end] != '{')
      ++end;
    if (!validate_integer_token(source.substr(index, end - index)))
      return false;
    index = end;
  }
  return !in_string;
}

class BoundedSax final : public nlohmann::json_sax<nlohmann::json> {
public:
  bool null() override { return primitive(); }
  bool boolean(bool) override { return primitive(); }
  bool number_integer(number_integer_t) override { return primitive(); }
  bool number_unsigned(number_unsigned_t) override { return primitive(); }
  bool number_float(number_float_t, const string_t&) override { return fail("float"); }
  bool string(string_t& value) override {
    if (value.size() > kMaxStringBytes)
      return fail("string limit");
    return primitive();
  }
  bool binary(binary_t&) override { return fail("binary"); }

  bool start_object(std::size_t) override {
    if (!begin_value() || !event() || stack_.size() + 1U > kMaxDepth)
      return fail("object limit");
    stack_.push_back(Container{ContainerKind::object, 0, {}});
    return true;
  }

  bool key(string_t& value) override {
    if (stack_.empty() || stack_.back().kind != ContainerKind::object ||
        ++stack_.back().count > kMaxMembers || value.size() > kMaxKeyBytes || !event())
      return fail("key limit");
    if (!stack_.back().keys.insert(value).second)
      return fail("duplicate key");
    return true;
  }

  bool end_object() override { return end_container(ContainerKind::object); }

  bool start_array(std::size_t) override {
    if (!begin_value() || !event() || stack_.size() + 1U > kMaxDepth)
      return fail("array limit");
    stack_.push_back(Container{ContainerKind::array, 0, {}});
    return true;
  }

  bool end_array() override { return end_container(ContainerKind::array); }

  bool parse_error(std::size_t, const std::string&, const nlohmann::detail::exception&) override {
    return fail("parse error");
  }

  [[nodiscard]] std::size_t events() const noexcept { return events_; }
  [[nodiscard]] const std::string& error() const noexcept { return error_; }

private:
  enum class ContainerKind { object, array };
  struct Container {
    ContainerKind kind;
    std::size_t count;
    std::unordered_set<std::string> keys;
  };

  bool event() {
    ++events_;
    return events_ <= kMaxEvents;
  }

  bool begin_value() {
    if (stack_.empty() || stack_.back().kind == ContainerKind::object)
      return true;
    ++stack_.back().count;
    return stack_.back().count <= kMaxElements;
  }

  bool primitive() { return begin_value() && event(); }

  bool end_container(ContainerKind expected) {
    if (stack_.empty() || stack_.back().kind != expected || !event())
      return fail("container end");
    stack_.pop_back();
    return true;
  }

  bool fail(std::string value) {
    if (error_.empty())
      error_ = std::move(value);
    return false;
  }

  std::vector<Container> stack_;
  std::size_t events_ = 0;
  std::string error_;
};

} // namespace

JsonValidationResult validate_bounded_json(std::span<const std::uint8_t> bytes) {
  if (bytes.size() > kMaxRawBytes)
    return {false, 0, "raw byte limit"};
  const std::string source(reinterpret_cast<const char*>(bytes.data()), bytes.size());
  if (!validate_number_lexemes(source))
    return {false, 0, "integer lexeme"};
  BoundedSax sax;
  const bool valid =
      nlohmann::json::sax_parse(source, &sax, nlohmann::json::input_format_t::json, true, false);
  return {valid, sax.events(), valid ? std::string{} : sax.error()};
}

} // namespace local_whisper::common
