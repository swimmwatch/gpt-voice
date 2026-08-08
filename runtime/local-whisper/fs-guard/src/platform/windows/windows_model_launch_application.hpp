#pragma once

#ifdef _WIN32

namespace local_whisper::fs_guard {

int run_windows_model_launch(int control_descriptor, int acknowledgment_descriptor);

} // namespace local_whisper::fs_guard

#endif
