import { digestNormalizedValue, freezeArray, freezeRecord, isRecord, requireNonNegativeInteger, requirePositiveInteger, runtimeFail } from './runtime-core-support.mjs';
import {
  SUCCESS_ATTESTATION_SCHEMA_VERSION,
  validateDigest,
  validateReceiptId,
  validateRuntimeCode,
  validateSafeId,
  validateSourceSha,
  validateTargetId,
  validateTerminalClassification,
  validateWatchId,
} from './runtime-state-contracts.mjs';

const REQUIRED_CONCLUSIONS = new Set(['success', 'skipped', 'neutral', 'failure', 'cancelled', 'pending']);
const FRESH_PROOF_KINDS = new Set(['external', 'local', 'composite']);

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

function normalizeNullableSourceSha(value, code) {
  if (value === null) return null;
  return validateSourceSha(value, code);
}

function normalizeMember(value, code) {
  const member = assertClosedRecord(value, new Set(['attempt', 'identityDigest', 'memberId']), code);
  assertRequiredFields(member, ['attempt', 'identityDigest', 'memberId'], code);
  return freezeRecord({
    attempt: requireNonNegativeInteger(member.attempt, code, 1_000_000),
    identityDigest: validateDigest(member.identityDigest, code),
    memberId: validateTargetId(member.memberId, code),
  });
}

function normalizeTarget(value, code) {
  const target = assertClosedRecord(value, new Set(['identityDigest', 'members', 'sourceSha', 'targetId']), code);
  assertRequiredFields(target, ['identityDigest', 'members', 'sourceSha', 'targetId'], code);
  if (!Array.isArray(target.members) || target.members.length === 0 || target.members.length > 100) runtimeFail(code);
  const members = target.members.map((member) => normalizeMember(member, code));
  if (new Set(members.map((member) => `${member.memberId}:${member.attempt}:${member.identityDigest}`)).size !== members.length) {
    runtimeFail(code);
  }
  return freezeRecord({
    identityDigest: validateDigest(target.identityDigest, code),
    members: freezeArray(members),
    sourceSha: normalizeNullableSourceSha(target.sourceSha, code),
    targetId: validateTargetId(target.targetId, code),
  });
}

function normalizeRequiredResult(value, code) {
  const result = assertClosedRecord(value, new Set(['allowedSkipped', 'conclusion', 'resultId']), code);
  assertRequiredFields(result, ['allowedSkipped', 'conclusion', 'resultId'], code);
  if (typeof result.allowedSkipped !== 'boolean' || typeof result.conclusion !== 'string' || !REQUIRED_CONCLUSIONS.has(result.conclusion)) {
    runtimeFail(code);
  }
  return freezeRecord({
    allowedSkipped: result.allowedSkipped,
    conclusion: result.conclusion,
    resultId: validateSafeId(result.resultId, code),
  });
}

function normalizeRequiredContract(value, code) {
  const contract = assertClosedRecord(value, new Set(['digest', 'results']), code);
  assertRequiredFields(contract, ['digest', 'results'], code);
  if (!Array.isArray(contract.results) || contract.results.length === 0 || contract.results.length > 100) runtimeFail(code);
  const results = contract.results.map((result) => normalizeRequiredResult(result, code));
  if (new Set(results.map((result) => result.resultId)).size !== results.length) runtimeFail(code);
  return freezeRecord({ digest: validateDigest(contract.digest, code), results: freezeArray(results) });
}

function normalizeVerification(value, code) {
  const verification = assertClosedRecord(value, new Set(['classification', 'commandDigest', 'headIdentityDigest', 'inputIdentityDigest']), code);
  assertRequiredFields(verification, ['classification', 'commandDigest', 'headIdentityDigest', 'inputIdentityDigest'], code);
  return freezeRecord({
    classification: validateTerminalClassification(verification.classification, code),
    commandDigest: validateDigest(verification.commandDigest, code),
    headIdentityDigest: validateDigest(verification.headIdentityDigest, code),
    inputIdentityDigest: validateDigest(verification.inputIdentityDigest, code),
  });
}

function normalizeVerificationList(value, code) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) runtimeFail(code);
  const verifications = value.map((verification) => normalizeVerification(verification, code));
  if (new Set(verifications.map((verification) => verification.commandDigest)).size !== verifications.length) runtimeFail(code);
  return freezeArray(verifications);
}

function normalizeCleanup(value, code) {
  const cleanup = assertClosedRecord(value, new Set(['directChildExited', 'resultCode', 'treeVerified']), code);
  assertRequiredFields(cleanup, ['directChildExited', 'resultCode', 'treeVerified'], code);
  if (typeof cleanup.directChildExited !== 'boolean' || typeof cleanup.treeVerified !== 'boolean') runtimeFail(code);
  return freezeRecord({
    directChildExited: cleanup.directChildExited,
    resultCode: validateRuntimeCode(cleanup.resultCode, code),
    treeVerified: cleanup.treeVerified,
  });
}

function normalizeDigestArray(value, code) {
  if (!Array.isArray(value) || value.length > 100) runtimeFail(code);
  const digests = value.map((digest) => validateDigest(digest, code));
  if (new Set(digests).size !== digests.length) runtimeFail(code);
  return freezeArray(digests);
}

function normalizeReceiptIdArray(value, code) {
  if (!Array.isArray(value) || value.length > 100) runtimeFail(code);
  const receiptIds = value.map((receiptId) => validateReceiptId(receiptId, code));
  if (new Set(receiptIds).size !== receiptIds.length) runtimeFail(code);
  return freezeArray(receiptIds);
}

function normalizeScenario(value, code) {
  const scenario = assertClosedRecord(value, new Set(['digest', 'id', 'version']), code);
  assertRequiredFields(scenario, ['digest', 'id', 'version'], code);
  return freezeRecord({
    digest: validateDigest(scenario.digest, code),
    id: validateWatchId(scenario.id, code),
    version: validateSafeId(scenario.version, code),
  });
}

function normalizeAttestation(value) {
  const code = 'invalid-success-attestation';
  const attestation = assertClosedRecord(
    value,
    new Set([
      'cleanup',
      'finalObservationEpochMilliseconds',
      'generation',
      'libraryDigest',
      'operationKeys',
      'receiptIds',
      'requiredContract',
      'scenario',
      'schemaVersion',
      'scriptDigest',
      'target',
      'timeoutSeconds',
      'verification',
      'watchId',
    ]),
    code,
  );
  assertRequiredFields(
    attestation,
    [
      'cleanup',
      'finalObservationEpochMilliseconds',
      'generation',
      'libraryDigest',
      'operationKeys',
      'receiptIds',
      'requiredContract',
      'scenario',
      'schemaVersion',
      'scriptDigest',
      'target',
      'timeoutSeconds',
      'verification',
      'watchId',
    ],
    code,
  );
  if (attestation.schemaVersion !== SUCCESS_ATTESTATION_SCHEMA_VERSION) runtimeFail(code);
  return freezeRecord({
    cleanup: normalizeCleanup(attestation.cleanup, code),
    finalObservationEpochMilliseconds: requireNonNegativeInteger(
      attestation.finalObservationEpochMilliseconds,
      code,
      Number.MAX_SAFE_INTEGER,
    ),
    generation: requireNonNegativeInteger(attestation.generation, code, 1_000_000_000),
    libraryDigest: validateDigest(attestation.libraryDigest, code),
    operationKeys: normalizeDigestArray(attestation.operationKeys, code),
    receiptIds: normalizeReceiptIdArray(attestation.receiptIds, code),
    requiredContract: normalizeRequiredContract(attestation.requiredContract, code),
    scenario: normalizeScenario(attestation.scenario, code),
    schemaVersion: SUCCESS_ATTESTATION_SCHEMA_VERSION,
    scriptDigest: validateDigest(attestation.scriptDigest, code),
    target: normalizeTarget(attestation.target, code),
    timeoutSeconds: requirePositiveInteger(attestation.timeoutSeconds, code, 604_800),
    verification: normalizeVerificationList(attestation.verification, code),
    watchId: validateWatchId(attestation.watchId, code),
  });
}

function normalizeFreshProof(value, expectedWatchId) {
  const code = 'invalid-fresh-success-proof';
  const proof = assertClosedRecord(
    value,
    new Set([
      'observedAtEpochMilliseconds',
      'proofKind',
      'receiptIds',
      'requiredContract',
      'target',
      'verification',
      'watchId',
    ]),
    code,
  );
  assertRequiredFields(
    proof,
    ['observedAtEpochMilliseconds', 'proofKind', 'receiptIds', 'requiredContract', 'target', 'verification', 'watchId'],
    code,
  );
  if (typeof proof.proofKind !== 'string' || !FRESH_PROOF_KINDS.has(proof.proofKind)) runtimeFail(code);
  if (validateWatchId(proof.watchId, code) !== expectedWatchId) runtimeFail(code);
  return freezeRecord({
    observedAtEpochMilliseconds: requireNonNegativeInteger(proof.observedAtEpochMilliseconds, code, Number.MAX_SAFE_INTEGER),
    proofKind: proof.proofKind,
    receiptIds: normalizeReceiptIdArray(proof.receiptIds, code),
    requiredContract: normalizeRequiredContract(proof.requiredContract, code),
    target: normalizeTarget(proof.target, code),
    verification: normalizeVerificationList(proof.verification, code),
    watchId: expectedWatchId,
  });
}

function sameCanonicalValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function provesSuccessfulResult(result) {
  return result.conclusion === 'success' || (result.conclusion === 'skipped' && result.allowedSkipped);
}

/** Builds and validates immutable success evidence without consulting state or the journal. */
export class SuccessAttestation {
  build(value) {
    return normalizeAttestation(value);
  }

  digest(value) {
    return digestNormalizedValue('gpt-voice/watch-process/success-attestation/v1', normalizeAttestation(value));
  }

  /** Requires a fresh provider/local proof explicitly supplied by a later adapter. */
  validate({ attestation, freshProof } = {}) {
    const normalizedAttestation = normalizeAttestation(attestation);
    if (freshProof === undefined || freshProof === null) runtimeFail('fresh-success-proof-required');
    const normalizedProof = normalizeFreshProof(freshProof, normalizedAttestation.watchId);
    if (normalizedProof.observedAtEpochMilliseconds < normalizedAttestation.finalObservationEpochMilliseconds) {
      runtimeFail('stale-success-proof');
    }
    if (
      !sameCanonicalValue(normalizedProof.target, normalizedAttestation.target) ||
      !sameCanonicalValue(normalizedProof.requiredContract, normalizedAttestation.requiredContract) ||
      !sameCanonicalValue(normalizedProof.receiptIds, normalizedAttestation.receiptIds) ||
      !sameCanonicalValue(normalizedProof.verification, normalizedAttestation.verification)
    ) {
      runtimeFail('success-proof-mismatch');
    }
    if (
      normalizedAttestation.requiredContract.results.some((result) => !provesSuccessfulResult(result)) ||
      normalizedAttestation.verification.some((verification) => verification.classification !== 'succeeded')
    ) {
      runtimeFail('success-proof-not-green');
    }
    return freezeRecord({
      attestationDigest: this.digest(normalizedAttestation),
      observedAtEpochMilliseconds: normalizedProof.observedAtEpochMilliseconds,
      success: true,
    });
  }
}
