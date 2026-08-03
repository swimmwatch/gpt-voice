#include "local_whisper/fs_guard/model_launch_request.hpp"

#include "local_whisper/fs_guard/error.hpp"
#include "local_whisper/fs_guard/protocol.hpp"

#include <gtest/gtest.h>

#include <array>
#include <sstream>
#include <string>
#include <vector>

namespace local_whisper::fs_guard {
namespace {

std::string launcher_bootstrap(const std::string& nonce) {
  std::vector<std::string> fields = {"LWLP2", nonce, "fullLoad"};
  while (fields.size() < 20U)
    fields.emplace_back("field");
  std::ostringstream output;
  for (std::size_t index = 0; index < fields.size(); ++index) {
    if (index != 0U)
      output << '\t';
    output << fields[index];
  }
  return output.str();
}

std::vector<std::string> valid_fields() {
  const std::string nonce = "model-launch-nonce-0001";
  const std::array<char, 16> operation_nonce = {'0', '1', '2', '3', '4', '5', '6', '7',
                                                '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};
  return {"LWGL1",
          nonce,
          base64url_encode("/opt/gpt-voice/local-whisper-launcher"),
          std::string(64, 'a'),
          base64url_encode(launcher_bootstrap(nonce)),
          base64url_encode("/private/models/file-model"),
          std::string(64, 'b'),
          "200",
          base64url_encode("1"),
          base64url_encode("2"),
          "1",
          "384",
          base64url_encode("3"),
          "200",
          "regular",
          "7",
          std::string(64, 'c'),
          std::string(64, 'd'),
          base64url_encode(std::string(operation_nonce.begin(), operation_nonce.end())),
          "40"};
}

std::string join_fields(const std::vector<std::string>& fields) {
  std::ostringstream output;
  for (std::size_t index = 0; index < fields.size(); ++index) {
    if (index != 0U)
      output << '\t';
    output << fields[index];
  }
  return output.str();
}

TEST(ModelLaunchRequestTest, ParsesExactBoundedRequest) {
  const ModelLaunchRequest request = ModelLaunchRequestParser{}.parse(join_fields(valid_fields()));
  EXPECT_EQ(request.app_instance_nonce, "model-launch-nonce-0001");
  EXPECT_EQ(request.launcher_path, "/opt/gpt-voice/local-whisper-launcher");
  EXPECT_EQ(request.model_path, "/private/models/file-model");
  EXPECT_EQ(request.model_size_bytes, 200U);
  EXPECT_EQ(request.model_identity.mode, 0600U);
  EXPECT_EQ(request.configuration_epoch, 7U);
  EXPECT_EQ(request.worker_bootstrap_bytes, 40U);
}

TEST(ModelLaunchRequestTest, RejectsChangedBindingAndBootstrapShape) {
  for (const auto& mutation : std::array<std::pair<std::size_t, std::string>, 7>{
           std::pair{0U, "LWGL2"},
           std::pair{6U, std::string(63, 'b')},
           std::pair{10U, "2"},
           std::pair{13U, "201"},
           std::pair{14U, "directory"},
           std::pair{18U, base64url_encode(std::string(16, '\0'))},
           std::pair{19U, "41"},
       }) {
    auto fields = valid_fields();
    fields[mutation.first] = mutation.second;
    EXPECT_THROW(static_cast<void>(ModelLaunchRequestParser{}.parse(join_fields(fields))),
                 GuardError);
  }
  auto fields = valid_fields();
  fields[4] = base64url_encode("LWLP2\tother-nonce\tfullLoad");
  EXPECT_THROW(static_cast<void>(ModelLaunchRequestParser{}.parse(join_fields(fields))),
               GuardError);
}

} // namespace
} // namespace local_whisper::fs_guard
