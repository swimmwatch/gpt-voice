import { STOP_HOOK_ACKNOWLEDGEMENT_FILE_NAME } from './atomic-state-store.mjs';
import {
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';
import { WATCH_OUTCOMES, validateSafeId, validateWatchId } from './runtime-state-contracts.mjs';

export const STOP_HOOK_ACKNOWLEDGEMENT_SCHEMA_VERSION = 1;
export const STOP_HOOK_CLEANUP_MARGIN_SECONDS = 120;
export const STOP_HOOK_TIMEOUT_SECONDS = 604_920;
export const STOP_HOOK_MAXIMUM_WATCH_TIMEOUT_SECONDS = 604_800;

const STOP_HOOK_INPUT_FIELDS = Object.freeze([
  'cwd',
  'hook_event_name',
  'last_assistant_message',
  'session_id',
  'stop_hook_active',
  'turn_id',
]);

function assertRecord(value, code) {
  if (!isRecord(value)) runtimeFail(code);
  return value;
}

function normalizeCwd(value) {
  const cwd = requireString(value, 'invalid-stop-hook-input', { minimum: 1, maximum: 4_096 });
  for (const character of cwd) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) runtimeFail('invalid-stop-hook-input');
  }
  return cwd;
}

function normalizeOutcome(value, code) {
  if (typeof value !== 'string' || !WATCH_OUTCOMES.includes(value)) runtimeFail(code);
  return value;
}

/** Validates only the documented Stop-hook fields used by the project-local handler. */
export function normalizeStopHookInput(value) {
  const input = assertRecord(value, 'invalid-stop-hook-input');
  for (const field of STOP_HOOK_INPUT_FIELDS) {
    if (!Object.hasOwn(input, field)) runtimeFail('invalid-stop-hook-input');
  }
  if (input.hook_event_name !== 'Stop' || typeof input.stop_hook_active !== 'boolean') {
    runtimeFail('invalid-stop-hook-input');
  }
  if (input.last_assistant_message !== null && typeof input.last_assistant_message !== 'string') {
    runtimeFail('invalid-stop-hook-input');
  }
  return freezeRecord({
    cwd: normalizeCwd(input.cwd),
    sessionId: validateSafeId(input.session_id, 'invalid-stop-hook-input'),
    stopHookActive: input.stop_hook_active,
    turnId: validateSafeId(input.turn_id, 'invalid-stop-hook-input'),
  });
}

/** Keeps configured hook time above every user-approved observation window. */
export function assertStopHookBudget({ hookTimeoutSeconds = STOP_HOOK_TIMEOUT_SECONDS, timeoutSeconds } = {}) {
  const selectedTimeoutSeconds = requirePositiveInteger(
    timeoutSeconds,
    'invalid-stop-hook-timeout',
    STOP_HOOK_MAXIMUM_WATCH_TIMEOUT_SECONDS,
  );
  const configuredHookTimeoutSeconds = requirePositiveInteger(
    hookTimeoutSeconds,
    'invalid-stop-hook-timeout',
    STOP_HOOK_TIMEOUT_SECONDS,
  );
  if (configuredHookTimeoutSeconds < selectedTimeoutSeconds + STOP_HOOK_CLEANUP_MARGIN_SECONDS) {
    runtimeFail('stop-hook-timeout-ceiling-too-low');
  }
  return freezeRecord({
    approvedTimeoutSeconds: selectedTimeoutSeconds,
    cleanupMarginSeconds: STOP_HOOK_CLEANUP_MARGIN_SECONDS,
    hookCeilingSeconds: configuredHookTimeoutSeconds,
  });
}

/** Produces the only persisted acknowledgement shape; assistant text is never retained. */
export function normalizeStopHookAcknowledgement(value) {
  const acknowledgement = assertRecord(value, 'invalid-stop-hook-acknowledgement');
  const fields = new Set(['generation', 'outcome', 'schemaVersion', 'sessionId', 'turnId', 'watchId']);
  for (const field of Object.keys(acknowledgement)) {
    if (!fields.has(field)) runtimeFail('invalid-stop-hook-acknowledgement');
  }
  for (const field of fields) {
    if (!Object.hasOwn(acknowledgement, field)) runtimeFail('invalid-stop-hook-acknowledgement');
  }
  if (acknowledgement.schemaVersion !== STOP_HOOK_ACKNOWLEDGEMENT_SCHEMA_VERSION) {
    runtimeFail('invalid-stop-hook-acknowledgement');
  }
  return freezeRecord({
    generation: requireNonNegativeInteger(
      acknowledgement.generation,
      'invalid-stop-hook-acknowledgement',
      1_000_000_000,
    ),
    outcome: normalizeOutcome(acknowledgement.outcome, 'invalid-stop-hook-acknowledgement'),
    schemaVersion: STOP_HOOK_ACKNOWLEDGEMENT_SCHEMA_VERSION,
    sessionId: validateSafeId(acknowledgement.sessionId, 'invalid-stop-hook-acknowledgement'),
    turnId: validateSafeId(acknowledgement.turnId, 'invalid-stop-hook-acknowledgement'),
    watchId: validateWatchId(acknowledgement.watchId, 'invalid-stop-hook-acknowledgement'),
  });
}

export function isStopHookAcknowledged(acknowledgement, state) {
  return (
    acknowledgement !== null &&
    acknowledgement.generation === state.generation &&
    acknowledgement.outcome === state.outcome &&
    acknowledgement.sessionId === state.sessionId &&
    acknowledgement.watchId === state.watchId
  );
}

/** Returns a fixed continuation prompt that never includes paths, evidence, or input text. */
export function stopHookContinuation({ generation, outcome, watchId } = {}) {
  const normalizedGeneration = requireNonNegativeInteger(generation, 'invalid-stop-hook-generation', 1_000_000_000);
  const normalizedOutcome = normalizeOutcome(outcome, 'invalid-stop-hook-outcome');
  const normalizedWatchId = validateWatchId(watchId, 'invalid-stop-hook-watch-id');
  if (normalizedOutcome === 'running') runtimeFail('invalid-stop-hook-outcome');
  return freezeRecord({
    decision: 'block',
    reason: `process-watch continuation --watch-id ${normalizedWatchId} --generation ${normalizedGeneration} --outcome ${normalizedOutcome}`,
  });
}

/** Supplies the three separately reportable timeout values to later status surfaces. */
export function stopHookTimingSummary(state, { hookTimeoutSeconds = STOP_HOOK_TIMEOUT_SECONDS } = {}) {
  const budget = assertStopHookBudget({ hookTimeoutSeconds, timeoutSeconds: state.timeoutSeconds });
  return freezeRecord({
    approvedTimeoutSeconds: budget.approvedTimeoutSeconds,
    effectiveAttemptDeadlineEpochMilliseconds: requireNonNegativeInteger(
      state.deadlineEpochMilliseconds,
      'invalid-stop-hook-deadline',
      Number.MAX_SAFE_INTEGER,
    ),
    hookCeilingSeconds: budget.hookCeilingSeconds,
  });
}

export { STOP_HOOK_ACKNOWLEDGEMENT_FILE_NAME };
