#include "local_whisper/launcher/launch_request.hpp"

#include <iostream>

int main() {
  std::cout << "launcher-request\t" << local_whisper::launcher::kMaximumLaunchRequestBytes + 1U
            << '\n';
  return 0;
}
