import type { LocalWhisperCatalogPurpose } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';

export const LOCAL_WHISPER_PACKAGE_MODES = ['disabled', 'fixture', 'production'] as const;
export const LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_FIXTURE_ARTIFACT_NAME = 'local-whisper-public-fixture-v1';
export const LOCAL_WHISPER_FIXTURE_KEY_PREFIX = 'fixture-';
export const LOCAL_WHISPER_FIXTURE_ORIGIN_SUFFIX = '.invalid';

export type LocalWhisperPackageMode = (typeof LOCAL_WHISPER_PACKAGE_MODES)[number];
export type LocalWhisperPackagePlatform = 'darwin' | 'linux' | 'win32';

export interface LocalWhisperKeyringDocument {
  readonly schemaVersion: typeof LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION;
  readonly purpose: LocalWhisperCatalogPurpose | 'disabled';
  readonly appRevision: string;
  readonly workerProtocolVersion: number;
  readonly publicKeys: readonly { readonly keyId: string; readonly publicKeyPem: string }[];
  readonly origins: readonly { readonly id: string; readonly origin: string }[];
}

export interface LocalWhisperBundleFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LocalWhisperBundleManifest {
  readonly schemaVersion: typeof LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION;
  readonly purpose: LocalWhisperCatalogPurpose;
  readonly keyId: string;
  readonly catalogSha256: string;
  readonly createdBy: 'local-whisper-fixture-producer' | 'external-production-authority';
  readonly synthetic: boolean;
  readonly files: readonly LocalWhisperBundleFile[];
}

export interface LocalWhisperPackManifest {
  readonly schemaVersion: typeof LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION;
  readonly purpose: LocalWhisperCatalogPurpose;
  readonly artifactKind: 'model' | 'runtime';
  readonly artifactId: string;
  readonly platform: string;
  readonly architecture: string;
  readonly engine: 'whisperCpp';
  readonly target: string;
  readonly backend: string;
  readonly protocolVersion: number;
  readonly appRevision: string;
  readonly catalogRevision: string;
  readonly artifactRevision: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly signatureBase64: string;
  readonly signingKeyId: string;
  readonly expectedFiles: readonly LocalWhisperBundleFile[];
  readonly dynamicDependencies: readonly string[];
  readonly compatibilityRows: readonly string[];
  readonly memoryEstimates: readonly {
    readonly modelFamily: string;
    readonly ramBytes: number;
    readonly vramBytes: number | 'notApplicable';
  }[];
  readonly source: {
    readonly lockId: string;
    readonly commit: string;
    readonly tree: string;
    readonly subset: string;
    readonly patch: string;
  };
  readonly build: {
    readonly packDefinitionId: string;
    readonly toolchain: string;
    readonly options: readonly string[];
    readonly acceleratorArchitectures: readonly string[];
  };
  readonly licenseIds: readonly string[];
  readonly noticeIds: readonly string[];
  readonly sbomId: string;
  readonly provenanceId: string;
  readonly supportTier: 'planned' | 'preview-untested' | 'production';
  readonly redistributionReview: 'approved' | 'fixture-only' | 'pending';
}

export interface LocalWhisperProductionApproval {
  readonly schemaVersion: typeof LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION;
  readonly purpose: 'production';
  readonly approvalId: string;
  readonly approvedAt: string;
  readonly approvedBy: string;
  readonly originPolicyId: string;
  readonly licenseReviewId: string;
  readonly redistributionApproved: true;
  readonly frozenCatalogSha256: string;
  readonly approvedSourceLockIds: readonly string[];
  readonly approvedToolchainProfileIds: readonly string[];
  readonly approvedPackDefinitionIds: readonly string[];
  readonly approvedOriginIds: readonly string[];
  readonly approvedSigningKeyIds: readonly string[];
}

export interface LocalWhisperPackageState {
  readonly schemaVersion: typeof LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION;
  readonly mode: LocalWhisperPackageMode;
  readonly purpose: LocalWhisperCatalogPurpose | 'disabled';
  readonly platform: LocalWhisperPackagePlatform;
  readonly catalogSha256: string | null;
  readonly bundleManifestSha256: string | null;
  readonly signingKeyId: string | null;
  readonly executableActionsEnabled: boolean;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const LOGICAL_ID_PATTERN = /^[\dA-Za-z][\w.-]{0,255}$/u;
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[\w./-]{1,512}$/u;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

export function isLogicalId(value: unknown): value is string {
  return typeof value === 'string' && LOGICAL_ID_PATTERN.test(value);
}

export function isSafeRelativePath(value: unknown): value is string {
  return typeof value === 'string' && SAFE_RELATIVE_PATH.test(value) && !value.includes('//');
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function parsePackageMode(value: unknown): LocalWhisperPackageMode {
  if (typeof value === 'string' && LOCAL_WHISPER_PACKAGE_MODES.some((mode) => mode === value)) {
    return value as LocalWhisperPackageMode;
  }
  throw new Error('Local Whisper packaging requires an explicit disabled, fixture, or production mode');
}

export function parsePackagePlatform(value: unknown): LocalWhisperPackagePlatform {
  if (value === 'darwin' || value === 'linux' || value === 'win32') return value;
  throw new Error('Local Whisper packaging requires an explicit darwin, linux, or win32 platform');
}

function isStringArray(value: unknown, allowEmpty = false): value is readonly string[] {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every(isLogicalId) &&
    new Set(value).size === value.length
  );
}

function isBundleFile(value: unknown): value is LocalWhisperBundleFile {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['path', 'sizeBytes', 'sha256']) &&
    isSafeRelativePath(value.path) &&
    isPositiveSafeInteger(value.sizeBytes) &&
    isSha256(value.sha256)
  );
}

function isCanonicalBase64(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Buffer.from(value, 'base64').toString('base64') === value;
}

export function parseKeyringDocument(value: unknown): LocalWhisperKeyringDocument {
  const keys = ['schemaVersion', 'purpose', 'appRevision', 'workerProtocolVersion', 'publicKeys', 'origins'];
  if (!isRecord(value) || !hasExactKeys(value, keys)) throw new Error('Invalid Local Whisper keyring');
  if (
    value.schemaVersion !== LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION ||
    !['disabled', 'fixture', 'production'].includes(String(value.purpose)) ||
    !isLogicalId(value.appRevision) ||
    !isPositiveSafeInteger(value.workerProtocolVersion) ||
    !Array.isArray(value.publicKeys) ||
    !Array.isArray(value.origins)
  ) {
    throw new Error('Invalid Local Whisper keyring');
  }
  const publicKeys = value.publicKeys;
  const origins = value.origins;
  if (
    !publicKeys.every(
      (entry) =>
        isRecord(entry) &&
        hasExactKeys(entry, ['keyId', 'publicKeyPem']) &&
        isLogicalId(entry.keyId) &&
        typeof entry.publicKeyPem === 'string' &&
        entry.publicKeyPem.length <= 4096,
    ) ||
    !origins.every(
      (entry) =>
        isRecord(entry) &&
        hasExactKeys(entry, ['id', 'origin']) &&
        isLogicalId(entry.id) &&
        typeof entry.origin === 'string' &&
        isStrictHttpsOrigin(entry.origin),
    )
  ) {
    throw new Error('Invalid Local Whisper keyring');
  }
  if (
    new Set(publicKeys.map((entry) => (entry as { keyId: string }).keyId)).size !== publicKeys.length ||
    new Set(origins.map((entry) => (entry as { id: string }).id)).size !== origins.length
  ) {
    throw new Error('Duplicate Local Whisper keyring identity');
  }
  if (value.purpose === 'disabled' && (publicKeys.length !== 0 || origins.length !== 0)) {
    throw new Error('Disabled Local Whisper keyring must be empty');
  }
  return value as unknown as LocalWhisperKeyringDocument;
}

function isStrictHttpsOrigin(value: string): boolean {
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

export function parseBundleManifest(value: unknown): LocalWhisperBundleManifest {
  const keys = ['schemaVersion', 'purpose', 'keyId', 'catalogSha256', 'createdBy', 'synthetic', 'files'];
  if (!isRecord(value) || !hasExactKeys(value, keys)) throw new Error('Invalid Local Whisper bundle manifest');
  if (
    value.schemaVersion !== LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION ||
    (value.purpose !== 'fixture' && value.purpose !== 'production') ||
    !isLogicalId(value.keyId) ||
    !isSha256(value.catalogSha256) ||
    (value.createdBy !== 'local-whisper-fixture-producer' && value.createdBy !== 'external-production-authority') ||
    typeof value.synthetic !== 'boolean' ||
    !isUnknownArray(value.files) ||
    value.files.length === 0 ||
    !value.files.every(isBundleFile)
  ) {
    throw new Error('Invalid Local Whisper bundle manifest');
  }
  const filePaths = value.files.map((file) => file.path);
  if (
    new Set(filePaths).size !== filePaths.length ||
    filePaths.some((filePath) => filePath === 'bundle-manifest.json')
  ) {
    throw new Error('Invalid Local Whisper bundle file set');
  }
  const sortedPaths = [...filePaths].sort((left, right) => left.localeCompare(right, 'en'));
  if (filePaths.some((filePath, index) => filePath !== sortedPaths[index])) {
    throw new Error('Local Whisper bundle manifest is not canonical');
  }
  if (
    (value.purpose === 'fixture' && (!value.synthetic || value.createdBy !== 'local-whisper-fixture-producer')) ||
    (value.purpose === 'production' && (value.synthetic || value.createdBy !== 'external-production-authority'))
  ) {
    throw new Error('Local Whisper bundle purpose mismatch');
  }
  return value as unknown as LocalWhisperBundleManifest;
}

function hasPackIdentityShape(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION &&
    (value.purpose === 'fixture' || value.purpose === 'production') &&
    (value.artifactKind === 'model' || value.artifactKind === 'runtime') &&
    isLogicalId(value.artifactId) &&
    isLogicalId(value.platform) &&
    isLogicalId(value.architecture) &&
    value.engine === 'whisperCpp' &&
    isLogicalId(value.target) &&
    isLogicalId(value.backend) &&
    isPositiveSafeInteger(value.protocolVersion) &&
    isLogicalId(value.appRevision) &&
    isLogicalId(value.catalogRevision) &&
    isLogicalId(value.artifactRevision) &&
    isPositiveSafeInteger(value.sizeBytes) &&
    isSha256(value.sha256) &&
    isCanonicalBase64(value.signatureBase64) &&
    isLogicalId(value.signingKeyId)
  );
}

function hasPackEvidenceShape(value: Record<string, unknown>): boolean {
  return (
    isUnknownArray(value.expectedFiles) &&
    value.expectedFiles.every(isBundleFile) &&
    isStringArray(value.dynamicDependencies, value.artifactKind === 'model') &&
    isStringArray(value.compatibilityRows) &&
    isUnknownArray(value.memoryEstimates) &&
    value.memoryEstimates.length > 0 &&
    isRecord(value.source) &&
    hasExactKeys(value.source, ['lockId', 'commit', 'tree', 'subset', 'patch']) &&
    Object.values(value.source).every(isLogicalId) &&
    isRecord(value.build) &&
    hasExactKeys(value.build, ['packDefinitionId', 'toolchain', 'options', 'acceleratorArchitectures']) &&
    isLogicalId(value.build.packDefinitionId) &&
    isLogicalId(value.build.toolchain) &&
    isStringArray(value.build.options) &&
    isStringArray(value.build.acceleratorArchitectures, true) &&
    isStringArray(value.licenseIds) &&
    isStringArray(value.noticeIds) &&
    isLogicalId(value.sbomId) &&
    isLogicalId(value.provenanceId) &&
    ['planned', 'preview-untested', 'production'].includes(String(value.supportTier)) &&
    ['approved', 'fixture-only', 'pending'].includes(String(value.redistributionReview))
  );
}

export function parsePackManifest(value: unknown): LocalWhisperPackManifest {
  const keys = [
    'schemaVersion',
    'purpose',
    'artifactKind',
    'artifactId',
    'platform',
    'architecture',
    'engine',
    'target',
    'backend',
    'protocolVersion',
    'appRevision',
    'catalogRevision',
    'artifactRevision',
    'sizeBytes',
    'sha256',
    'signatureBase64',
    'signingKeyId',
    'expectedFiles',
    'dynamicDependencies',
    'compatibilityRows',
    'memoryEstimates',
    'source',
    'build',
    'licenseIds',
    'noticeIds',
    'sbomId',
    'provenanceId',
    'supportTier',
    'redistributionReview',
  ];
  if (!isRecord(value) || !hasExactKeys(value, keys)) throw new Error('Invalid Local Whisper pack manifest');
  if (!hasPackIdentityShape(value) || !hasPackEvidenceShape(value)) {
    throw new Error('Invalid Local Whisper pack manifest');
  }
  const manifest = value as unknown as LocalWhisperPackManifest;
  if (
    !manifest.memoryEstimates.every(
      (estimate) =>
        isRecord(estimate) &&
        hasExactKeys(estimate, ['modelFamily', 'ramBytes', 'vramBytes']) &&
        isLogicalId(estimate.modelFamily) &&
        isPositiveSafeInteger(estimate.ramBytes) &&
        (estimate.vramBytes === 'notApplicable' || isPositiveSafeInteger(estimate.vramBytes)),
    )
  ) {
    throw new Error('Invalid Local Whisper pack memory estimates');
  }
  if (
    (manifest.purpose === 'fixture' && manifest.redistributionReview !== 'fixture-only') ||
    (manifest.purpose === 'production' && manifest.redistributionReview !== 'approved')
  ) {
    throw new Error('Local Whisper pack redistribution state mismatch');
  }
  return manifest;
}

export function parseProductionApproval(value: unknown): LocalWhisperProductionApproval {
  const keys = [
    'schemaVersion',
    'purpose',
    'approvalId',
    'approvedAt',
    'approvedBy',
    'originPolicyId',
    'licenseReviewId',
    'redistributionApproved',
    'frozenCatalogSha256',
    'approvedSourceLockIds',
    'approvedToolchainProfileIds',
    'approvedPackDefinitionIds',
    'approvedOriginIds',
    'approvedSigningKeyIds',
  ];
  if (
    !isRecord(value) ||
    !hasExactKeys(value, keys) ||
    value.schemaVersion !== LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION ||
    value.purpose !== 'production' ||
    !isLogicalId(value.approvalId) ||
    typeof value.approvedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.approvedAt)) ||
    new Date(value.approvedAt).toISOString() !== value.approvedAt ||
    !isLogicalId(value.approvedBy) ||
    !isLogicalId(value.originPolicyId) ||
    !isLogicalId(value.licenseReviewId) ||
    value.redistributionApproved !== true ||
    !isSha256(value.frozenCatalogSha256) ||
    !isStringArray(value.approvedSourceLockIds) ||
    !isStringArray(value.approvedToolchainProfileIds) ||
    !isStringArray(value.approvedPackDefinitionIds) ||
    !isStringArray(value.approvedOriginIds) ||
    !isStringArray(value.approvedSigningKeyIds)
  ) {
    throw new Error('Invalid Local Whisper production approval');
  }
  return value as unknown as LocalWhisperProductionApproval;
}
