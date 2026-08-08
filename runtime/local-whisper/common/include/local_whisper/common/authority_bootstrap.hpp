#pragma once

#include "local_whisper/common/model_authority.hpp"

#include <array>
#include <cstdint>

namespace local_whisper::common {

void authorize_worker_model_bootstrap(
    int worker_input_descriptor, int worker_output_descriptor, const AuthorityBinding& binding,
    std::uint64_t worker_pid, const std::array<std::uint8_t, 32>& worker_start_identity_sha256);

[[nodiscard]] AuthorityBinding
receive_worker_model_bootstrap(int input_descriptor, int output_descriptor, int model_descriptor);

} // namespace local_whisper::common
