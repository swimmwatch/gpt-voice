#include "platform/linux/poll_direction.hpp"

#ifndef _WIN32

#include <gtest/gtest.h>

#include <array>

#include <poll.h>
#include <unistd.h>

namespace local_whisper::launcher {
namespace {

TEST(PollDirection, PermanentlyDisablesAClosedInputAfterOneWakeup) {
  std::array<int, 2> descriptors{};
  ASSERT_EQ(pipe(descriptors.data()), 0);
  ASSERT_EQ(close(descriptors[1]), 0);

  bool open = true;
  struct pollfd input {
    linux_detail::active_poll_descriptor(open, descriptors[0]),
        static_cast<short>(POLLIN | POLLHUP | POLLERR), 0
  };
  ASSERT_EQ(poll(&input, 1, 100), 1);
  EXPECT_TRUE(linux_detail::disable_on_terminal_poll_event(input.revents, open));

  input = {linux_detail::active_poll_descriptor(open, descriptors[0]),
           static_cast<short>(POLLIN | POLLHUP | POLLERR), 0};
  EXPECT_EQ(poll(&input, 1, 25), 0);
  EXPECT_EQ(close(descriptors[0]), 0);
}

} // namespace
} // namespace local_whisper::launcher

#endif
