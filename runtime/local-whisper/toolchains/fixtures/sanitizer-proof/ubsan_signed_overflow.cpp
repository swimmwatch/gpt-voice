#include <cstdint>
#include <limits>

int main() {
  volatile std::int32_t maximum = std::numeric_limits<std::int32_t>::max();
  volatile std::int32_t increment = 1;
  return maximum + increment;
}
