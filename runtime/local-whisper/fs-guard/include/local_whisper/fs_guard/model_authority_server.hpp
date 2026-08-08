#pragma once

#include "local_whisper/common/model_authority.hpp"

namespace local_whisper::fs_guard {

class LinuxModelAuthorityServer final {
public:
  LinuxModelAuthorityServer(local_whisper::common::AuthorityBinding expected_binding,
                            int model_descriptor);

  void transfer_once(int channel_descriptor);

private:
  local_whisper::common::AuthorityBinding expected_binding_;
  int model_descriptor_;
  local_whisper::common::AuthorityReplayGuard replay_guard_;
};

} // namespace local_whisper::fs_guard
