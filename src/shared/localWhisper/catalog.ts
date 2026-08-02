import {
  hasLocalWhisperControlCharacter,
  isLocalWhisperBackend,
  isLocalWhisperEngine,
  isLocalWhisperGpuBackend,
  isLocalWhisperModelFamily,
  isLocalWhisperRendererSafeLabel,
  isLocalWhisperTarget,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperArtifactId,
  type LocalWhisperBackend,
  type LocalWhisperCapabilityStaleCause,
  type LocalWhisperEngine,
  type LocalWhisperModelFamily,
  type LocalWhisperOpaqueDeviceId,
  type LocalWhisperPlatform,
  type LocalWhisperRevisionId,
  type LocalWhisperTarget,
} from './domain';

export const LOCAL_WHISPER_NATIVE_FORMATS = ['ggml'] as const;
export const LOCAL_WHISPER_MODEL_VARIANTS = ['full', 'q5_0'] as const;
export const LOCAL_WHISPER_MEMORY_EVIDENCE_BASES = ['upstream', 'derived', 'qualified'] as const;

export type LocalWhisperNativeFormat = (typeof LOCAL_WHISPER_NATIVE_FORMATS)[number];
export type LocalWhisperModelVariant = (typeof LOCAL_WHISPER_MODEL_VARIANTS)[number];
export type LocalWhisperMemoryEvidenceBasis = (typeof LOCAL_WHISPER_MEMORY_EVIDENCE_BASES)[number];

export interface LocalWhisperFamilyMemoryGuidance {
  readonly model: LocalWhisperModelFamily;
  readonly approximateVramGiB: readonly [minimum: number, maximum: number];
  readonly approximateSystemRamGiB: readonly [minimum: number, maximum: number];
}

export const LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE = Object.freeze({
  tiny: Object.freeze({
    model: 'tiny',
    approximateVramGiB: Object.freeze([1, 2] as const),
    approximateSystemRamGiB: Object.freeze([2, 4] as const),
  }),
  base: Object.freeze({
    model: 'base',
    approximateVramGiB: Object.freeze([1, 2] as const),
    approximateSystemRamGiB: Object.freeze([2, 4] as const),
  }),
  small: Object.freeze({
    model: 'small',
    approximateVramGiB: Object.freeze([2, 3] as const),
    approximateSystemRamGiB: Object.freeze([4, 6] as const),
  }),
  medium: Object.freeze({
    model: 'medium',
    approximateVramGiB: Object.freeze([3, 6] as const),
    approximateSystemRamGiB: Object.freeze([6, 10] as const),
  }),
  'large-v3': Object.freeze({
    model: 'large-v3',
    approximateVramGiB: Object.freeze([6, 8] as const),
    approximateSystemRamGiB: Object.freeze([10, 16] as const),
  }),
  'large-v3-turbo': Object.freeze({
    model: 'large-v3-turbo',
    approximateVramGiB: Object.freeze([3, 6] as const),
    approximateSystemRamGiB: Object.freeze([6, 10] as const),
  }),
} as const satisfies Readonly<Record<LocalWhisperModelFamily, LocalWhisperFamilyMemoryGuidance>>);

export interface LocalWhisperRuntimeFileIdentity {
  readonly fileId: LocalWhisperArtifactId;
  readonly kind: 'executable' | 'library' | 'data' | 'notice';
  readonly mode: number;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LocalWhisperRuntimeIdentity {
  readonly engine: LocalWhisperEngine;
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64';
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly dependencyFamily: string;
  readonly upstreamRevision: LocalWhisperRevisionId;
  readonly buildRevision: LocalWhisperRevisionId;
  readonly computeTargets: readonly string[];
  readonly protocolVersion: number;
  readonly packRevision: LocalWhisperRevisionId;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly appRevision: LocalWhisperRevisionId;
  readonly signingKeyId: LocalWhisperArtifactId;
  readonly archiveSizeBytes: number;
  readonly archiveSha256: string;
  readonly archiveSignature: string;
  readonly originId: LocalWhisperArtifactId;
  readonly expectedFiles: readonly LocalWhisperRuntimeFileIdentity[];
  readonly prerequisites: readonly string[];
  readonly provenanceId: LocalWhisperArtifactId;
  readonly sbomRevision: LocalWhisperRevisionId;
  readonly noticeIds: readonly LocalWhisperArtifactId[];
}

export interface LocalWhisperModelIdentity {
  readonly engine: LocalWhisperEngine;
  readonly logicalModel: LocalWhisperModelFamily;
  readonly sourceCheckpointRevision: LocalWhisperRevisionId;
  readonly artifactRevision: LocalWhisperRevisionId;
  readonly nativeFormat: LocalWhisperNativeFormat;
  readonly variant: LocalWhisperModelVariant;
}

export interface LocalWhisperResidencyKey {
  readonly engine: LocalWhisperEngine;
  readonly runtimePackRevision: LocalWhisperRevisionId;
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly deviceId: LocalWhisperOpaqueDeviceId | null;
  readonly model: LocalWhisperModelIdentity;
  readonly resolvedCpuThreads: number | null;
}

export interface LocalWhisperCapabilityFingerprint {
  readonly platform: LocalWhisperPlatform;
  readonly osBuildFamily: string;
  readonly architecture: 'x64' | 'arm64';
  readonly appRevision: LocalWhisperRevisionId;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly protocolVersion: number;
  readonly runtimePackRevision: LocalWhisperRevisionId;
  readonly runtimeFileIdentity: string;
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly deviceId: LocalWhisperOpaqueDeviceId | null;
  readonly driverRevision: string | null;
  readonly dependencyRuntimeRevision: string | null;
  readonly cpuIsa: readonly string[];
  readonly topologyRevision: string;
  readonly model: LocalWhisperModelIdentity;
  readonly modelFileIdentity: string;
  readonly resolvedCpuThreads: number | null;
  readonly loadSettingsRevision: string;
}

export interface LocalWhisperCapabilityEvidence {
  readonly fingerprint: LocalWhisperCapabilityFingerprint;
  readonly staleCause: LocalWhisperCapabilityStaleCause | null;
}

export interface LocalWhisperMemoryConfigurationIdentity {
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly runtimePackRevision: LocalWhisperRevisionId;
  readonly model: LocalWhisperModelIdentity;
}

export interface LocalWhisperMemoryEstimateRecord extends LocalWhisperMemoryConfigurationIdentity {
  readonly estimatedPeakRamBytes: number;
  readonly estimatedPeakVramBytes: number | 'notApplicable';
  readonly evidenceBasis: LocalWhisperMemoryEvidenceBasis;
  readonly sourceBuildRevision: LocalWhisperRevisionId;
  readonly methodologyLabel: string;
}

export interface LocalWhisperQualifiedMemoryPeak extends LocalWhisperMemoryConfigurationIdentity {
  readonly measuredPeakRamBytes: number;
  readonly measuredPeakVramBytes: number | 'notApplicable';
  readonly qualificationProfileId: LocalWhisperArtifactId;
  readonly capabilityFingerprint: string;
}

export type LocalWhisperMemoryMatrixValidationResult =
  | { readonly valid: true; readonly records: readonly LocalWhisperMemoryEstimateRecord[] }
  | {
      readonly valid: false;
      readonly reason: 'invalid-record' | 'duplicate-key' | 'missing-key' | 'unexpected-key' | 'identity-mismatch';
    };

const RUNTIME_IDENTITY_KEYS = [
  'engine',
  'platform',
  'architecture',
  'target',
  'backend',
  'dependencyFamily',
  'upstreamRevision',
  'buildRevision',
  'computeTargets',
  'protocolVersion',
  'packRevision',
  'catalogRevision',
  'appRevision',
  'signingKeyId',
  'archiveSizeBytes',
  'archiveSha256',
  'archiveSignature',
  'originId',
  'expectedFiles',
  'prerequisites',
  'provenanceId',
  'sbomRevision',
  'noticeIds',
] as const;
const RUNTIME_FILE_KEYS = ['fileId', 'kind', 'mode', 'sizeBytes', 'sha256'] as const;
const MODEL_IDENTITY_KEYS = [
  'engine',
  'logicalModel',
  'sourceCheckpointRevision',
  'artifactRevision',
  'nativeFormat',
  'variant',
] as const;
const MEMORY_IDENTITY_KEYS = ['target', 'backend', 'runtimePackRevision', 'model'] as const;
const MEMORY_ESTIMATE_KEYS = [
  ...MEMORY_IDENTITY_KEYS,
  'estimatedPeakRamBytes',
  'estimatedPeakVramBytes',
  'evidenceBasis',
  'sourceBuildRevision',
  'methodologyLabel',
] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

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

function isBoundedIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 256 && !hasLocalWhisperControlCharacter(value)
  );
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isBoundedIdentifier);
}

function isRuntimeFileIdentity(value: unknown): value is LocalWhisperRuntimeFileIdentity {
  if (!isRecord(value) || !hasExactKeys(value, RUNTIME_FILE_KEYS)) return false;
  return (
    toLocalWhisperArtifactId(value.fileId) !== null &&
    isMember(['executable', 'library', 'data', 'notice'] as const, value.kind) &&
    isNonNegativeSafeInteger(value.mode) &&
    isNonNegativeSafeInteger(value.sizeBytes) &&
    typeof value.sha256 === 'string' &&
    SHA256_PATTERN.test(value.sha256)
  );
}

export function isLocalWhisperRuntimeIdentity(value: unknown): value is LocalWhisperRuntimeIdentity {
  if (!isRecord(value) || !hasExactKeys(value, RUNTIME_IDENTITY_KEYS)) return false;
  const backendMatchesTarget =
    (value.target === 'cpu' && value.backend === 'cpu') ||
    (value.target === 'gpu' && isLocalWhisperGpuBackend(value.backend));
  return (
    isLocalWhisperEngine(value.engine) &&
    isMember(['win32', 'linux', 'darwin', 'other'] as const, value.platform) &&
    isMember(['x64', 'arm64'] as const, value.architecture) &&
    isLocalWhisperTarget(value.target) &&
    isLocalWhisperBackend(value.backend) &&
    backendMatchesTarget &&
    isBoundedIdentifier(value.dependencyFamily) &&
    toLocalWhisperRevisionId(value.upstreamRevision) !== null &&
    toLocalWhisperRevisionId(value.buildRevision) !== null &&
    isStringList(value.computeTargets) &&
    Number.isSafeInteger(value.protocolVersion) &&
    (value.protocolVersion as number) > 0 &&
    toLocalWhisperRevisionId(value.packRevision) !== null &&
    toLocalWhisperRevisionId(value.catalogRevision) !== null &&
    toLocalWhisperRevisionId(value.appRevision) !== null &&
    toLocalWhisperArtifactId(value.signingKeyId) !== null &&
    isNonNegativeSafeInteger(value.archiveSizeBytes) &&
    typeof value.archiveSha256 === 'string' &&
    SHA256_PATTERN.test(value.archiveSha256) &&
    isBoundedIdentifier(value.archiveSignature) &&
    toLocalWhisperArtifactId(value.originId) !== null &&
    Array.isArray(value.expectedFiles) &&
    value.expectedFiles.length > 0 &&
    value.expectedFiles.every(isRuntimeFileIdentity) &&
    isStringList(value.prerequisites) &&
    toLocalWhisperArtifactId(value.provenanceId) !== null &&
    toLocalWhisperRevisionId(value.sbomRevision) !== null &&
    Array.isArray(value.noticeIds) &&
    value.noticeIds.every((noticeId) => toLocalWhisperArtifactId(noticeId) !== null)
  );
}

export function isLocalWhisperModelIdentity(value: unknown): value is LocalWhisperModelIdentity {
  if (!isRecord(value) || !hasExactKeys(value, MODEL_IDENTITY_KEYS)) return false;
  if (
    !isLocalWhisperEngine(value.engine) ||
    !isLocalWhisperModelFamily(value.logicalModel) ||
    toLocalWhisperRevisionId(value.sourceCheckpointRevision) === null ||
    toLocalWhisperRevisionId(value.artifactRevision) === null ||
    !isMember(LOCAL_WHISPER_NATIVE_FORMATS, value.nativeFormat) ||
    !isMember(LOCAL_WHISPER_MODEL_VARIANTS, value.variant)
  ) {
    return false;
  }
  return value.engine === 'whisperCpp' && value.nativeFormat === 'ggml';
}

export function isLocalWhisperMemoryConfigurationIdentity(
  value: unknown,
): value is LocalWhisperMemoryConfigurationIdentity {
  if (!isRecord(value) || !hasExactKeys(value, MEMORY_IDENTITY_KEYS)) return false;
  if (
    !isLocalWhisperTarget(value.target) ||
    !isLocalWhisperBackend(value.backend) ||
    toLocalWhisperRevisionId(value.runtimePackRevision) === null ||
    !isLocalWhisperModelIdentity(value.model)
  ) {
    return false;
  }
  if (value.target === 'cpu' && value.backend !== 'cpu') return false;
  if (value.target === 'gpu' && !isLocalWhisperGpuBackend(value.backend)) return false;
  return true;
}

export function isLocalWhisperMemoryEstimateRecord(value: unknown): value is LocalWhisperMemoryEstimateRecord {
  if (!isRecord(value) || !hasExactKeys(value, MEMORY_ESTIMATE_KEYS)) return false;
  const identity = Object.fromEntries(MEMORY_IDENTITY_KEYS.map((key) => [key, value[key]]));
  if (!isLocalWhisperMemoryConfigurationIdentity(identity)) return false;
  const vramIsValid =
    value.target === 'cpu'
      ? value.estimatedPeakVramBytes === 'notApplicable'
      : isNonNegativeSafeInteger(value.estimatedPeakVramBytes);
  return (
    isNonNegativeSafeInteger(value.estimatedPeakRamBytes) &&
    vramIsValid &&
    isMember(LOCAL_WHISPER_MEMORY_EVIDENCE_BASES, value.evidenceBasis) &&
    toLocalWhisperRevisionId(value.sourceBuildRevision) !== null &&
    isLocalWhisperRendererSafeLabel(value.methodologyLabel)
  );
}

export function getLocalWhisperMemoryConfigurationKey(identity: LocalWhisperMemoryConfigurationIdentity): string {
  const model = identity.model;
  return [
    identity.target,
    identity.backend,
    identity.runtimePackRevision,
    model.engine,
    model.logicalModel,
    model.sourceCheckpointRevision,
    model.artifactRevision,
    model.nativeFormat,
    model.variant,
  ].join('|');
}

export function getLocalWhisperResidencyKey(identity: LocalWhisperResidencyKey): string {
  return [
    identity.engine,
    identity.runtimePackRevision,
    identity.target,
    identity.backend,
    identity.deviceId ?? 'none',
    identity.model.logicalModel,
    identity.model.sourceCheckpointRevision,
    identity.model.artifactRevision,
    identity.model.nativeFormat,
    identity.model.variant,
    identity.resolvedCpuThreads ?? 'none',
  ].join('|');
}

export function getLocalWhisperCapabilityFingerprintKey(fingerprint: LocalWhisperCapabilityFingerprint): string {
  return JSON.stringify({
    ...fingerprint,
    cpuIsa: [...fingerprint.cpuIsa],
    model: { ...fingerprint.model },
  });
}

export function validateLocalWhisperMemoryEstimateMatrix(
  records: readonly unknown[],
  expectedConfigurations: readonly LocalWhisperMemoryConfigurationIdentity[],
): LocalWhisperMemoryMatrixValidationResult {
  if (!records.every(isLocalWhisperMemoryEstimateRecord)) return { valid: false, reason: 'invalid-record' };
  const typedRecords = records;
  const actualKeys = typedRecords.map(getLocalWhisperMemoryConfigurationKey);
  if (new Set(actualKeys).size !== actualKeys.length) return { valid: false, reason: 'duplicate-key' };

  const expectedKeys = expectedConfigurations.map(getLocalWhisperMemoryConfigurationKey);
  if (new Set(expectedKeys).size !== expectedKeys.length) return { valid: false, reason: 'identity-mismatch' };
  const expectedSet = new Set(expectedKeys);
  if (actualKeys.some((key) => !expectedSet.has(key))) return { valid: false, reason: 'unexpected-key' };
  if (expectedKeys.some((key) => !actualKeys.includes(key))) return { valid: false, reason: 'missing-key' };

  return { valid: true, records: Object.freeze([...typedRecords]) };
}

export function getLocalWhisperFamilyGuidance(model: unknown): LocalWhisperFamilyMemoryGuidance | undefined {
  return isLocalWhisperModelFamily(model) ? LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[model] : undefined;
}

export function hasCompleteLocalWhisperFamilyGuidance(): boolean {
  return LOCAL_WHISPER_MODEL_FAMILIES.every((model) => LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[model].model === model);
}
