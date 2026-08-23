import {
  freezeArray,
  freezeRecord,
  isRecord,
  requirePositiveInteger,
  requireString,
  runtimeFail,
} from '../runtime-core-support.mjs';
import { validateDigest, validateSourceSha, validateTargetId } from '../runtime-state-contracts.mjs';

export const GENERIC_CI_RESULT_SCHEMA_ID = 'urn:gpt-voice:watch-process:generic-ci-result:1';
export const GENERIC_CI_RESULT_SCHEMA_VERSION = '1.0.0';
export const GENERIC_CI_RESULT_KINDS = freezeArray(['start', 'dispatch', 'observation', 'evidence']);

const MAX_ATTEMPT = 1_000_000;
const MAX_FAILURE_ENTRIES = 100;
const MAX_MEMBERS = 100;
const MAX_PROVIDER_STATUS_BYTES = 128;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/u;
const FAILURE_CLASSIFICATION_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;

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

function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function normalizeSafeText(value, code, maximum = MAX_PROVIDER_STATUS_BYTES) {
  const text = requireString(value, code, { minimum: 1, maximum });
  if (containsControlCharacter(text)) runtimeFail(code);
  return text;
}

function normalizeNullableSourceSha(value, code) {
  return value === null ? null : validateSourceSha(value, code);
}

function normalizeTarget(value, code) {
  const target = assertClosedRecord(value, new Set(['attempt', 'sourceSha', 'targetId']), code);
  assertRequiredFields(target, ['attempt', 'sourceSha', 'targetId'], code);
  return freezeRecord({
    attempt: requirePositiveInteger(target.attempt, code, MAX_ATTEMPT),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function normalizeMember(value, code) {
  const member = assertClosedRecord(value, new Set(['memberId', 'sourceSha', 'status']), code);
  assertRequiredFields(member, ['memberId', 'sourceSha', 'status'], code);
  return freezeRecord({
    memberId: validateTargetId(member.memberId, code),
    sourceSha: normalizeNullableSourceSha(member.sourceSha, code),
    status: normalizeSafeText(member.status, code),
  });
}

function normalizeFailureEntry(value, code) {
  const entry = assertClosedRecord(value, new Set(['classification', 'memberId']), code);
  assertRequiredFields(entry, ['classification', 'memberId'], code);
  const classification = requireString(entry.classification, code, { minimum: 3, maximum: 64 });
  if (!FAILURE_CLASSIFICATION_PATTERN.test(classification)) runtimeFail(code);
  return freezeRecord({ classification, memberId: validateTargetId(entry.memberId, code) });
}

function normalizeUnique(values, key, code) {
  if (new Set(values.map((value) => value[key])).size !== values.length) runtimeFail(code);
  return freezeArray(values);
}

/** Validates the tracked generic CI JSON protocol without a schema runtime dependency. */
export class GenericCiResultContract {
  validate(value) {
    const code = 'invalid-generic-ci-result';
    const result = assertClosedRecord(
      value,
      new Set([
        'authentication',
        'failureEntries',
        'kind',
        'members',
        'operationKey',
        'providerId',
        'providerStatus',
        'schemaVersion',
        'target',
      ]),
      code,
    );
    assertRequiredFields(
      result,
      ['authentication', 'kind', 'members', 'operationKey', 'providerId', 'providerStatus', 'schemaVersion', 'target'],
      code,
    );
    if (result.schemaVersion !== GENERIC_CI_RESULT_SCHEMA_VERSION) runtimeFail(code);
    if (!GENERIC_CI_RESULT_KINDS.includes(result.kind)) runtimeFail(code);
    const providerId = requireString(result.providerId, code, { minimum: 2, maximum: 32 });
    if (!PROVIDER_ID_PATTERN.test(providerId)) runtimeFail(code);
    if (!['authenticated', 'failed'].includes(result.authentication)) runtimeFail(code);
    const operationKey = result.operationKey === null ? null : validateDigest(result.operationKey, code);
    if (['start', 'dispatch'].includes(result.kind) && operationKey === null) runtimeFail(code);
    if (!Array.isArray(result.members) || result.members.length > MAX_MEMBERS) runtimeFail(code);
    const members = normalizeUnique(
      result.members.map((member) => normalizeMember(member, code)),
      'memberId',
      code,
    );
    const isEvidence = result.kind === 'evidence';
    if (isEvidence !== Object.hasOwn(result, 'failureEntries')) runtimeFail(code);
    let failureEntries = null;
    if (isEvidence) {
      if (!Array.isArray(result.failureEntries) || result.failureEntries.length > MAX_FAILURE_ENTRIES)
        runtimeFail(code);
      failureEntries = normalizeUnique(
        result.failureEntries.map((entry) => normalizeFailureEntry(entry, code)),
        'memberId',
        code,
      );
    }
    return freezeRecord({
      authentication: result.authentication,
      failureEntries,
      kind: result.kind,
      members,
      operationKey,
      providerId,
      providerStatus: normalizeSafeText(result.providerStatus, code),
      schemaVersion: GENERIC_CI_RESULT_SCHEMA_VERSION,
      target: normalizeTarget(result.target, code),
    });
  }
}
