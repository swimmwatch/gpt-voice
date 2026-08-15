const LINUX_TSAN_OPTIONS = Object.freeze({
  TSAN_OPTIONS: 'halt_on_error=1:second_deadlock_stack=1',
});

/** Returns the supported non-recovering ThreadSanitizer runtime options for the Linux worker gate. */
export function threadSanitizerRuntimeOptions(platform) {
  if (platform !== 'linux') throw new Error(`Unsupported Local Whisper ThreadSanitizer platform: ${platform}`);
  return LINUX_TSAN_OPTIONS;
}

/** Removes injected preload tooling from TSan execution while preserving unrelated environment values. */
export function threadSanitizerRuntimeEnvironment(environment, platform) {
  const runtimeEnvironment = { ...environment };
  delete runtimeEnvironment.LD_PRELOAD;
  return Object.freeze({ ...runtimeEnvironment, ...threadSanitizerRuntimeOptions(platform) });
}
