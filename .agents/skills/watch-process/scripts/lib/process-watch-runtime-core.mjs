/** Stable, provider-neutral public surface for generated watcher runtime composition. */
export { BoundedEvidenceBuffer } from './bounded-evidence-buffer.mjs';
export { DeadlineAwarePoller, normalizePollTiming, waitForAbortableDelay } from './deadline-aware-poller.mjs';
export { createFailureFingerprint } from './failure-fingerprint.mjs';
export { ManagedProcessExecution } from './managed-process-execution.mjs';
export { ManagedProcessRunner, isRuntimeCoreError } from './managed-process-runner.mjs';
export { terminateOwnedProcessTree } from './managed-process-support.mjs';
export { MonotonicDeadline } from './monotonic-deadline.mjs';
export {
  PROCESS_OBSERVATION_STATUSES,
  PROCESS_TERMINAL_CLASSIFICATIONS,
  ProcessAdapter,
  WATCH_FAILURE_OUTCOMES,
  normalizeProcessTerminal,
} from './runtime-contracts.mjs';
export {
  PROCESS_START_TOKEN_PATTERN,
  RUNTIME_CODE_PATTERN,
  RuntimeCoreError,
  SHA_256_PATTERN,
  SUPPORTED_NODE_MAJORS,
} from './runtime-core-support.mjs';
export {
  assertSupportedNodeRuntime,
  buildAllowlistedEnvironment,
  isPathInside,
  resolveValidatedWorkingDirectory,
  validateExecutable,
  validateProcessArguments,
  validateProcessCommand,
} from './runtime-preflight.mjs';
