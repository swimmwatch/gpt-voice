/* eslint-disable max-classes-per-file -- environment snapshots and manifest assembly own separate allowlists. */
import type { BackgroundBrowserService } from '../browser';
import type { AppConfigStore } from '../config';
import type { DiagnosticCaptureRow } from '../repositories/diagnosticCaptureRepository';
import { DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES } from './diagnosticCaptureStorage';
import { DIAGNOSTIC_REDACTOR_VERSION } from './diagnosticTextRedactor';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_ARCHITECTURES,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING,
  DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS,
  isDiagnosticArchiveTextActionRow,
  isDiagnosticsArchiveEnvironmentSnapshot,
  isDiagnosticsArchiveManifest,
  serializeCanonicalDiagnosticsJson,
  type DiagnosticArchiveTextActionRow,
  type DiagnosticsArchiveArchitecture,
  type DiagnosticsArchiveAuditSummary,
  type DiagnosticsArchiveEnvironmentSnapshot,
  type DiagnosticsArchiveManifest,
  type DiagnosticsArchiveMemberSummary,
  type DiagnosticsArchivePlatformFamily,
  type DiagnosticsArchivePayloadMemberName,
} from '@shared/diagnosticsArchive';
import {
  DIAGNOSTIC_CAPTURE_CATEGORIES,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureSettings,
} from '@shared/diagnosticCaptureSettings';
import { PRETTIFY_PROVIDER_IDS, isKnownPrettifyProviderId } from '@shared/prettifySettings';
import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  isTranslationProviderId,
  isTranslationTargetLanguage,
} from '@shared/translationProvider';

const SAFE_HASH_PATTERN = /^[0-9a-f]{64}$/u;

export interface DiagnosticsRuntimeVersions {
  readonly cloakBrowser: string;
  readonly electron: string;
  readonly node: string;
  readonly playwright: string;
}

export interface DiagnosticsEnvironmentSnapshotProviderDependencies {
  readonly architecture: string;
  readonly backgroundBrowser: Pick<BackgroundBrowserService, 'getStatus'>;
  readonly config: Pick<AppConfigStore, 'getSnapshot'>;
  readonly getAppVersion: () => string;
  readonly platform: NodeJS.Platform;
  readonly runtimeVersions: DiagnosticsRuntimeVersions;
}

/** Builds a strict allowlisted environment view without provider or account probing. */
export class DiagnosticsEnvironmentSnapshotProvider {
  public constructor(private readonly dependencies: DiagnosticsEnvironmentSnapshotProviderDependencies) {}

  public getSnapshot(): DiagnosticsArchiveEnvironmentSnapshot {
    const config = this.dependencies.config.getSnapshot();
    const voiceProviderId = DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS.find((providerId) => providerId === config.provider);
    const prettifyProviderId = isKnownPrettifyProviderId(config.prettifySettings.providerId)
      ? config.prettifySettings.providerId
      : null;
    const translationProviderId = isTranslationProviderId(config.translationSettings.providerId)
      ? config.translationSettings.providerId
      : null;
    const backgroundStatus = this.dependencies.backgroundBrowser.getStatus();
    const snapshot: DiagnosticsArchiveEnvironmentSnapshot = {
      appVersion: this.dependencies.getAppVersion(),
      architecture: this.getArchitecture(),
      cloakBrowserVersion: this.dependencies.runtimeVersions.cloakBrowser,
      electronVersion: this.dependencies.runtimeVersions.electron,
      nodeVersion: this.dependencies.runtimeVersions.node,
      platformFamily: this.getPlatformFamily(),
      playwrightVersion: this.dependencies.runtimeVersions.playwright,
      providers: {
        voice: {
          capabilityAvailable: true,
          configured: voiceProviderId !== undefined,
          readinessKnown: true,
          ready: backgroundStatus.ready && backgroundStatus.providerId === voiceProviderId,
          registeredProviderIds: DIAGNOSTICS_ARCHIVE_VOICE_PROVIDER_IDS,
          selectedProviderId: voiceProviderId ?? null,
        },
        prettify: {
          capabilityAvailable: true,
          configured: prettifyProviderId !== null,
          readinessKnown: false,
          ready: false,
          registeredProviderIds: PRETTIFY_PROVIDER_IDS,
          selectedProviderId: prettifyProviderId,
        },
        translation: {
          capabilityAvailable: true,
          configured: translationProviderId !== null,
          readinessKnown: false,
          ready: false,
          registeredProviderIds: TRANSLATION_PROVIDER_IDS,
          selectedProviderId: translationProviderId,
        },
      },
    };
    if (!isDiagnosticsArchiveEnvironmentSnapshot(snapshot)) {
      throw new TypeError('Invalid diagnostics environment snapshot');
    }
    return Object.freeze(snapshot);
  }

  private getArchitecture(): DiagnosticsArchiveArchitecture {
    const architecture = DIAGNOSTICS_ARCHIVE_ARCHITECTURES.find(
      (candidate) => candidate === this.dependencies.architecture,
    );
    if (!architecture) throw new TypeError('Unsupported diagnostics architecture');
    return architecture;
  }

  private getPlatformFamily(): DiagnosticsArchivePlatformFamily {
    const familyByPlatform: Partial<Record<NodeJS.Platform, DiagnosticsArchivePlatformFamily>> = {
      darwin: 'macos',
      linux: 'linux',
      win32: 'windows',
    };
    const family = familyByPlatform[this.dependencies.platform];
    if (!family || !DIAGNOSTICS_ARCHIVE_PLATFORM_FAMILIES.includes(family)) {
      throw new TypeError('Unsupported diagnostics platform');
    }
    return family;
  }
}

export interface DiagnosticsManifestBuilderDependencies {
  readonly databaseSchemaVersion: number;
  readonly diagnosticRowSchemaVersion: typeof DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION;
  readonly hash: (payload: Buffer) => string;
  readonly providerAuditSchemaVersion: number;
  readonly redactorVersion: number;
}

export interface DiagnosticsManifestBuildInput {
  readonly archiveId: string;
  readonly audit: DiagnosticsArchiveAuditSummary;
  readonly captureSettings: DiagnosticCaptureSettings;
  readonly createdAt: string;
  readonly diagnosticRows: readonly DiagnosticArchiveTextActionRow[];
  readonly environment: DiagnosticsArchiveEnvironmentSnapshot;
  readonly payloads: ReadonlyMap<DiagnosticsArchivePayloadMemberName, Buffer>;
}

/** Owns schema-v1 manifest summaries, hashes, and canonical serialization. */
export class DiagnosticsManifestBuilder {
  public constructor(private readonly dependencies: DiagnosticsManifestBuilderDependencies) {}

  public build(input: DiagnosticsManifestBuildInput): DiagnosticsArchiveManifest {
    const diagnostics = this.summarizeDiagnostics(input.diagnosticRows);
    const members = this.summarizeMembers(input.payloads);
    const containsDiagnosticText = diagnostics.recordCount > 0;
    const manifest: DiagnosticsArchiveManifest = {
      appVersion: input.environment.appVersion,
      archiveId: input.archiveId,
      audit: input.audit,
      captureSettings: input.captureSettings,
      createdAt: input.createdAt,
      diagnostics,
      members,
      platform: {
        architecture: input.environment.architecture,
        family: input.environment.platformFamily,
      },
      providers: input.environment.providers,
      runtimeVersions: {
        cloakBrowser: input.environment.cloakBrowserVersion,
        electron: input.environment.electronVersion,
        node: input.environment.nodeVersion,
        playwright: input.environment.playwrightVersion,
      },
      schemaVersion: DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
      schemaVersions: {
        database: this.dependencies.databaseSchemaVersion,
        diagnosticRow: this.dependencies.diagnosticRowSchemaVersion,
        providerAudit: this.dependencies.providerAuditSchemaVersion,
        redactor: this.dependencies.redactorVersion,
      },
      sensitivity: {
        containsDiagnosticText,
        warning: containsDiagnosticText ? DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING : null,
      },
    };
    if (!isDiagnosticsArchiveManifest(manifest)) throw new TypeError('Invalid diagnostics manifest');
    return Object.freeze(manifest);
  }

  public serialize(manifest: DiagnosticsArchiveManifest): Buffer {
    if (!isDiagnosticsArchiveManifest(manifest)) throw new TypeError('Invalid diagnostics manifest');
    const serialized = serializeCanonicalDiagnosticsJson(manifest);
    if (!serialized) throw new TypeError('Diagnostics manifest serialization failed');
    return Buffer.from(serialized, 'utf8');
  }

  private summarizeDiagnostics(
    rows: readonly DiagnosticArchiveTextActionRow[],
  ): DiagnosticsArchiveManifest['diagnostics'] {
    if (rows.length === 0) {
      return {
        includedCategories: [],
        recordCount: 0,
        recordedAtRange: null,
        retainedBytes: 0,
      };
    }
    const includedCategories = DIAGNOSTIC_CAPTURE_CATEGORIES.filter((category) =>
      rows.some((row) => row.actionType === category),
    );
    return {
      includedCategories,
      recordCount: rows.length,
      recordedAtRange: {
        from: rows[0].recordedAt,
        to: rows[rows.length - 1].recordedAt,
      },
      retainedBytes: rows.reduce((total, row) => total + row.retainedBytes, 0),
    };
  }

  private summarizeMembers(
    payloads: ReadonlyMap<DiagnosticsArchivePayloadMemberName, Buffer>,
  ): readonly DiagnosticsArchiveMemberSummary[] {
    const memberNames: DiagnosticsArchivePayloadMemberName[] = [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents];
    if (payloads.has(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions)) {
      memberNames.push(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions);
    }
    return Object.freeze(
      memberNames.map((name) => {
        const payload = payloads.get(name);
        if (!payload) throw new TypeError('Missing diagnostics payload');
        const sha256 = this.dependencies.hash(payload);
        if (!SAFE_HASH_PATTERN.test(sha256)) throw new TypeError('Invalid diagnostics payload hash');
        return Object.freeze({
          byteLength: payload.byteLength,
          name,
          sha256,
        });
      }),
    );
  }
}

export function createDiagnosticArchiveRow(row: DiagnosticCaptureRow): DiagnosticArchiveTextActionRow | null {
  const sourceBytes = Buffer.byteLength(row.sourceText, 'utf8');
  const resultBytes = Buffer.byteLength(row.resultText, 'utf8');
  const retainedBytes = sourceBytes + resultBytes;
  if (
    row.sourceBytes !== sourceBytes ||
    row.resultBytes !== resultBytes ||
    row.retainedBytes !== retainedBytes ||
    retainedBytes > DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES ||
    row.redactorVersion !== DIAGNOSTIC_REDACTOR_VERSION ||
    (row.sourceKind === 'provider') !== (row.providerOperationId !== null)
  ) {
    return null;
  }
  if (
    row.actionType === 'translation' &&
    (!isTranslationProviderId(row.providerId) ||
      row.contractVersion !== TRANSLATION_PROVIDER_INFO[row.providerId].contractVersion ||
      row.targetLanguage === null ||
      !isTranslationTargetLanguage(row.providerId, row.targetLanguage))
  ) {
    return null;
  }

  const candidate: DiagnosticArchiveTextActionRow = {
    actionId: row.actionId,
    actionType: row.actionType,
    contractVersion: row.contractVersion,
    providerId: row.providerId,
    providerOperationId: row.providerOperationId,
    recordedAt: row.recordedAt,
    redactionCount: row.redactionCount,
    redactorVersion: row.redactorVersion,
    resultBytes: row.resultBytes,
    resultText: row.resultText,
    retainedBytes: row.retainedBytes,
    schemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
    sourceBytes: row.sourceBytes,
    sourceKind: row.sourceKind,
    sourceText: row.sourceText,
    targetLanguage: row.targetLanguage,
  };
  return isDiagnosticArchiveTextActionRow(candidate) ? candidate : null;
}

export function getEnabledDiagnosticCaptureCategories(
  settings: DiagnosticCaptureSettings,
): readonly DiagnosticCaptureCategory[] {
  const categories: DiagnosticCaptureCategory[] = [];
  if (settings.captureTranslationDiagnostics) categories.push('translation');
  if (settings.capturePrettifyDiagnostics) categories.push('prettify');
  return Object.freeze(categories);
}
