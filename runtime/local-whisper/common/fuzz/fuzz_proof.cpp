#include <cstddef>
#include <cstdint>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t*, std::size_t) {
  int* value = new int(7);
  const volatile std::uintptr_t address = reinterpret_cast<std::uintptr_t>(value);
  delete value;
  // Intentional ASan proof target: retain the invalid read so the fuzz runner proves detection.
  return *reinterpret_cast<volatile int*>(address);
}
