#include "local_whisper/common/authority_bootstrap.hpp"

#include <string_view>

#include <unistd.h>

int main(int argc, char** argv) {
  if (argc != 2 || std::string_view(argv[1]) != "--authority-worker-fixture")
    return 2;
  try {
    static_cast<void>(
        local_whisper::common::receive_worker_model_bootstrap(STDIN_FILENO, STDOUT_FILENO, 3));
    return 0;
  } catch (...) {
    return 10;
  }
}
