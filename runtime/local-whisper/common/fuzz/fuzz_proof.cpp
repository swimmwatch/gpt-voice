#include <cstddef>
#include <cstdint>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t*, std::size_t) {
  int* value = new int(7);
  delete value;
  return *static_cast<volatile int*>(value);
}
