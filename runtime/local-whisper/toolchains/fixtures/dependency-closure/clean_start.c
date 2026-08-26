#include <stdint.h>
#include <stdio.h>

int32_t local_whisper_fixture_value(void);

int main(void) {
  if (local_whisper_fixture_value() != 42) {
    return 1;
  }
  puts("LOCAL_WHISPER_RELOCATED_CLEAN_OK");
  return 0;
}
