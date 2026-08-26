import * as path from 'node:path';

import {
  PROCESS_START_TOKEN_PATTERN,
  RUNTIME_CODE_PATTERN,
  SHA_256_PATTERN,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';

export const RUNTIME_STATE_SCHEMA_VERSION = 1;
export const RUNTIME_AUDIT_SCHEMA_VERSION = 1;
export const OPERATION_RECEIPT_SCHEMA_VERSION = 2;
export const SUCCESS_ATTESTATION_SCHEMA_VERSION = 1;

export const WATCH_PHASES = freezeArray([
  'Armed',
  'Preparing',
  'Watching',
  'NeedsAgent',
  'Repairing',
  'Verifying',
  'Restarting',
  'Finalizing',
  'Success',
  'Blocked',
  'Cancelled',
]);

export const WATCH_OUTCOMES = freezeArray([
  'running',
  'succeeded',
  'target_failed',
  'verification_failed',
  'delivery_failed',
  'dispatch_failed',
  'authentication_failed',
  'watcher_lost',
  'target_lost',
  'user_cancelled',
  'target_cancelled',
  'timed_out',
  'monitoring_failed',
  'scenario_changed',
  'integrity_failed',
]);

export const WATCH_BLOCKERS = freezeArray([
  'ambiguous-operation',
  'atomicity-uncertain',
  'authentication-failed',
  'delivery-failed',
  'dispatch-failed',
  'integrity-failed',
  'lock-ownership-mismatch',
  'scenario-changed',
  'target-lost',
  'verification-failed',
  'watcher-lost',
]);

export const AUDIT_ACTORS = freezeArray(['watcher', 'hook', 'agent']);
export const OPERATION_KINDS = freezeArray(['start', 'retry', 'dispatch', 'delivery']);
export const TERMINAL_CLASSIFICATIONS = freezeArray([
  'succeeded',
  'nonzero_exit',
  'signalled',
  'timed_out',
  'aborted',
  'spawn_failed',
  'cleanup_unconfirmed',
]);

const SAFE_ID_PATTERN = /^(?!_)\w[\w.:-]{2,127}$/u;
const WATCH_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;
const RECEIPT_ID_PATTERN = /^receipt-[a-z0-9-]{3,63}$/u;
const SOURCE_SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const RELATIVE_PATH_SEGMENT_PATTERN = /^(?!_)\w[\w.-]{0,127}$/u;
const TARGET_ID_PATTERN = /^\w[\w.:@#=/-]{0,511}$/u;

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function assertRequiredFields(record, fields, code) {
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) runtimeFail(code);
  }
}

function hasControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function validateStringArray(value, code, itemValidator, maximum = 100) {
  if (!Array.isArray(value) || value.length > maximum) runtimeFail(code);
  const normalized = value.map((item) => itemValidator(item, code));
  if (new Set(normalized).size !== normalized.length) runtimeFail(code);
  return freezeArray(normalized);
}

function normalizeNullableEnum(value, values, code) {
  if (value === null) return null;
  if (typeof value !== 'string' || !values.includes(value)) runtimeFail(code);
  return value;
}

function normalizeNullableSourceSha(value, code) {
  if (value === null) return null;
  return validateSourceSha(value, code);
}

function normalizeStateTarget(value, code) {
  if (value === null) return null;
  const target = assertClosedRecord(value, new Set(['attempt', 'identityDigest', 'sourceSha', 'targetId']), code);
  assertRequiredFields(target, ['attempt', 'identityDigest', 'sourceSha', 'targetId'], code);
  return freezeRecord({
    attempt: requirePositiveInteger(target.attempt, code, 1_000_000),
    identityDigest: validateDigest(target.identityDigest, code),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function normalizeHeartbeat(value, code) {
  const heartbeat = assertClosedRecord(value, new Set(['atEpochMilliseconds', 'startToken']), code);
  assertRequiredFields(heartbeat, ['atEpochMilliseconds', 'startToken'], code);
  return freezeRecord({
    atEpochMilliseconds: requireNonNegativeInteger(heartbeat.atEpochMilliseconds, code, Number.MAX_SAFE_INTEGER),
    startToken: validateProcessStartToken(heartbeat.startToken, code),
  });
}

/** Validates a safe, bounded ID that cannot embed a path, command, or line break. */
export function validateSafeId(value, code = 'invalid-safe-id') {
  const id = requireString(value, code, { minimum: 3, maximum: 128 });
  if (!SAFE_ID_PATTERN.test(id) || hasControlCharacter(id)) runtimeFail(code);
  return id;
}

export function validateWatchId(value, code = 'invalid-watch-id') {
  const id = requireString(value, code, { minimum: 3, maximum: 64 });
  if (!WATCH_ID_PATTERN.test(id)) runtimeFail(code);
  return id;
}

export function validateDigest(value, code = 'invalid-digest') {
  const digest = requireString(value, code, { minimum: 64, maximum: 64 });
  if (!SHA_256_PATTERN.test(digest)) runtimeFail(code);
  return digest;
}

export function validateSourceSha(value, code = 'invalid-source-sha') {
  const sourceSha = requireString(value, code, { minimum: 40, maximum: 64 });
  if (!SOURCE_SHA_PATTERN.test(sourceSha)) runtimeFail(code);
  return sourceSha;
}

export function validateProcessStartToken(value, code = 'invalid-process-start-token') {
  const token = requireString(value, code, { minimum: 32, maximum: 32 });
  if (!PROCESS_START_TOKEN_PATTERN.test(token)) runtimeFail(code);
  return token;
}

export function validateReceiptId(value, code = 'invalid-receipt-id') {
  const receiptId = requireString(value, code, { minimum: 11, maximum: 71 });
  if (!RECEIPT_ID_PATTERN.test(receiptId)) runtimeFail(code);
  return receiptId;
}

/** Allows provider/local target IDs while rejecting filesystem paths and control text. */
export function validateTargetId(value, code = 'invalid-target-id') {
  const targetId = requireString(value, code, { minimum: 1, maximum: 512 });
  if (
    hasControlCharacter(targetId) ||
    !TARGET_ID_PATTERN.test(targetId) ||
    targetId.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    runtimeFail(code);
  }
  return targetId;
}

/** Validates a portable child path without accepting traversal, drive, or UNC syntax. */
export function validateRuntimeRelativePath(value, code = 'invalid-runtime-relative-path') {
  const relativePath = requireString(value, code, { minimum: 1, maximum: 512 });
  if (
    hasControlCharacter(relativePath) ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    runtimeFail(code);
  }
  const segments = relativePath.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..' || !RELATIVE_PATH_SEGMENT_PATTERN.test(segment))) {
    runtimeFail(code);
  }
  return segments.join('/');
}

export function validateRuntimeCode(value, code = 'invalid-runtime-code') {
  const runtimeCode = requireString(value, code, { minimum: 3, maximum: 64 });
  if (!RUNTIME_CODE_PATTERN.test(runtimeCode)) runtimeFail(code);
  return runtimeCode;
}

export function validatePhase(value, code = 'invalid-watch-phase') {
  if (typeof value !== 'string' || !WATCH_PHASES.includes(value)) runtimeFail(code);
  return value;
}

export function validateOutcome(value, code = 'invalid-watch-outcome') {
  if (typeof value !== 'string' || !WATCH_OUTCOMES.includes(value)) runtimeFail(code);
  return value;
}

export function validateOperationKind(value, code = 'invalid-operation-kind') {
  if (typeof value !== 'string' || !OPERATION_KINDS.includes(value)) runtimeFail(code);
  return value;
}

export function validateTerminalClassification(value, code = 'invalid-terminal-classification') {
  if (typeof value !== 'string' || !TERMINAL_CLASSIFICATIONS.includes(value)) runtimeFail(code);
  return value;
}

/** Normalizes the only data shape allowed in state.json. */
export function normalizeRuntimeState(value, { expectedWatchId } = {}) {
  const code = 'invalid-runtime-state';
  const state = assertClosedRecord(
    value,
    new Set([
      'blocker',
      'deadlineEpochMilliseconds',
      'failureFingerprints',
      'generation',
      'heartbeat',
      'libraryDigest',
      'outcome',
      'phase',
      'receiptIds',
      'scenarioDigest',
      'scenarioId',
      'schemaVersion',
      'scriptDigest',
      'sessionId',
      'target',
      'timeoutSeconds',
      'watchId',
      'workspaceId',
    ]),
    code,
  );
  assertRequiredFields(
    state,
    [
      'blocker',
      'deadlineEpochMilliseconds',
      'failureFingerprints',
      'generation',
      'heartbeat',
      'libraryDigest',
      'outcome',
      'phase',
      'receiptIds',
      'scenarioDigest',
      'scenarioId',
      'schemaVersion',
      'scriptDigest',
      'sessionId',
      'target',
      'timeoutSeconds',
      'watchId',
      'workspaceId',
    ],
    code,
  );
  if (state.schemaVersion !== RUNTIME_STATE_SCHEMA_VERSION) runtimeFail(code);
  const watchId = validateWatchId(state.watchId, code);
  if (expectedWatchId !== undefined && watchId !== validateWatchId(expectedWatchId, code)) runtimeFail(code);
  const phase = validatePhase(state.phase, code);
  const outcome = normalizeNullableEnum(state.outcome, WATCH_OUTCOMES, code);
  const blocker = normalizeNullableEnum(state.blocker, WATCH_BLOCKERS, code);
  if ((phase === 'Success') !== (outcome === 'succeeded')) runtimeFail(code);
  if (phase === 'Cancelled' && !['target_cancelled', 'user_cancelled'].includes(outcome)) runtimeFail(code);
  if (phase === 'Blocked' && (blocker === null || outcome === null)) runtimeFail(code);
  if (phase !== 'Blocked' && blocker !== null) runtimeFail(code);
  return freezeRecord({
    blocker,
    deadlineEpochMilliseconds: requireNonNegativeInteger(
      state.deadlineEpochMilliseconds,
      code,
      Number.MAX_SAFE_INTEGER,
    ),
    failureFingerprints: validateStringArray(state.failureFingerprints, code, validateDigest),
    generation: requireNonNegativeInteger(state.generation, code, 1_000_000_000),
    heartbeat: normalizeHeartbeat(state.heartbeat, code),
    libraryDigest: validateDigest(state.libraryDigest, code),
    outcome,
    phase,
    receiptIds: validateStringArray(state.receiptIds, code, validateReceiptId),
    scenarioDigest: validateDigest(state.scenarioDigest, code),
    scenarioId: validateWatchId(state.scenarioId, code),
    schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
    scriptDigest: validateDigest(state.scriptDigest, code),
    sessionId: validateSafeId(state.sessionId, code),
    target: normalizeStateTarget(state.target, code),
    timeoutSeconds: requirePositiveInteger(state.timeoutSeconds, code, 604_800),
    watchId,
    workspaceId: validateSafeId(state.workspaceId, code),
  });
}

export function isTerminalPhase(phase) {
  return phase === 'Success' || phase === 'Blocked' || phase === 'Cancelled';
}
