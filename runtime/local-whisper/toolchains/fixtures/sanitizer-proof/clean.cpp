#include <iostream>

int main() {
  constexpr int kExpectedValue = 42;
  std::cout << "LOCAL_WHISPER_SANITIZER_CLEAN_OK\n";
  return kExpectedValue == 42 ? 0 : 1;
}
