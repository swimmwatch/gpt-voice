#include <gtest/gtest.h>

#if defined(_WIN32)
#include "platform/windows/unique_handle.hpp"

#include <windows.h>
#else
#include "platform/linux/unique_fd.hpp"

#include <cerrno>
#include <fcntl.h>
#include <unistd.h>
#endif

#include <utility>

namespace local_whisper::fs_guard {
namespace {

#if defined(_WIN32)
TEST(ResourceOwnershipTest, UniqueHandleMovesAndClosesExactlyOnce) {
  const HANDLE raw = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  ASSERT_NE(raw, nullptr);
  {
    UniqueHandle first(raw);
    UniqueHandle second(std::move(first));
    EXPECT_FALSE(first.valid());
    EXPECT_TRUE(second.valid());
  }
  EXPECT_EQ(SetEvent(raw), FALSE);
  EXPECT_EQ(GetLastError(), ERROR_INVALID_HANDLE);
}
#else
TEST(ResourceOwnershipTest, UniqueFdMovesAndClosesExactlyOnce) {
  int descriptors[2] = {-1, -1};
  ASSERT_EQ(pipe(descriptors), 0);
  const int raw = descriptors[0];
  {
    UniqueFd first(descriptors[0]);
    UniqueFd second(std::move(first));
    UniqueFd writer(descriptors[1]);
    EXPECT_FALSE(first.valid());
    EXPECT_TRUE(second.valid());
    EXPECT_TRUE(writer.valid());
  }
  errno = 0;
  EXPECT_EQ(fcntl(raw, F_GETFD), -1);
  EXPECT_EQ(errno, EBADF);
}
#endif

} // namespace
} // namespace local_whisper::fs_guard
