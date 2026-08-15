#pragma once

#include <poll.h>

namespace local_whisper::launcher::linux_detail {

inline int active_poll_descriptor(const bool open, const int descriptor) noexcept {
  return open ? descriptor : -1;
}

inline bool disable_on_terminal_poll_event(const short events, bool& open) noexcept {
  if ((events & (POLLHUP | POLLERR | POLLNVAL)) == 0)
    return false;
  open = false;
  return true;
}

} // namespace local_whisper::launcher::linux_detail
