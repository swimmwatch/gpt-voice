#include <cstddef>
#include <cstdint>

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t*, std::size_t) {
  int* value = new int(7);
  delete value;
  // Intentional ASan proof target: retain the invalid read so the fuzz runner proves detection.
  return *static_cast<volatile int*>(value); // codeql[cpp/use-after-free]
}
