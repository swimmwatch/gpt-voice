import { PROCESS_TERMINAL_CLASSIFICATIONS } from './runtime-contracts.mjs';
import {
  PROCESS_START_TOKEN_PATTERN,
  SHA_256_PATTERN,
  digestNormalizedValue,
  freezeArray,
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateRuntimeCode } from './runtime-preflight.mjs';

const WATCH_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/u;

function hasControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function assertSafeTargetId(value) {
  const targetId = requireString(value, 'invalid-attempt-identity', { minimum: 1, maximum: 512 });
  if (
    hasControlCharacter(targetId) ||
    targetId.startsWith('/') ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(targetId) ||
    targetId.startsWith('\\\\')
  ) {
    runtimeFail('invalid-attempt-identity');
  }
  return targetId;
}

function normalizeAttemptIdentity(value) {
  if (!isRecord(value)) runtimeFail('invalid-attempt-identity');
  const allowedFields = new Set(['attempt', 'sourceSha', 'startToken', 'targetId', 'watchId']);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) runtimeFail('invalid-attempt-identity');
  }
  const watchId = requireString(value.watchId, 'invalid-attempt-identity', { minimum: 3, maximum: 64 });
  if (!WATCH_ID_PATTERN.test(watchId)) runtimeFail('invalid-attempt-identity');
  const sourceSha = requireString(value.sourceSha, 'invalid-attempt-identity', { minimum: 64, maximum: 64 });
  if (!SHA_256_PATTERN.test(sourceSha)) runtimeFail('invalid-attempt-identity');
  const startToken = requireString(value.startToken, 'invalid-attempt-identity', { minimum: 32, maximum: 32 });
  if (!PROCESS_START_TOKEN_PATTERN.test(startToken)) runtimeFail('invalid-attempt-identity');
  return freezeRecord({
    attempt: requireNonNegativeInteger(value.attempt, 'invalid-attempt-identity', 1_000_000),
    sourceSha,
    startToken,
    targetId: assertSafeTargetId(value.targetId),
    watchId,
  });
}

function normalizeTerminal(value) {
  if (!isRecord(value) || typeof value.classification !== 'string') runtimeFail('invalid-failure-terminal');
  if (!PROCESS_TERMINAL_CLASSIFICATIONS.includes(value.classification) || value.classification === 'succeeded') {
    runtimeFail('invalid-failure-terminal');
  }
  const exitCode =
    value.exitCode === null ? null : requireNonNegativeInteger(value.exitCode, 'invalid-failure-terminal', 255);
  const signal =
    value.signal === null ? null : requireString(value.signal, 'invalid-failure-terminal', { minimum: 3, maximum: 32 });
  return freezeRecord({ classification: value.classification, exitCode, signal });
}

function normalizeEvidence(value) {
  if (!isRecord(value)) runtimeFail('invalid-failure-evidence');
  if (
    typeof value.truncated !== 'boolean' ||
    typeof value.timeLimitReached !== 'boolean' ||
    !Array.isArray(value.failureCodes)
  ) {
    runtimeFail('invalid-failure-evidence');
  }
  if (value.failureCodes.length > 100) runtimeFail('invalid-failure-evidence');
  return freezeRecord({
    failureCodes: freezeArray(value.failureCodes.map((code) => validateRuntimeCode(code))),
    timeLimitReached: value.timeLimitReached,
    truncated: value.truncated,
  });
}

/**
 * Creates a stable SHA-256 fingerprint from immutable identity and sanitized
 * classifications only. Raw evidence, command text, and filesystem paths are
 * deliberately absent from the preimage.
 */
export function createFailureFingerprint({ attemptIdentity, evidence, terminal } = {}) {
  const normalized = freezeRecord({
    attemptIdentity: normalizeAttemptIdentity(attemptIdentity),
    evidence: normalizeEvidence(evidence),
    terminal: normalizeTerminal(terminal),
    version: 1,
  });
  return digestNormalizedValue('gpt-voice/watch-process/failure-fingerprint/v1', normalized);
}
