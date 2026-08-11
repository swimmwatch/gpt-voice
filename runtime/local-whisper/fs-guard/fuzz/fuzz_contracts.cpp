#include "local_whisper/fs_guard/protocol.hpp"

#include <iostream>

int main() {
  std::cout << "fs-guard-request\t" << local_whisper::fs_guard::kMaxLineBytes + 1U << '\n';
  return 0;
}
