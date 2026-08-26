#pragma once

namespace local_whisper::common {

inline constexpr int kInvalidInvocationExitCode = 2;
inline constexpr int kLauncherBootstrapFailureExitCode = 10;
inline constexpr int kModelLaunchFailureExitCode = 20;
inline constexpr int kChildExecBootstrapFailureExitCode = 126;
inline constexpr int kChildStatusUnavailableExitCode = 1;
inline constexpr int kChildSignalExitCodeBase = 128;
inline constexpr int kForcedJobTerminationExitCode = 1;

} // namespace local_whisper::common
