import {
  DIAGNOSTIC_CAPTURE_CATEGORIES,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureSettings,
} from './diagnosticCaptureSettings';
import { PRETTIFY_CLI_PROVIDER_IDS, PRETTIFY_PROVIDER_IDS, type KnownPrettifyProviderId } from './prettifySettings';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  isTranslationTargetLanguage,
  type TranslationProviderId,
} from './translationProvider';
import {
  LOCAL_WHISPER_ACTIVITY_STATES,
  LOCAL_WHISPER_ARTIFACT_SETUP_STATES,
  LOCAL_WHISPER_BACKENDS,
  LOCAL_WHISPER_CAPABILITY_STATES,
  LOCAL_WHISPER_FAILURE_CODES,
  LOCAL_WHISPER_MODEL_FAMILIES,
  LOCAL_WHISPER_OPERATIONAL_STATUSES,
  LOCAL_WHISPER_RESIDENCY_STATES,
  LOCAL_WHISPER_SUPPORT_TIERS,
  LOCAL_WHISPER_TARGETS,
  isLocalWhisperRendererSafeLabel,
  toLocalWhisperRevisionId,
  type LocalWhisperActivityState,
  type LocalWhisperArtifactSetupState,
  type LocalWhisperBackend,
  type LocalWhisperCapabilityState,
  type LocalWhisperFailureCode,
  type LocalWhisperModelFamily,
  type LocalWhisperOperationalStatus,
  type LocalWhisperResidencyState,
  type LocalWhisperSupportTier,
  type LocalWhisperTarget,
} from './localWhisper/domain';
import { LOCAL_WHISPER_MODEL_VARIANTS, type LocalWhisperModelVariant } from './localWhisper/catalog';

export const DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION = 1 as const;
export const DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION = 2 as const;
export const DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION = 3 as const;
export const DIAGNOSTICS_ARCHIVE_SCHEMA_VERSIONS = [
  DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
] as const;
export const DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const NATIVE_RUNTIME_DIAGNOSTICS_SCHEMA_VERSION = 1 as const;
export const NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES = 4 * 1024 * 1024;
export const NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS = 10_000;
export const LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES = 65_536 as const;
export const DIAGNOSTICS_EXPORT_IPC_CHANNEL = 'export-diagnostics' as const;

export const DIAGNOSTICS_EXPORT_STATUSES = ['saved', 'cancelled', 'failed'] as const;

export const DIAGNOSTICS_ARCHIVE_FORMATS = ['zip', 'tar-gzip'] as const;
export const DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES = ['windows', 'linux', 'macos'] as const;
export const DIAGNOSTICS_ARCHIVE_ARCHITECTURES = [
  'arm',
  'arm64',
  'ia32',
  'loong64',
  'mips',
  'mipsel',
  'ppc',
  'ppc64',
  'riscv64',
  's390',
  's390x',
  'x64',
] as const;

export const DIAGNOSTICS_ARCHIVE_MEMBER_NAMES = Object.freeze({
  AuditEvents: 'provider-audit/events.jsonl',
  DiagnosticTextActions: 'diagnostics/text-actions.jsonl',
  NativeRuntime: 'diagnostics/native-runtime.jsonl',
  LocalWhisperSnapshot: 'local-whisper/snapshot.json',
  Manifest: 'manifest.json',
} as const);

export const DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES = [
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot,
] as const;

export const DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS = ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'] as const;
export const DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING =
  'Diagnostic text may contain private or unrecognized secret data; treat this archive as sensitive.' as const;

const MEBIBYTE_BYTES = 1024 * 1024;

export const DIAGNOSTICS_ARCHIVE_LIMITS = Object.freeze({
  MaxArchiveStructureBytes: 1 * MEBIBYTE_BYTES,
  MaxCompressionRatio: 1000,
  MaxJsonlLineBytes: 8 * MEBIBYTE_BYTES,
  MaxMemberBytes: 64 * MEBIBYTE_BYTES,
  MaxOuterArchiveBytes: 130 * MEBIBYTE_BYTES,
  MaxRecordsPerJsonlMember: 100_000,
  MaxTotalUncompressedBytes: 128 * MEBIBYTE_BYTES,
  MinCompressionRatioMemberBytes: 1 * MEBIBYTE_BYTES,
} as const);

export type DiagnosticsArchiveFormat = (typeof DIAGNOSTICS_ARCHIVE_FORMATS)[number];
export type DiagnosticsArchivePlatformFamily = (typeof DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES)[number];
export type DiagnosticsArchiveArchitecture = (typeof DIAGNOSTICS_ARCHIVE_ARCHITECTURES)[number];
export type DiagnosticsArchiveVoiceProviderId = (typeof DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS)[number];
export type DiagnosticsArchivePayloadMemberName = (typeof DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES)[number];
export type DiagnosticsExportStatus = (typeof DIAGNOSTICS_EXPORT_STATUSES)[number];
export type DiagnosticsArchiveSchemaVersion = (typeof DIAGNOSTICS_ARCHIVE_SCHEMA_VERSIONS)[number];

export type DiagnosticsExportResult =
  { readonly status: 'saved' } | { readonly status: 'cancelled' } | { readonly status: 'failed' };

export function isDiagnosticsArchiveOuterByteLengthWithinLimit(byteLength: number): boolean {
  return (
    Number.isSafeInteger(byteLength) && byteLength >= 0 && byteLength <= DIAGNOSTICS_ARCHIVE_LIMITS.MaxOuterArchiveBytes
  );
}

export function isDiagnosticsArchiveStructureByteLengthWithinLimit(byteLength: number): boolean {
  return (
    Number.isSafeInteger(byteLength) &&
    byteLength >= 0 &&
    byteLength <= DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes
  );
}

export interface DiagnosticsArchiveProviderFamilyManifest<ProviderId extends string> {
  readonly capabilityAvailable: boolean;
  readonly configured: boolean;
  readonly readinessKnown: boolean;
  readonly ready: boolean;
  readonly registeredProviderIds: readonly ProviderId[];
  readonly selectedProviderId: ProviderId | null;
}

export interface DiagnosticsArchiveEnvironmentSnapshot {
  readonly appVersion: string;
  readonly architecture: DiagnosticsArchiveArchitecture;
  readonly cloakBrowserVersion: string;
  readonly electronVersion: string;
  readonly nodeVersion: string;
  readonly platformFamily: DiagnosticsArchivePlatformFamily;
  readonly playwrightVersion: string;
  readonly providers: {
    readonly voice: DiagnosticsArchiveProviderFamilyManifest<DiagnosticsArchiveVoiceProviderId>;
    readonly prettify: DiagnosticsArchiveProviderFamilyManifest<KnownPrettifyProviderId>;
    readonly translation: DiagnosticsArchiveProviderFamilyManifest<TranslationProviderId>;
  };
}

export interface DiagnosticsArchiveAuditSummary {
  readonly duplicateRecordCount: number;
  readonly invalidRecordCount: number;
  readonly validRecordCount: number;
}

export interface DiagnosticsArchiveDiagnosticSummary {
  readonly includedCategories: readonly DiagnosticCaptureCategory[];
  readonly recordCount: number;
  readonly recordedAtRange: {
    readonly from: string;
    readonly to: string;
  } | null;
  readonly retainedBytes: number;
}

export interface DiagnosticsArchiveNativeRuntimeSummary {
  readonly byteLength: number;
  readonly duplicateRecordCount: number;
  readonly firstObservedAt: string | null;
  readonly includedRecordCount: number;
  readonly invalidRecordCount: number;
  readonly lastObservedAt: string | null;
  readonly truncated: boolean;
  readonly validRecordCount: number;
}

export interface DiagnosticsArchiveMemberSummary {
  readonly byteLength: number;
  readonly name: DiagnosticsArchivePayloadMemberName;
  readonly sha256: string;
}

export interface LocalWhisperDiagnosticsSnapshot {
  readonly activityState: LocalWhisperActivityState;
  readonly artifactCount: number;
  readonly backend: LocalWhisperBackend | null;
  readonly capabilityState: LocalWhisperCapabilityState;
  readonly capturedAt: string;
  readonly deviceDisplayLabel: string | null;
  readonly deviceProductId: number | null;
  readonly deviceVendorId: number | null;
  readonly driverVersionLabel: string | null;
  readonly engineId: 'whisperCpp';
  readonly failureCode: LocalWhisperFailureCode | null;
  readonly installedArtifactCount: number;
  readonly modelFamily: LocalWhisperModelFamily;
  readonly modelRevision: string;
  readonly modelSetupState: LocalWhisperArtifactSetupState;
  readonly modelVariant: LocalWhisperModelVariant;
  readonly operationalStatus: LocalWhisperOperationalStatus;
  readonly residencyState: LocalWhisperResidencyState;
  readonly runtimeRevision: string | null;
  readonly runtimeSetupState: LocalWhisperArtifactSetupState;
  readonly runtimeVersionLabel: string | null;
  readonly schemaVersion: typeof LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION;
  readonly supportTier: LocalWhisperSupportTier;
  readonly target: LocalWhisperTarget;
}

export interface DiagnosticsArchiveManifest {
  readonly appVersion: string;
  readonly archiveId: string;
  readonly audit: DiagnosticsArchiveAuditSummary;
  readonly captureSettings: DiagnosticCaptureSettings;
  readonly createdAt: string;
  readonly diagnostics: DiagnosticsArchiveDiagnosticSummary;
  readonly nativeRuntime?: DiagnosticsArchiveNativeRuntimeSummary;
  readonly members: readonly DiagnosticsArchiveMemberSummary[];
  readonly platform: {
    readonly architecture: DiagnosticsArchiveArchitecture;
    readonly family: DiagnosticsArchivePlatformFamily;
  };
  readonly providers: DiagnosticsArchiveEnvironmentSnapshot['providers'];
  readonly runtimeVersions: {
    readonly cloakBrowser: string;
    readonly electron: string;
    readonly node: string;
    readonly playwright: string;
  };
  readonly schemaVersion: DiagnosticsArchiveSchemaVersion;
  readonly schemaVersions: {
    readonly database: number;
    readonly diagnosticRow: typeof DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION;
    readonly localWhisperSnapshot?: typeof LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION;
    readonly nativeRuntime?: typeof NATIVE_RUNTIME_DIAGNOSTICS_SCHEMA_VERSION;
    readonly providerAudit: number;
    readonly redactor: number;
  };
  readonly sensitivity: {
    readonly containsDiagnosticText: boolean;
    readonly warning: typeof DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING | null;
  };
}

export interface DiagnosticArchiveTextActionRow {
  readonly actionId: string;
  readonly actionType: DiagnosticCaptureCategory;
  readonly contractVersion: string | null;
  readonly providerId: KnownPrettifyProviderId | TranslationProviderId;
  readonly providerOperationId: string | null;
  readonly recordedAt: string;
  readonly redactionCount: number;
  readonly redactorVersion: number;
  readonly resultBytes: number;
  readonly resultText: string;
  readonly retainedBytes: number;
  readonly schemaVersion: typeof DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION;
  readonly sourceBytes: number;
  readonly sourceKind: 'provider' | 'cache';
  readonly sourceText: string;
  readonly targetLanguage: string | null;
}

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CANONICAL_SEMANTIC_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_SAFE_VERSION_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key));
}

function isOneOf<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === 'string' && values.includes(value as Value);
}

function isDiagnosticsArchiveSchemaVersion(value: unknown): value is DiagnosticsArchiveSchemaVersion {
  return typeof value === 'number' && (DIAGNOSTICS_ARCHIVE_SCHEMA_VERSIONS as readonly number[]).includes(value);
}

/** Validates the closed renderer-safe export result without accepting extra fields. */
export function isDiagnosticsExportResult(value: unknown): value is DiagnosticsExportResult {
  return isRecord(value) && hasExactKeys(value, ['status']) && isOneOf(DIAGNOSTICS_EXPORT_STATUSES, value.status);
}

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isSafeVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SAFE_VERSION_LENGTH &&
    !value.includes('\r') &&
    !value.includes('\n')
  );
}

function isCanonicalSemanticVersion(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > MAX_SAFE_VERSION_LENGTH ||
    !CANONICAL_SEMANTIC_VERSION_PATTERN.test(value)
  ) {
    return false;
  }
  return value.split('.').every((part) => Number.isSafeInteger(Number(part)));
}

function hasClosedDiagnosticActionMetadata(value: Record<string, unknown>): boolean {
  if (value.actionType === 'translation') {
    if (!isOneOf(TRANSLATION_PROVIDER_IDS, value.providerId)) return false;
    return (
      value.contractVersion === TRANSLATION_PROVIDER_INFO[value.providerId].contractVersion &&
      typeof value.targetLanguage === 'string' &&
      isTranslationTargetLanguage(value.providerId, value.targetLanguage)
    );
  }
  if (value.actionType !== 'prettify' || !isOneOf(PRETTIFY_PROVIDER_IDS, value.providerId)) return false;
  if (value.targetLanguage !== null) return false;
  return PRETTIFY_CLI_PROVIDER_IDS.includes(value.providerId as (typeof PRETTIFY_CLI_PROVIDER_IDS)[number])
    ? isCanonicalSemanticVersion(value.contractVersion)
    : value.contractVersion === null;
}

function isExactProviderIdList<const ProviderId extends string>(
  value: unknown,
  expected: readonly ProviderId[],
): value is readonly ProviderId[] {
  return Array.isArray(value) && value.length === expected.length && expected.every((id, index) => value[index] === id);
}

function isProviderFamilyManifest<const ProviderId extends string>(
  value: unknown,
  providerIds: readonly ProviderId[],
): value is DiagnosticsArchiveProviderFamilyManifest<ProviderId> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'capabilityAvailable',
      'configured',
      'readinessKnown',
      'ready',
      'registeredProviderIds',
      'selectedProviderId',
    ])
  ) {
    return false;
  }

  return (
    typeof value.capabilityAvailable === 'boolean' &&
    typeof value.configured === 'boolean' &&
    typeof value.readinessKnown === 'boolean' &&
    typeof value.ready === 'boolean' &&
    isExactProviderIdList(value.registeredProviderIds, providerIds) &&
    (value.selectedProviderId === null || isOneOf(providerIds, value.selectedProviderId))
  );
}

function isProvidersManifest(value: unknown): value is DiagnosticsArchiveEnvironmentSnapshot['providers'] {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['voice', 'prettify', 'translation']) &&
    isProviderFamilyManifest(value.voice, DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS) &&
    isProviderFamilyManifest(value.prettify, PRETTIFY_PROVIDER_IDS) &&
    isProviderFamilyManifest(value.translation, TRANSLATION_PROVIDER_IDS)
  );
}

export function isDiagnosticsArchiveEnvironmentSnapshot(
  value: unknown,
): value is DiagnosticsArchiveEnvironmentSnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'appVersion',
      'architecture',
      'cloakBrowserVersion',
      'electronVersion',
      'nodeVersion',
      'platformFamily',
      'playwrightVersion',
      'providers',
    ]) &&
    isSafeVersion(value.appVersion) &&
    isOneOf(DIAGNOSTICS_ARCHIVE_ARCHITECTURES, value.architecture) &&
    isSafeVersion(value.cloakBrowserVersion) &&
    isSafeVersion(value.electronVersion) &&
    isSafeVersion(value.nodeVersion) &&
    isOneOf(DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES, value.platformFamily) &&
    isSafeVersion(value.playwrightVersion) &&
    isProvidersManifest(value.providers)
  );
}

function isCaptureSettings(value: unknown): value is DiagnosticCaptureSettings {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['captureTranslationDiagnostics', 'capturePrettifyDiagnostics']) &&
    typeof value.captureTranslationDiagnostics === 'boolean' &&
    typeof value.capturePrettifyDiagnostics === 'boolean'
  );
}

function isAuditSummary(value: unknown): value is DiagnosticsArchiveAuditSummary {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['duplicateRecordCount', 'invalidRecordCount', 'validRecordCount']) &&
    isSafeCount(value.duplicateRecordCount) &&
    isSafeCount(value.invalidRecordCount) &&
    isSafeCount(value.validRecordCount)
  );
}

function isRecordedAtRange(
  value: unknown,
): value is NonNullable<DiagnosticsArchiveDiagnosticSummary['recordedAtRange']> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['from', 'to']) &&
    isCanonicalTimestamp(value.from) &&
    isCanonicalTimestamp(value.to) &&
    value.from <= value.to
  );
}

function isDiagnosticSummary(value: unknown): value is DiagnosticsArchiveDiagnosticSummary {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['includedCategories', 'recordCount', 'recordedAtRange', 'retainedBytes']) ||
    !Array.isArray(value.includedCategories) ||
    !value.includedCategories.every((category) => isOneOf(DIAGNOSTIC_CAPTURE_CATEGORIES, category)) ||
    new Set(value.includedCategories).size !== value.includedCategories.length ||
    !isSafeCount(value.recordCount) ||
    !isSafeCount(value.retainedBytes)
  ) {
    return false;
  }

  const includedCategories = value.includedCategories as readonly DiagnosticCaptureCategory[];
  const categoriesInCanonicalOrder = DIAGNOSTIC_CAPTURE_CATEGORIES.filter((category) =>
    includedCategories.includes(category),
  );
  if (!categoriesInCanonicalOrder.every((category, index) => includedCategories[index] === category)) {
    return false;
  }
  return value.recordCount === 0
    ? value.recordedAtRange === null && value.retainedBytes === 0 && includedCategories.length === 0
    : isRecordedAtRange(value.recordedAtRange) && includedCategories.length > 0 && value.retainedBytes > 0;
}

function isNativeRuntimeSummary(value: unknown): value is DiagnosticsArchiveNativeRuntimeSummary {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'byteLength',
      'duplicateRecordCount',
      'firstObservedAt',
      'includedRecordCount',
      'invalidRecordCount',
      'lastObservedAt',
      'truncated',
      'validRecordCount',
    ]) ||
    !isSafeCount(value.byteLength) ||
    !isSafeCount(value.duplicateRecordCount) ||
    !isSafeCount(value.includedRecordCount) ||
    !isSafeCount(value.invalidRecordCount) ||
    !isSafeCount(value.validRecordCount) ||
    value.byteLength > NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_BYTES ||
    value.includedRecordCount > NATIVE_RUNTIME_DIAGNOSTICS_MAXIMUM_RECORDS ||
    typeof value.truncated !== 'boolean'
  ) {
    return false;
  }
  if (value.includedRecordCount === 0) {
    return value.byteLength === 0 && value.firstObservedAt === null && value.lastObservedAt === null;
  }
  return (
    value.byteLength > 0 &&
    isCanonicalTimestamp(value.firstObservedAt) &&
    isCanonicalTimestamp(value.lastObservedAt) &&
    value.firstObservedAt <= value.lastObservedAt &&
    value.validRecordCount >= value.includedRecordCount
  );
}

function isMemberSummary(value: unknown): value is DiagnosticsArchiveMemberSummary {
  if (!(
    isRecord(value) &&
    hasExactKeys(value, ['byteLength', 'name', 'sha256']) &&
    isSafeCount(value.byteLength) &&
    value.byteLength <= DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes &&
    isOneOf(DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES, value.name) &&
    typeof value.sha256 === 'string' &&
    SHA256_PATTERN.test(value.sha256)
  )) {
    return false;
  }
  return (
    value.name !== DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot ||
    value.byteLength <= LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES
  );
}

function isMemberInventory(
  value: unknown,
  schemaVersion: DiagnosticsArchiveSchemaVersion,
): value is readonly DiagnosticsArchiveMemberSummary[] {
  const maximumMembers =
    schemaVersion === DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION
      ? 2
      : schemaVersion === DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION
        ? 3
        : 4;
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumMembers || !value.every(isMemberSummary)) {
    return false;
  }
  if (value[0].name !== DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents) return false;
  const expectedOrder = DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES.filter((name) =>
    value.some((member) => member.name === name),
  );
  if (!value.every((member, index) => member.name === expectedOrder[index])) return false;
  if (
    schemaVersion === DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION &&
    value.some(
      (member) =>
        member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot ||
        member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime,
    )
  ) {
    return false;
  }
  if (
    schemaVersion === DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION &&
    value.some((member) => member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime)
  ) {
    return false;
  }
  return new Set(value.map((member) => member.name)).size === value.length;
}

function isSchemaVersions(
  value: unknown,
  schemaVersion: DiagnosticsArchiveSchemaVersion,
): value is DiagnosticsArchiveManifest['schemaVersions'] {
  const hasLocalWhisperSnapshot =
    isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'localWhisperSnapshot');
  const expectedKeys =
    schemaVersion === DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION
      ? [
          'database',
          'diagnosticRow',
          ...(hasLocalWhisperSnapshot ? ['localWhisperSnapshot'] : []),
          'nativeRuntime',
          'providerAudit',
          'redactor',
        ]
      : schemaVersion === DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION
        ? ['database', 'diagnosticRow', 'localWhisperSnapshot', 'providerAudit', 'redactor']
        : ['database', 'diagnosticRow', 'providerAudit', 'redactor'];
  return (
    isRecord(value) &&
    hasExactKeys(value, expectedKeys) &&
    isSafeCount(value.database) &&
    value.database > 0 &&
    value.diagnosticRow === DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION &&
    (schemaVersion !== DIAGNOSTICS_ARCHIVE_LOCAL_WHISPER_SCHEMA_VERSION ||
      value.localWhisperSnapshot === LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION) &&
    (schemaVersion !== DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION ||
      value.nativeRuntime === NATIVE_RUNTIME_DIAGNOSTICS_SCHEMA_VERSION) &&
    isSafeCount(value.providerAudit) &&
    value.providerAudit > 0 &&
    isSafeCount(value.redactor) &&
    value.redactor > 0
  );
}

/** Validates the complete closed schema-v1 diagnostics manifest contract. */
export function isDiagnosticsArchiveManifest(value: unknown): value is DiagnosticsArchiveManifest {
  const hasNativeRuntime = isRecord(value) && value.schemaVersion === DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'appVersion',
      'archiveId',
      'audit',
      'captureSettings',
      'createdAt',
      'diagnostics',
      ...(hasNativeRuntime ? ['nativeRuntime'] : []),
      'members',
      'platform',
      'providers',
      'runtimeVersions',
      'schemaVersion',
      'schemaVersions',
      'sensitivity',
    ]) ||
    !isDiagnosticsArchiveSchemaVersion(value.schemaVersion) ||
    typeof value.archiveId !== 'string' ||
    !CANONICAL_UUID_PATTERN.test(value.archiveId) ||
    !isCanonicalTimestamp(value.createdAt) ||
    !isSafeVersion(value.appVersion) ||
    !isAuditSummary(value.audit) ||
    !isCaptureSettings(value.captureSettings) ||
    !isDiagnosticSummary(value.diagnostics) ||
    (hasNativeRuntime && !isNativeRuntimeSummary(value.nativeRuntime)) ||
    !isMemberInventory(value.members, value.schemaVersion) ||
    !isProvidersManifest(value.providers) ||
    !isSchemaVersions(value.schemaVersions, value.schemaVersion)
  ) {
    return false;
  }

  if (
    !isRecord(value.platform) ||
    !hasExactKeys(value.platform, ['architecture', 'family']) ||
    !isOneOf(DIAGNOSTICS_ARCHIVE_ARCHITECTURES, value.platform.architecture) ||
    !isOneOf(DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES, value.platform.family)
  ) {
    return false;
  }
  if (
    !isRecord(value.runtimeVersions) ||
    !hasExactKeys(value.runtimeVersions, ['cloakBrowser', 'electron', 'node', 'playwright']) ||
    !isSafeVersion(value.runtimeVersions.cloakBrowser) ||
    !isSafeVersion(value.runtimeVersions.electron) ||
    !isSafeVersion(value.runtimeVersions.node) ||
    !isSafeVersion(value.runtimeVersions.playwright)
  ) {
    return false;
  }
  if (
    !isRecord(value.sensitivity) ||
    !hasExactKeys(value.sensitivity, ['containsDiagnosticText', 'warning']) ||
    typeof value.sensitivity.containsDiagnosticText !== 'boolean'
  ) {
    return false;
  }

  const includesDiagnosticRows = value.diagnostics.recordCount > 0;
  const diagnosticMember = value.members.find(
    (member) => member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
  );
  if (
    value.sensitivity.containsDiagnosticText !== includesDiagnosticRows ||
    value.sensitivity.warning !== (includesDiagnosticRows ? DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING : null) ||
    Boolean(diagnosticMember) !== includesDiagnosticRows
  ) {
    return false;
  }
  if (value.schemaVersion === DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION) {
    const nativeRuntime = value.nativeRuntime as DiagnosticsArchiveNativeRuntimeSummary;
    const nativeMember = value.members.find((member) => member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime);
    if (
      !nativeRuntime ||
      Boolean(nativeMember) !== nativeRuntime.includedRecordCount > 0 ||
      (nativeMember !== undefined && nativeMember.byteLength !== nativeRuntime.byteLength)
    ) {
      return false;
    }
  }
  if (
    value.diagnostics.includedCategories.includes('translation') &&
    !value.captureSettings.captureTranslationDiagnostics
  ) {
    return false;
  }
  if (value.diagnostics.includedCategories.includes('prettify') && !value.captureSettings.capturePrettifyDiagnostics) {
    return false;
  }
  return true;
}

export function isDiagnosticArchiveTextActionRow(value: unknown): value is DiagnosticArchiveTextActionRow {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'actionId',
      'actionType',
      'contractVersion',
      'providerId',
      'providerOperationId',
      'recordedAt',
      'redactionCount',
      'redactorVersion',
      'resultBytes',
      'resultText',
      'retainedBytes',
      'schemaVersion',
      'sourceBytes',
      'sourceKind',
      'sourceText',
      'targetLanguage',
    ]) &&
    value.schemaVersion === DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION &&
    typeof value.actionId === 'string' &&
    CANONICAL_UUID_PATTERN.test(value.actionId) &&
    isOneOf(DIAGNOSTIC_CAPTURE_CATEGORIES, value.actionType) &&
    (value.providerOperationId === null ||
      (typeof value.providerOperationId === 'string' && CANONICAL_UUID_PATTERN.test(value.providerOperationId))) &&
    isCanonicalTimestamp(value.recordedAt) &&
    isSafeCount(value.redactionCount) &&
    isSafeCount(value.redactorVersion) &&
    value.redactorVersion > 0 &&
    isSafeCount(value.resultBytes) &&
    typeof value.resultText === 'string' &&
    isSafeCount(value.retainedBytes) &&
    isSafeCount(value.sourceBytes) &&
    (value.sourceKind === 'provider' || value.sourceKind === 'cache') &&
    typeof value.sourceText === 'string' &&
    hasClosedDiagnosticActionMetadata(value)
  );
}

const LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_KEYS = [
  'activityState',
  'artifactCount',
  'backend',
  'capabilityState',
  'capturedAt',
  'deviceDisplayLabel',
  'deviceProductId',
  'deviceVendorId',
  'driverVersionLabel',
  'engineId',
  'failureCode',
  'installedArtifactCount',
  'modelFamily',
  'modelRevision',
  'modelSetupState',
  'modelVariant',
  'operationalStatus',
  'residencyState',
  'runtimeRevision',
  'runtimeSetupState',
  'runtimeVersionLabel',
  'schemaVersion',
  'supportTier',
  'target',
] as const;
// The first character intentionally excludes underscore, unlike `\w`.
// eslint-disable-next-line regexp/prefer-w
const SAFE_LOCAL_WHISPER_VERSION_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,127}$/u;

function isSafeLocalWhisperVersionLabel(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && SAFE_LOCAL_WHISPER_VERSION_LABEL_PATTERN.test(value));
}

function isSafeLocalWhisperDeviceLabel(value: unknown): value is string | null {
  return (
    value === null ||
    (isLocalWhisperRendererSafeLabel(value) &&
      value.length <= 128 &&
      !value.includes('/') &&
      !value.includes('\\') &&
      !value.includes('://'))
  );
}

function isNormalizedHardwareId(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && typeof value === 'number' && value >= 0 && value <= 0xffff);
}

export function isLocalWhisperDiagnosticsSnapshot(value: unknown): value is LocalWhisperDiagnosticsSnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_KEYS) &&
    isOneOf(LOCAL_WHISPER_ACTIVITY_STATES, value.activityState) &&
    isSafeCount(value.artifactCount) &&
    value.artifactCount <= 10_000 &&
    (value.backend === null || isOneOf(LOCAL_WHISPER_BACKENDS, value.backend)) &&
    isOneOf(LOCAL_WHISPER_CAPABILITY_STATES, value.capabilityState) &&
    isCanonicalTimestamp(value.capturedAt) &&
    isSafeLocalWhisperDeviceLabel(value.deviceDisplayLabel) &&
    isNormalizedHardwareId(value.deviceProductId) &&
    isNormalizedHardwareId(value.deviceVendorId) &&
    isSafeLocalWhisperVersionLabel(value.driverVersionLabel) &&
    value.engineId === 'whisperCpp' &&
    (value.failureCode === null || isOneOf(LOCAL_WHISPER_FAILURE_CODES, value.failureCode)) &&
    isSafeCount(value.installedArtifactCount) &&
    value.installedArtifactCount <= value.artifactCount &&
    isOneOf(LOCAL_WHISPER_MODEL_FAMILIES, value.modelFamily) &&
    toLocalWhisperRevisionId(value.modelRevision) !== null &&
    isOneOf(LOCAL_WHISPER_ARTIFACT_SETUP_STATES, value.modelSetupState) &&
    isOneOf(LOCAL_WHISPER_MODEL_VARIANTS, value.modelVariant) &&
    isOneOf(LOCAL_WHISPER_OPERATIONAL_STATUSES, value.operationalStatus) &&
    isOneOf(LOCAL_WHISPER_RESIDENCY_STATES, value.residencyState) &&
    (value.runtimeRevision === null || toLocalWhisperRevisionId(value.runtimeRevision) !== null) &&
    isOneOf(LOCAL_WHISPER_ARTIFACT_SETUP_STATES, value.runtimeSetupState) &&
    isSafeLocalWhisperVersionLabel(value.runtimeVersionLabel) &&
    value.schemaVersion === LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_SCHEMA_VERSION &&
    isOneOf(LOCAL_WHISPER_SUPPORT_TIERS, value.supportTier) &&
    isOneOf(LOCAL_WHISPER_TARGETS, value.target)
  );
}

export function isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(byteLength: number): boolean {
  return (
    Number.isSafeInteger(byteLength) && byteLength >= 0 && byteLength <= LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES
  );
}

/** Parses only exact canonical schema-v1 snapshot bytes; duplicate keys and alternate encodings fail equality. */
export function parseCanonicalLocalWhisperDiagnosticsSnapshot(
  payload: Uint8Array,
): LocalWhisperDiagnosticsSnapshot | null {
  if (!isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(payload.byteLength)) return null;
  try {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    const value: unknown = JSON.parse(source);
    if (!isLocalWhisperDiagnosticsSnapshot(value)) return null;
    return serializeCanonicalDiagnosticsJson(value) === source ? value : null;
  } catch {
    return null;
  }
}

function canonicalizeJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite JSON number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalizeJsonValue);
  if (!isRecord(value)) throw new TypeError('Unsupported JSON value');

  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const candidate = value[key];
    if (candidate === undefined) throw new TypeError('Undefined JSON value');
    canonical[key] = canonicalizeJsonValue(candidate);
  }
  return canonical;
}

export function serializeCanonicalDiagnosticsJson(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(canonicalizeJsonValue(value));
    return serialized.includes('\r') || serialized.includes('\n') ? null : serialized;
  } catch {
    return null;
  }
}
