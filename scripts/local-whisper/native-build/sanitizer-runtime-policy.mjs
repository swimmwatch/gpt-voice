const LINUX_SANITIZER_OPTIONS = Object.freeze({
  ASAN_OPTIONS: 'detect_leaks=1:halt_on_error=1:strict_string_checks=1',
  UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1',
});

const WINDOWS_ASAN_OPTIONS = Object.freeze({
  ASAN_OPTIONS: 'halt_on_error=1',
});

/** Returns only the supported non-recovering sanitizer runtime options for a native target platform. */
export function sanitizerRuntimeOptions(platform, enabled) {
  if (!enabled) return Object.freeze({});
  if (platform === 'linux') return LINUX_SANITIZER_OPTIONS;
  if (platform === 'windows') return WINDOWS_ASAN_OPTIONS;
  throw new Error(`Unsupported Local Whisper sanitizer platform: ${platform}`);
}

/** Adds the canonical sanitizer runtime options without exposing or replacing unrelated environment values. */
export function sanitizerRuntimeEnvironment(environment, platform, enabled) {
  return Object.freeze({ ...environment, ...sanitizerRuntimeOptions(platform, enabled) });
}
