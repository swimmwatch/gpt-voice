#include "local_whisper/common/sha256.hpp"

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <thread>

namespace {

constexpr std::size_t kThreadCount = 8U;
constexpr std::array<std::uint8_t, 3> kInput = {'a', 'b', 'c'};
constexpr std::array<std::uint8_t, 32> kExpectedDigest = {
    0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae, 0x22, 0x23,
    0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61, 0xf2, 0x00, 0x15, 0xad,
};

} // namespace

int main() {
  std::atomic_size_t ready{0U};
  std::atomic_bool start{false};
  std::atomic_size_t failures{0U};
  std::array<std::thread, kThreadCount> threads;

  for (std::thread& thread : threads) {
    thread = std::thread([&] {
      ready.fetch_add(1U, std::memory_order_acq_rel);
      while (!start.load(std::memory_order_acquire))
        std::this_thread::yield();

      local_whisper::common::Sha256 hash;
      hash.update(kInput);
      if (hash.finish() != kExpectedDigest)
        failures.fetch_add(1U, std::memory_order_relaxed);
    });
  }

  while (ready.load(std::memory_order_acquire) != kThreadCount)
    std::this_thread::yield();
  start.store(true, std::memory_order_release);
  for (std::thread& thread : threads)
    thread.join();

  return failures.load(std::memory_order_relaxed) == 0U ? 0 : 1;
}
