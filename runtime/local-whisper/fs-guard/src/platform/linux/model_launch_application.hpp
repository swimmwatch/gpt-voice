#pragma once

namespace local_whisper::fs_guard {

[[nodiscard]] int run_linux_model_launch(int control_descriptor, int acknowledgment_descriptor);

} // namespace local_whisper::fs_guard
