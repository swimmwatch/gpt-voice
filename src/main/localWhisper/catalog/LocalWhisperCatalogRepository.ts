import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  getLocalWhisperMemoryConfigurationKey,
  hasLocalWhisperControlCharacter,
  isLocalWhisperMemoryConfigurationIdentity,
  isLocalWhisperModelIdentity,
  isLocalWhisperRendererSafeLabel,
  isLocalWhisperRuntimeIdentity,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  validateLocalWhisperMemoryEstimateMatrix,
  type LocalWhisperArtifactId,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperQualifiedMemoryPeak,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';

import { LocalWhisperCatalogVerifier } from './LocalWhisperCatalogVerifier';
import {
  LOCAL_WHISPER_CATALOG_SCHEMA_VERSION,
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogAllowlistedOrigin,
  type LocalWhisperCatalogDenylist,
  type LocalWhisperCatalogLoadResult,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogModelFileIdentity,
  type LocalWhisperCatalogOrigin,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogRuntimeEntry,
  type LocalWhisperCatalogTrustPolicy,
} from './LocalWhisperCatalogTypes';

const PAYLOAD_KEYS = [
  'schemaVersion',
  'catalogRevision',
  'compatibleAppRevisions',
  'workerProtocolVersion',
  'languageCatalogRevision',
  'languages',
  'modelFamilies',
  'origins',
  'runtimes',
  'models',
  'memoryEstimates',
  'qualifiedMemoryPeaks',
  'denylist',
] as const;
const ORIGIN_KEYS = ['id', 'origin'] as const;
const RUNTIME_ENTRY_KEYS = ['identity', 'recommended', 'qualificationStatus', 'licenseIds'] as const;
const MODEL_ENTRY_KEYS = [
  'identity',
  'originId',
  'expectedFiles',
  'transferSizeBytes',
  'transferSha256',
  'installedSizeBytes',
  'compatibleRuntimePackRevisions',
  'recommended',
  'qualificationStatus',
  'provenanceId',
  'licenseIds',
  'noticeIds',
] as const;
const MODEL_FILE_KEYS = ['fileId', 'kind', 'mode', 'sizeBytes', 'sha256'] as const;
const DENYLIST_KEYS = ['runtimes', 'models'] as const;
const QUALIFIED_PEAK_KEYS = [
  'target',
  'backend',
  'runtimePackRevision',
  'model',
  'measuredPeakRamBytes',
  'measuredPeakVramBytes',
  'qualificationProfileId',
  'capabilityFingerprint',
] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const QUALIFICATION_STATUSES = ['qualified', 'estimateOnly', 'planned'] as const;

export interface LocalWhisperCatalogRepositoryDependencies {
  readonly readDocument: () => Uint8Array;
  readonly trustPolicy: LocalWhisperCatalogTrustPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isLogicalIdentifier(value: unknown, maximumLength = 256): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const alphanumeric =
      (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
    if (!alphanumeric && code !== 0x2d && code !== 0x2e && code !== 0x5f) return false;
    if (index === 0 && !alphanumeric) return false;
  }
  return true;
}

function isCanonicalBase64(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  return Buffer.from(value, 'base64').toString('base64') === value;
}

function isArtifactIdList(value: unknown, allowEmpty = false): value is readonly LocalWhisperArtifactId[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) return false;
  const ids = value.map(toLocalWhisperArtifactId);
  return ids.every((id) => id !== null && isLogicalIdentifier(id)) && new Set(ids).size === ids.length;
}

function isRevisionIdList(value: unknown, allowEmpty = false): value is readonly LocalWhisperRevisionId[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) return false;
  const revisions = value.map(toLocalWhisperRevisionId);
  return (
    revisions.every((revision) => revision !== null && isLogicalIdentifier(revision)) &&
    new Set(revisions).size === revisions.length
  );
}

function isQualificationStatus(value: unknown): value is (typeof QUALIFICATION_STATUSES)[number] {
  return isMember(QUALIFICATION_STATUSES, value);
}

function isStrictHttpsOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function isCatalogOrigin(value: unknown): value is LocalWhisperCatalogOrigin {
  return (
    isRecord(value) &&
    hasExactKeys(value, ORIGIN_KEYS) &&
    toLocalWhisperArtifactId(value.id) !== null &&
    isLogicalIdentifier(value.id) &&
    isStrictHttpsOrigin(value.origin)
  );
}

function isModelFile(value: unknown): value is LocalWhisperCatalogModelFileIdentity {
  return (
    isRecord(value) &&
    hasExactKeys(value, MODEL_FILE_KEYS) &&
    toLocalWhisperArtifactId(value.fileId) !== null &&
    isLogicalIdentifier(value.fileId) &&
    isMember(['data', 'config', 'tokenizer', 'notice'] as const, value.kind) &&
    isNonNegativeSafeInteger(value.mode) &&
    value.mode <= 0o777 &&
    isNonNegativeSafeInteger(value.sizeBytes) &&
    typeof value.sha256 === 'string' &&
    SHA256_PATTERN.test(value.sha256)
  );
}

function isRuntimeEntry(value: unknown): value is LocalWhisperCatalogRuntimeEntry {
  if (!(
    isRecord(value) &&
    hasExactKeys(value, RUNTIME_ENTRY_KEYS) &&
    isLocalWhisperRuntimeIdentity(value.identity) &&
    typeof value.recommended === 'boolean' &&
    isQualificationStatus(value.qualificationStatus) &&
    isArtifactIdList(value.licenseIds)
  )) {
    return false;
  }
  const identity = value.identity;
  return (
    isLogicalIdentifier(identity.dependencyFamily) &&
    isLogicalIdentifier(identity.upstreamRevision) &&
    isLogicalIdentifier(identity.buildRevision) &&
    identity.computeTargets.every((target) => isLogicalIdentifier(target)) &&
    isLogicalIdentifier(identity.packRevision) &&
    isLogicalIdentifier(identity.catalogRevision) &&
    isLogicalIdentifier(identity.appRevision) &&
    isLogicalIdentifier(identity.signingKeyId) &&
    isLogicalIdentifier(identity.originId) &&
    identity.expectedFiles.every((file) => isLogicalIdentifier(file.fileId)) &&
    identity.prerequisites.every((prerequisite) => isLogicalIdentifier(prerequisite)) &&
    isLogicalIdentifier(identity.provenanceId) &&
    isLogicalIdentifier(identity.sbomRevision) &&
    identity.noticeIds.every((noticeId) => isLogicalIdentifier(noticeId))
  );
}

function isModelEntry(value: unknown): value is LocalWhisperCatalogModelEntry {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, MODEL_ENTRY_KEYS) ||
    !isLocalWhisperModelIdentity(value.identity) ||
    toLocalWhisperArtifactId(value.originId) === null ||
    !isLogicalIdentifier(value.originId) ||
    !Array.isArray(value.expectedFiles) ||
    value.expectedFiles.length === 0 ||
    !value.expectedFiles.every(isModelFile) ||
    !isPositiveSafeInteger(value.transferSizeBytes) ||
    typeof value.transferSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.transferSha256) ||
    !isPositiveSafeInteger(value.installedSizeBytes) ||
    !isRevisionIdList(value.compatibleRuntimePackRevisions) ||
    typeof value.recommended !== 'boolean' ||
    !isQualificationStatus(value.qualificationStatus) ||
    toLocalWhisperArtifactId(value.provenanceId) === null ||
    !isLogicalIdentifier(value.provenanceId) ||
    !isArtifactIdList(value.licenseIds) ||
    !isArtifactIdList(value.noticeIds, true)
  ) {
    return false;
  }
  const fileIds = value.expectedFiles.map((file) => file.fileId);
  const totalBytes = value.expectedFiles.reduce((total, file) => total + file.sizeBytes, 0);
  return (
    isLogicalIdentifier(value.identity.sourceCheckpointRevision) &&
    isLogicalIdentifier(value.identity.artifactRevision) &&
    new Set(fileIds).size === fileIds.length &&
    Number.isSafeInteger(totalBytes) &&
    totalBytes === value.installedSizeBytes
  );
}

function isQualifiedMemoryPeak(value: unknown): value is LocalWhisperQualifiedMemoryPeak {
  if (!isRecord(value) || !hasExactKeys(value, QUALIFIED_PEAK_KEYS)) return false;
  const identity = Object.fromEntries(
    ['target', 'backend', 'runtimePackRevision', 'model'].map((key) => [key, value[key]]),
  );
  if (!isLocalWhisperMemoryConfigurationIdentity(identity)) return false;
  const vramValid =
    value.target === 'cpu'
      ? value.measuredPeakVramBytes === 'notApplicable'
      : isNonNegativeSafeInteger(value.measuredPeakVramBytes);
  return (
    isNonNegativeSafeInteger(value.measuredPeakRamBytes) &&
    vramValid &&
    toLocalWhisperArtifactId(value.qualificationProfileId) !== null &&
    isLogicalIdentifier(value.qualificationProfileId) &&
    typeof value.capabilityFingerprint === 'string' &&
    value.capabilityFingerprint.length > 0 &&
    value.capabilityFingerprint.length <= 512 &&
    !hasLocalWhisperControlCharacter(value.capabilityFingerprint)
  );
}

function hasExactLanguages(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== LOCAL_WHISPER_LANGUAGE_CATALOG.length) return false;
  return value.every((candidate, index) => {
    const expected = LOCAL_WHISPER_LANGUAGE_CATALOG[index];
    return (
      isRecord(candidate) &&
      hasExactKeys(candidate, ['id', 'fallbackLabel', 'labelKey', 'whisperCpp']) &&
      candidate.id === expected.id &&
      candidate.fallbackLabel === expected.fallbackLabel &&
      candidate.labelKey === expected.labelKey &&
      candidate.whisperCpp === expected.whisperCpp
    );
  });
}

function hasExactModelFamilies(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === LOCAL_WHISPER_MODEL_FAMILIES.length &&
    value.every((family, index) => family === LOCAL_WHISPER_MODEL_FAMILIES[index])
  );
}

function isDenylist(value: unknown): value is LocalWhisperCatalogDenylist {
  return (
    isRecord(value) &&
    hasExactKeys(value, DENYLIST_KEYS) &&
    Array.isArray(value.runtimes) &&
    value.runtimes.every(isLocalWhisperRuntimeIdentity) &&
    Array.isArray(value.models) &&
    value.models.every(isLocalWhisperModelIdentity)
  );
}

function isPayloadShape(value: unknown): value is LocalWhisperCatalogPayload {
  return (
    isRecord(value) &&
    hasExactKeys(value, PAYLOAD_KEYS) &&
    value.schemaVersion === LOCAL_WHISPER_CATALOG_SCHEMA_VERSION &&
    toLocalWhisperRevisionId(value.catalogRevision) !== null &&
    isLogicalIdentifier(value.catalogRevision) &&
    isRevisionIdList(value.compatibleAppRevisions) &&
    isPositiveSafeInteger(value.workerProtocolVersion) &&
    value.languageCatalogRevision === LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION &&
    hasExactLanguages(value.languages) &&
    hasExactModelFamilies(value.modelFamilies) &&
    Array.isArray(value.origins) &&
    value.origins.every(isCatalogOrigin) &&
    Array.isArray(value.runtimes) &&
    value.runtimes.every(isRuntimeEntry) &&
    Array.isArray(value.models) &&
    value.models.every(isModelEntry) &&
    Array.isArray(value.memoryEstimates) &&
    Array.isArray(value.qualifiedMemoryPeaks) &&
    value.qualifiedMemoryPeaks.every(isQualifiedMemoryPeak) &&
    isDenylist(value.denylist)
  );
}

function validateOriginAllowlist(
  payloadOrigins: readonly LocalWhisperCatalogOrigin[],
  allowedOrigins: readonly LocalWhisperCatalogAllowlistedOrigin[],
): boolean {
  if (
    allowedOrigins.some(
      (entry) =>
        !toLocalWhisperArtifactId(entry.id) || !isLogicalIdentifier(entry.id) || !isStrictHttpsOrigin(entry.origin),
    )
  ) {
    return false;
  }
  const allowlist = new Map(allowedOrigins.map((entry) => [entry.id, entry.origin]));
  if (allowlist.size !== allowedOrigins.length) return false;
  const payloadIds = payloadOrigins.map((entry) => entry.id);
  return (
    new Set(payloadIds).size === payloadIds.length &&
    payloadOrigins.every((entry) => allowlist.get(entry.id) === entry.origin)
  );
}

function buildExpectedMemoryConfigurations(
  runtimes: readonly LocalWhisperCatalogRuntimeEntry[],
  models: readonly LocalWhisperCatalogModelEntry[],
): readonly LocalWhisperMemoryConfigurationIdentity[] | null {
  const configurations: LocalWhisperMemoryConfigurationIdentity[] = [];
  for (const model of models) {
    for (const runtimeRevision of model.compatibleRuntimePackRevisions) {
      const compatibleRuntimes = runtimes.filter(
        ({ identity }) => identity.engine === model.identity.engine && identity.packRevision === runtimeRevision,
      );
      if (compatibleRuntimes.length === 0) return null;
      for (const { identity: runtime } of compatibleRuntimes) {
        const configuration = {
          target: runtime.target,
          backend: runtime.backend,
          runtimePackRevision: runtime.packRevision,
          model: model.identity,
        } satisfies LocalWhisperMemoryConfigurationIdentity;
        if (!isLocalWhisperMemoryConfigurationIdentity(configuration)) return null;
        configurations.push(configuration);
      }
    }
  }
  return configurations;
}

function hasDuplicateRecommendation(
  entries: readonly (LocalWhisperCatalogRuntimeEntry | LocalWhisperCatalogModelEntry)[],
): boolean {
  const recommendedGroups = new Set<string>();
  for (const entry of entries) {
    if (!entry.recommended) continue;
    const identity = entry.identity;
    const group =
      'packRevision' in identity
        ? [identity.engine, identity.platform, identity.architecture, identity.target, identity.backend].join('|')
        : [identity.engine, identity.logicalModel, identity.variant].join('|');
    if (recommendedGroups.has(group)) return true;
    recommendedGroups.add(group);
  }
  return false;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

/** Builds immutable indexes only after every cross-document catalog invariant passes. */
function materializeCatalog(
  payload: LocalWhisperCatalogPayload,
  signingKeyId: LocalWhisperArtifactId,
  trustPolicy: LocalWhisperCatalogTrustPolicy,
): LocalWhisperAuthenticatedCatalog | null {
  if (
    !isLogicalIdentifier(signingKeyId) ||
    !payload.compatibleAppRevisions.includes(trustPolicy.appRevision) ||
    payload.workerProtocolVersion !== trustPolicy.workerProtocolVersion ||
    !validateOriginAllowlist(payload.origins, trustPolicy.origins)
  ) {
    return null;
  }
  const originIds = new Set(payload.origins.map((origin) => origin.id));
  const runtimeKeys = payload.runtimes.map(({ identity }) => getLocalWhisperRuntimeIdentityKey(identity));
  const modelKeys = payload.models.map(({ identity }) => getLocalWhisperModelIdentityKey(identity));
  const runtimeSelectionKeys = payload.runtimes.map(({ identity }) =>
    [
      identity.engine,
      identity.platform,
      identity.architecture,
      identity.target,
      identity.backend,
      identity.packRevision,
    ].join('|'),
  );
  const modelSelectionKeys = payload.models.map(({ identity }) =>
    [identity.engine, identity.logicalModel, identity.artifactRevision, identity.variant].join('|'),
  );
  if (
    new Set(runtimeKeys).size !== runtimeKeys.length ||
    new Set(modelKeys).size !== modelKeys.length ||
    new Set(runtimeSelectionKeys).size !== runtimeSelectionKeys.length ||
    new Set(modelSelectionKeys).size !== modelSelectionKeys.length ||
    hasDuplicateRecommendation(payload.runtimes) ||
    hasDuplicateRecommendation(payload.models)
  ) {
    return null;
  }
  if (
    payload.runtimes.some(({ identity }) => {
      const installedSize = identity.expectedFiles.reduce((total, file) => total + file.sizeBytes, 0);
      return (
        identity.catalogRevision !== payload.catalogRevision ||
        identity.appRevision !== trustPolicy.appRevision ||
        identity.protocolVersion !== payload.workerProtocolVersion ||
        !originIds.has(identity.originId) ||
        !isCanonicalBase64(identity.archiveSignature) ||
        identity.archiveSizeBytes <= 0 ||
        !Number.isSafeInteger(installedSize) ||
        identity.expectedFiles.some((file) => file.mode > 0o777) ||
        new Set(identity.expectedFiles.map((file) => file.fileId)).size !== identity.expectedFiles.length
      );
    }) ||
    payload.models.some(({ identity, originId, compatibleRuntimePackRevisions }) => {
      if (!originIds.has(originId)) return true;
      return compatibleRuntimePackRevisions.some(
        (revision) =>
          !payload.runtimes.some(
            ({ identity: runtime }) => runtime.engine === identity.engine && runtime.packRevision === revision,
          ),
      );
    })
  ) {
    return null;
  }

  const expectedConfigurations = buildExpectedMemoryConfigurations(payload.runtimes, payload.models);
  if (
    !expectedConfigurations ||
    payload.memoryEstimates.some(({ sourceBuildRevision }) => !isLogicalIdentifier(sourceBuildRevision))
  ) {
    return null;
  }
  const matrix = validateLocalWhisperMemoryEstimateMatrix(payload.memoryEstimates, expectedConfigurations);
  if (!matrix.valid) return null;
  const expectedMemoryKeys = new Set(expectedConfigurations.map(getLocalWhisperMemoryConfigurationKey));
  const qualifiedKeys = payload.qualifiedMemoryPeaks.map(getLocalWhisperMemoryConfigurationKey);
  if (
    new Set(qualifiedKeys).size !== qualifiedKeys.length ||
    qualifiedKeys.some((key) => !expectedMemoryKeys.has(key)) ||
    payload.qualifiedMemoryPeaks.some(
      (peak) =>
        !isLocalWhisperRendererSafeLabel(peak.qualificationProfileId) || peak.capabilityFingerprint.length > 512,
    )
  ) {
    return null;
  }

  const runtimeKeySet = new Set(runtimeKeys);
  const modelKeySet = new Set(modelKeys);
  const denylistedRuntimeKeys = payload.denylist.runtimes.map(getLocalWhisperRuntimeIdentityKey);
  const denylistedModelKeys = payload.denylist.models.map(getLocalWhisperModelIdentityKey);
  if (
    new Set(denylistedRuntimeKeys).size !== denylistedRuntimeKeys.length ||
    new Set(denylistedModelKeys).size !== denylistedModelKeys.length ||
    denylistedRuntimeKeys.some((key) => !runtimeKeySet.has(key)) ||
    denylistedModelKeys.some((key) => !modelKeySet.has(key))
  ) {
    return null;
  }
  const deniedRuntimes = new Set(denylistedRuntimeKeys);
  const deniedModels = new Set(denylistedModelKeys);
  if (
    payload.runtimes.some(
      (entry) => entry.recommended && deniedRuntimes.has(getLocalWhisperRuntimeIdentityKey(entry.identity)),
    ) ||
    payload.models.some(
      (entry) => entry.recommended && deniedModels.has(getLocalWhisperModelIdentityKey(entry.identity)),
    )
  ) {
    return null;
  }

  const immutablePayload = deepFreeze(structuredClone(payload));
  return Object.freeze({
    signingKeyId,
    payload: immutablePayload,
    isRuntimeDenylisted: (identityKey: string) => deniedRuntimes.has(identityKey),
    isModelDenylisted: (identityKey: string) => deniedModels.has(identityKey),
  });
}

/** Loads one immutable app-shipped document and exposes authority only after authentication and strict validation. */
export class LocalWhisperCatalogRepository {
  private readonly verifier: LocalWhisperCatalogVerifier;

  public constructor(private readonly dependencies: LocalWhisperCatalogRepositoryDependencies) {
    this.verifier = new LocalWhisperCatalogVerifier(dependencies.trustPolicy.publicKeys);
  }

  public load(): LocalWhisperCatalogLoadResult {
    let documentBytes: Uint8Array;
    try {
      documentBytes = this.dependencies.readDocument();
    } catch {
      return { success: false, code: 'CATALOG_UNAVAILABLE' };
    }
    const verified = this.verifier.verify(documentBytes);
    if (!verified.success) return verified;
    if (!isPayloadShape(verified.payload)) return { success: false, code: 'CATALOG_INVALID' };
    const catalog = materializeCatalog(verified.payload, verified.keyId, this.dependencies.trustPolicy);
    return catalog ? { success: true, catalog } : { success: false, code: 'CATALOG_INVALID' };
  }
}
