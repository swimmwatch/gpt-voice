#include <iostream>

#include "whisper.h"

#if defined(LOCAL_WHISPER_CUDA_LINK_SMOKE)
#include "ggml-cuda.h"

namespace {
ggml_backend_t (*volatile cuda_link_anchor)(int) = &ggml_backend_cuda_init;
}
#endif

int main() {
#if defined(LOCAL_WHISPER_CUDA_LINK_SMOKE)
  if (cuda_link_anchor == nullptr) {
    return 1;
  }
#endif
  const char* system_info = whisper_print_system_info();
  if (system_info == nullptr) {
    return 1;
  }
  std::cout << "LOCAL_WHISPER_BUILD_SMOKE_OK\n";
  return 0;
}
