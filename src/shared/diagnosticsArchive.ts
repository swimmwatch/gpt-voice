import {
  DIAGNOSTIC_CAPTURE_CATEGORIES,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureSettings,
} from './diagnosticCaptureSettings';
import { PRETTIFY_PROVIDER_IDS, type KnownPrettifyProviderId } from './prettifySettings';
import { TRANSLATION_PROVIDER_IDS, type TranslationProviderId } from './translationProvider';

export const DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION = 1 as const;
export const DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION = 1 as const;

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
  Manifest: 'manifest.json',
} as const);

export const DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES = [
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
] as const;

export const DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS = ['chatgpt', 'openai-api', 'claude-web'] as const;
export const DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING =
  'Diagnostic text may contain private or unrecognized secret data; treat this archive as sensitive.' as const;

export const DIAGNOSTICS_ARCHIVE_LIMITS = Object.freeze({
  MaxJsonlLineBytes: 8 * 1024 * 1024,
  MaxMemberBytes: 128 * 1024 * 1024,
  MaxRecordsPerJsonlMember: 1_000_000,
  MaxTotalUncompressedBytes: 256 * 1024 * 1024,
} as const);

export type DiagnosticsArchiveFormat = (typeof DIAGNOSTICS_ARCHIVE_FORMATS)[number];
export type DiagnosticsArchivePlatformFamily = (typeof DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES)[number];
export type DiagnosticsArchiveArchitecture = (typeof DIAGNOSTICS_ARCHIVE_ARCHITECTURES)[number];
export type DiagnosticsArchiveVoiceProviderId = (typeof DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS)[number];
export type DiagnosticsArchivePayloadMemberName = (typeof DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES)[number];

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

export interface DiagnosticsArchiveMemberSummary {
  readonly byteLength: number;
  readonly name: DiagnosticsArchivePayloadMemberName;
  readonly sha256: string;
}

export interface DiagnosticsArchiveManifest {
  readonly appVersion: string;
  readonly archiveId: string;
  readonly audit: DiagnosticsArchiveAuditSummary;
  readonly captureSettings: DiagnosticCaptureSettings;
  readonly createdAt: string;
  readonly diagnostics: DiagnosticsArchiveDiagnosticSummary;
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
  readonly schemaVersion: typeof DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION;
  readonly schemaVersions: {
    readonly database: number;
    readonly diagnosticRow: typeof DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION;
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

function isMemberSummary(value: unknown): value is DiagnosticsArchiveMemberSummary {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['byteLength', 'name', 'sha256']) &&
    isSafeCount(value.byteLength) &&
    value.byteLength <= DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes &&
    isOneOf(DIAGNOSTICS_ARCHIVE_PAYLOAD_MEMBER_NAMES, value.name) &&
    typeof value.sha256 === 'string' &&
    SHA256_PATTERN.test(value.sha256)
  );
}

function isMemberInventory(value: unknown): value is readonly DiagnosticsArchiveMemberSummary[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2 || !value.every(isMemberSummary)) return false;
  if (value[0].name !== DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents) return false;
  if (value.length === 2 && value[1].name !== DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions) return false;
  return new Set(value.map((member) => member.name)).size === value.length;
}

function isSchemaVersions(value: unknown): value is DiagnosticsArchiveManifest['schemaVersions'] {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['database', 'diagnosticRow', 'providerAudit', 'redactor']) &&
    isSafeCount(value.database) &&
    value.database > 0 &&
    value.diagnosticRow === DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION &&
    isSafeCount(value.providerAudit) &&
    value.providerAudit > 0 &&
    isSafeCount(value.redactor) &&
    value.redactor > 0
  );
}

/** Validates the complete closed schema-v1 diagnostics manifest contract. */
export function isDiagnosticsArchiveManifest(value: unknown): value is DiagnosticsArchiveManifest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'appVersion',
      'archiveId',
      'audit',
      'captureSettings',
      'createdAt',
      'diagnostics',
      'members',
      'platform',
      'providers',
      'runtimeVersions',
      'schemaVersion',
      'schemaVersions',
      'sensitivity',
    ]) ||
    value.schemaVersion !== DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION ||
    typeof value.archiveId !== 'string' ||
    !CANONICAL_UUID_PATTERN.test(value.archiveId) ||
    !isCanonicalTimestamp(value.createdAt) ||
    !isSafeVersion(value.appVersion) ||
    !isAuditSummary(value.audit) ||
    !isCaptureSettings(value.captureSettings) ||
    !isDiagnosticSummary(value.diagnostics) ||
    !isMemberInventory(value.members) ||
    !isProvidersManifest(value.providers) ||
    !isSchemaVersions(value.schemaVersions)
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
    (value.contractVersion === null || isSafeVersion(value.contractVersion)) &&
    typeof value.providerId === 'string' &&
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
    (value.targetLanguage === null || isSafeVersion(value.targetLanguage)) &&
    ((value.actionType === 'translation' && isOneOf(TRANSLATION_PROVIDER_IDS, value.providerId)) ||
      (value.actionType === 'prettify' &&
        isOneOf(PRETTIFY_PROVIDER_IDS, value.providerId) &&
        value.targetLanguage === null))
  );
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
