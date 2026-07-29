/* eslint-disable max-classes-per-file -- extraction, serialization, and orchestration own separate archive state. */
import * as path from 'node:path';

import type { MainLogFileAccessor } from '../logger';
import {
  parseCanonicalProviderAuditRecord,
  serializeProviderAuditRecord,
  type ProviderAuditRecord,
} from '../providerAudit';
import type { DiagnosticCaptureStorage } from './diagnosticCaptureStorage';
import { type DiagnosticsArchiveMember, type DiagnosticsArchiveFormatAdapter } from './diagnosticsArchiveFormat';
import {
  type DiagnosticsEnvironmentSnapshotProvider,
  type DiagnosticsManifestBuilder,
  createDiagnosticArchiveRow,
  getEnabledDiagnosticCaptureCategories,
} from './diagnosticsManifest';
import {
  DIAGNOSTICS_ARCHIVE_LIMITS,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  isDiagnosticArchiveTextActionRow,
  serializeCanonicalDiagnosticsJson,
  type DiagnosticArchiveTextActionRow,
  type DiagnosticsArchiveAuditSummary,
  type DiagnosticsArchiveFormat,
  type DiagnosticsArchivePayloadMemberName,
} from '@shared/diagnosticsArchive';
import { isDiagnosticCaptureSettings, type DiagnosticCaptureSettings } from '@shared/diagnosticCaptureSettings';

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
// electron-log lines are bounded by retained 1 MiB files and this anchored pattern has no nested repetition.
const PROVIDER_AUDIT_LOG_LINE_PATTERN =
  // eslint-disable-next-line security/detect-unsafe-regex
  /^\[[^\]\r\n]+\] \[(?:info|warn|error)\] \(provider-audit\) +Provider audit event(?: (?<payload>.*))?$/u;
const PRIVATE_TEMPORARY_FILE_PREFIX = '.gpt-voice-diagnostics-';
const PRIVATE_TEMPORARY_FILE_SUFFIX = '.tmp';
const PRIVATE_TEMPORARY_CLEANUP_ATTEMPTS = 2;

export interface ProviderAuditLogExtraction {
  readonly records: readonly ProviderAuditRecord[];
  readonly summary: DiagnosticsArchiveAuditSummary;
}

/** Extracts only exact, canonical provider-audit records from retained main logs. */
export class ProviderAuditLogExtractor {
  public constructor(private readonly logs: MainLogFileAccessor) {}

  public extract(): ProviderAuditLogExtraction {
    const records: ProviderAuditRecord[] = [];
    const seenRecords = new Set<string>();
    let duplicateRecordCount = 0;
    let invalidRecordCount = 0;

    for (const retainedLog of this.logs.readRetainedLogs()) {
      for (const line of retainedLog.contents.split(/\r?\n/u)) {
        const match = PROVIDER_AUDIT_LOG_LINE_PATTERN.exec(line);
        if (!match) continue;
        const payload = match.groups?.payload;
        const record = payload === undefined ? null : parseCanonicalProviderAuditRecord(payload);
        if (!record) {
          invalidRecordCount += 1;
          continue;
        }

        const deduplicationKey = `${record.operationId}\0${record.sequence}`;
        if (seenRecords.has(deduplicationKey)) {
          duplicateRecordCount += 1;
          continue;
        }
        seenRecords.add(deduplicationKey);
        records.push(record);
      }
    }

    return Object.freeze({
      records: Object.freeze(records),
      summary: Object.freeze({
        duplicateRecordCount,
        invalidRecordCount,
        validRecordCount: records.length,
      }),
    });
  }
}

/** Owns canonical, bounded JSONL serialization for the two approved payload members. */
export class DiagnosticsArchiveJsonlSerializer {
  public serializeAuditEvents(records: readonly ProviderAuditRecord[]): Buffer {
    return this.serialize(records, (record) => serializeProviderAuditRecord(record));
  }

  public serializeDiagnosticRows(rows: readonly DiagnosticArchiveTextActionRow[]): Buffer {
    return this.serialize(rows, (row) => {
      if (!isDiagnosticArchiveTextActionRow(row)) return null;
      return serializeCanonicalDiagnosticsJson(row);
    });
  }

  private serialize<Value>(values: readonly Value[], serializeValue: (value: Value) => string | null): Buffer {
    if (values.length > DIAGNOSTICS_ARCHIVE_LIMITS.MaxRecordsPerJsonlMember) {
      throw new TypeError('Diagnostics JSONL record limit exceeded');
    }

    const lines: Buffer[] = [];
    let memberBytes = 0;
    for (const value of values) {
      const serialized = serializeValue(value);
      if (serialized === null) throw new TypeError('Diagnostics JSONL serialization failed');
      const lineBytes = Buffer.byteLength(serialized, 'utf8');
      if (lineBytes > DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes) {
        throw new TypeError('Diagnostics JSONL line limit exceeded');
      }
      const line = Buffer.from(`${serialized}\n`, 'utf8');
      memberBytes += line.byteLength;
      if (memberBytes > DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes) {
        throw new TypeError('Diagnostics JSONL member limit exceeded');
      }
      lines.push(line);
    }
    return Buffer.concat(lines, memberBytes);
  }
}

export interface DiagnosticsArchiveFileSystem {
  removeFile(filePath: string): Promise<void>;
  rename(sourcePath: string, destinationPath: string): Promise<void>;
}

export interface DiagnosticsArchiveServiceDependencies {
  readonly environment: Pick<DiagnosticsEnvironmentSnapshotProvider, 'getSnapshot'>;
  readonly fileSystem: DiagnosticsArchiveFileSystem;
  readonly formatAdapter: Pick<DiagnosticsArchiveFormatAdapter, 'writeAndVerify'>;
  readonly jsonl: Pick<DiagnosticsArchiveJsonlSerializer, 'serializeAuditEvents' | 'serializeDiagnosticRows'>;
  readonly logs: Pick<ProviderAuditLogExtractor, 'extract'>;
  readonly manifest: Pick<DiagnosticsManifestBuilder, 'build' | 'serialize'>;
  readonly now: () => Date;
  readonly platform: NodeJS.Platform;
  readonly randomUUID: () => string;
  readonly settings: {
    getSettings(): DiagnosticCaptureSettings;
  };
  readonly storage: Pick<DiagnosticCaptureStorage, 'readPrunedArchiveSnapshot'>;
}

export type DiagnosticsArchiveCreationResult = { readonly status: 'success' } | { readonly status: 'failure' };

const ARCHIVE_CREATION_FAILURE = Object.freeze({ status: 'failure' } as const);
const ARCHIVE_CREATION_SUCCESS = Object.freeze({ status: 'success' } as const);

/** Owns safe archive snapshots, private temporary outputs, publication, and shutdown draining. */
export class DiagnosticsArchiveService {
  private acceptingOperations = true;
  private readonly activeOperations = new Set<Promise<DiagnosticsArchiveCreationResult>>();
  private readonly temporaryFiles = new Set<string>();

  public constructor(private readonly dependencies: DiagnosticsArchiveServiceDependencies) {}

  public createArchive(destinationPath: string): Promise<DiagnosticsArchiveCreationResult> {
    if (!this.acceptingOperations) return Promise.resolve(ARCHIVE_CREATION_FAILURE);

    const operation = this.createArchiveNow(destinationPath).catch(() => ARCHIVE_CREATION_FAILURE);
    this.activeOperations.add(operation);
    void operation.finally(() => this.activeOperations.delete(operation));
    return operation;
  }

  public async shutdown(): Promise<void> {
    this.acceptingOperations = false;
    await Promise.all([...this.activeOperations]);
    await Promise.all([...this.temporaryFiles].map((filePath) => this.removeTemporaryFile(filePath)));
  }

  private async createArchiveNow(destinationPath: string): Promise<DiagnosticsArchiveCreationResult> {
    if (!this.isValidDestinationPath(destinationPath)) return ARCHIVE_CREATION_FAILURE;

    const archiveId = this.dependencies.randomUUID();
    const createdAt = this.dependencies.now();
    if (
      !CANONICAL_UUID_PATTERN.test(archiveId) ||
      !(createdAt instanceof Date) ||
      !Number.isFinite(createdAt.getTime())
    ) {
      return ARCHIVE_CREATION_FAILURE;
    }

    const captureSettings = this.dependencies.settings.getSettings();
    if (!isDiagnosticCaptureSettings(captureSettings)) return ARCHIVE_CREATION_FAILURE;
    const categories = getEnabledDiagnosticCaptureCategories(captureSettings);
    const diagnosticSnapshot = await this.dependencies.storage.readPrunedArchiveSnapshot(categories);
    if (diagnosticSnapshot.status === 'failure') return ARCHIVE_CREATION_FAILURE;

    const diagnosticRows: DiagnosticArchiveTextActionRow[] = [];
    for (const row of diagnosticSnapshot.rows) {
      if (!categories.includes(row.actionType)) return ARCHIVE_CREATION_FAILURE;
      const archiveRow = createDiagnosticArchiveRow(row);
      if (!archiveRow) return ARCHIVE_CREATION_FAILURE;
      diagnosticRows.push(archiveRow);
    }

    const auditExtraction = this.dependencies.logs.extract();
    const auditPayload = this.dependencies.jsonl.serializeAuditEvents(auditExtraction.records);
    const payloads = new Map<DiagnosticsArchivePayloadMemberName, Buffer>([
      [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, auditPayload],
    ]);
    if (diagnosticRows.length > 0) {
      payloads.set(
        DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
        this.dependencies.jsonl.serializeDiagnosticRows(diagnosticRows),
      );
    }

    const manifest = this.dependencies.manifest.build({
      archiveId,
      audit: auditExtraction.summary,
      captureSettings,
      createdAt: createdAt.toISOString(),
      diagnosticRows,
      environment: this.dependencies.environment.getSnapshot(),
      payloads,
    });
    const members: DiagnosticsArchiveMember[] = [
      {
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest,
        payload: this.dependencies.manifest.serialize(manifest),
      },
      {
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
        payload: auditPayload,
      },
    ];
    const diagnosticPayload = payloads.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions);
    if (diagnosticPayload) {
      members.push({
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
        payload: diagnosticPayload,
      });
    }

    const temporaryPath = path.join(
      path.dirname(destinationPath),
      `${PRIVATE_TEMPORARY_FILE_PREFIX}${archiveId}${PRIVATE_TEMPORARY_FILE_SUFFIX}`,
    );
    this.temporaryFiles.add(temporaryPath);
    try {
      await this.dependencies.formatAdapter.writeAndVerify(this.getFormat(), temporaryPath, members);
      await this.dependencies.fileSystem.rename(temporaryPath, destinationPath);
      return ARCHIVE_CREATION_SUCCESS;
    } finally {
      await this.removeTemporaryFile(temporaryPath);
    }
  }

  private getFormat(): DiagnosticsArchiveFormat {
    if (this.dependencies.platform === 'win32') return 'zip';
    if (this.dependencies.platform === 'linux' || this.dependencies.platform === 'darwin') return 'tar-gzip';
    throw new TypeError('Unsupported diagnostics archive platform');
  }

  private isValidDestinationPath(destinationPath: string): boolean {
    if (typeof destinationPath !== 'string' || !path.isAbsolute(destinationPath) || destinationPath.includes('\0')) {
      return false;
    }
    const parsed = path.parse(destinationPath);
    return parsed.base.length > 0 && destinationPath !== parsed.root;
  }

  private async removeTemporaryFile(filePath: string): Promise<void> {
    for (let attempt = 0; attempt < PRIVATE_TEMPORARY_CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        await this.dependencies.fileSystem.removeFile(filePath);
        this.temporaryFiles.delete(filePath);
        return;
      } catch {
        // Retry once now; shutdown retries the owned path if both attempts fail.
      }
    }
  }
}
