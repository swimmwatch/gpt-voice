#include <cstdint>
#include <memory>

int main() {
  auto value = std::make_unique<std::uint32_t>(7U);
  volatile std::uint32_t* released = value.get();
  value.reset();
  return static_cast<int>(*released);
}
