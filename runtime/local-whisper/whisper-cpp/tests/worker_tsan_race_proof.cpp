#include <atomic>
#include <cstdint>
#include <thread>

namespace {

constexpr std::uint32_t kContenderCount = 2U;
constexpr std::uint32_t kRaceIterations = 4'096U;

} // namespace

int main() {
  std::atomic_uint32_t contenders{0U};
  std::atomic_bool start{false};
  std::uint32_t intentionally_racy_counter = 0U;

  const auto contend = [&] {
    contenders.fetch_add(1U, std::memory_order_acq_rel);
    while (contenders.load(std::memory_order_acquire) != kContenderCount)
      std::this_thread::yield();
    while (!start.load(std::memory_order_acquire))
      std::this_thread::yield();
    for (std::uint32_t iteration = 0U; iteration < kRaceIterations; ++iteration)
      ++intentionally_racy_counter;
  };

  std::thread first(contend);
  std::thread second(contend);
  while (contenders.load(std::memory_order_acquire) != kContenderCount)
    std::this_thread::yield();
  start.store(true, std::memory_order_release);
  first.join();
  second.join();
  static_cast<void>(intentionally_racy_counter);
  return 0;
}
