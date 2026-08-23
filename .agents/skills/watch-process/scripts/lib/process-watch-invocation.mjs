import {
  freezeRecord,
  isRecord,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from './runtime-core-support.mjs';
import { validateDigest, validateSourceSha, validateTargetId } from './runtime-state-contracts.mjs';

export const MAX_TARGET_SELECTOR_LENGTH = 512;

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function hasControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function normalizeNullableSourceSha(value, code) {
  return value === null ? null : validateSourceSha(value, code);
}

export function normalizeProcessWatchTarget(value, code = 'invalid-watch-target') {
  const target = assertClosedRecord(value, new Set(['attempt', 'identityDigest', 'sourceSha', 'targetId']), code);
  for (const field of ['attempt', 'identityDigest', 'sourceSha', 'targetId']) {
    if (!Object.hasOwn(target, field)) runtimeFail(code);
  }
  return freezeRecord({
    attempt: requirePositiveInteger(target.attempt, code, 1_000_000),
    identityDigest: validateDigest(target.identityDigest, code),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function normalizeNullableTarget(value, code) {
  return value === null ? null : normalizeProcessWatchTarget(value, code);
}

function normalizeTargetSelector(value) {
  const selector = requireString(value, 'invalid-watch-invocation', {
    maximum: MAX_TARGET_SELECTOR_LENGTH,
    minimum: 1,
  });
  if (hasControlCharacter(selector)) runtimeFail('invalid-watch-invocation');
  return selector;
}

/** Normalizes only the bounded, non-secret invocation data a watcher needs. */
export function normalizeProcessWatchInvocation(value, scenario) {
  const invocation = assertClosedRecord(
    value,
    new Set(['deadlineEpochMilliseconds', 'inputDigest', 'sourceSha', 'target', 'targetSelector', 'timeoutSeconds']),
    'invalid-watch-invocation',
  );
  for (const field of [
    'deadlineEpochMilliseconds',
    'inputDigest',
    'sourceSha',
    'target',
    'targetSelector',
    'timeoutSeconds',
  ]) {
    if (!Object.hasOwn(invocation, field)) runtimeFail('invalid-watch-invocation');
  }
  const timeoutSeconds = requirePositiveInteger(invocation.timeoutSeconds, 'invalid-watch-invocation', 604_800);
  if (
    !isRecord(scenario) ||
    !isRecord(scenario.timing) ||
    timeoutSeconds < scenario.timing.minTimeoutSeconds ||
    timeoutSeconds > scenario.timing.maxTimeoutSeconds
  ) {
    runtimeFail('watch-timeout-outside-scenario');
  }
  const sourceSha = normalizeNullableSourceSha(invocation.sourceSha, 'invalid-watch-invocation');
  if (!isRecord(scenario.target) || (scenario.target.requireExactSourceRevision && sourceSha === null)) {
    runtimeFail('source-sha-required');
  }
  return freezeRecord({
    deadlineEpochMilliseconds: requireNonNegativeInteger(
      invocation.deadlineEpochMilliseconds,
      'invalid-watch-invocation',
      Number.MAX_SAFE_INTEGER,
    ),
    inputDigest: validateDigest(invocation.inputDigest, 'invalid-watch-invocation'),
    sourceSha,
    target: normalizeNullableTarget(invocation.target, 'invalid-watch-invocation'),
    targetSelector: normalizeTargetSelector(invocation.targetSelector),
    timeoutSeconds,
  });
}
