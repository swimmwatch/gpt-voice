import type { DiagnosticProviderAuditCauseCode } from '../providerAudit/mappings';
import {
  DIAGNOSTIC_ACTION_TYPES,
  DIAGNOSTIC_SOURCE_KINDS,
  type DiagnosticActionType,
  type DiagnosticCaptureProviderId,
  type DiagnosticCaptureRepository,
  type DiagnosticCaptureRow,
  type DiagnosticCaptureRecord,
  type DiagnosticSourceKind,
} from '../repositories/diagnosticCaptureRepository';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '../repositories/repositoryErrors';
import {
  TRANSLATION_PROVIDER_INFO,
  isTranslationProviderId,
  isTranslationTargetLanguage,
} from '@shared/translationProvider';
import { isKnownPrettifyProviderId } from '@shared/prettifySettings';
import type { DiagnosticTextRedactionResult, DiagnosticTextRedactor } from './diagnosticTextRedactor';

export {
  DIAGNOSTIC_ACTION_TYPES,
  DIAGNOSTIC_SOURCE_KINDS,
  type DiagnosticActionType,
  type DiagnosticCaptureProviderId,
  type DiagnosticCaptureRow,
  type DiagnosticSourceKind,
} from '../repositories/diagnosticCaptureRepository';

export const DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES = 1_048_576;
export const DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES = 104_857_600;
export const DIAGNOSTIC_CAPTURE_RETENTION_DAYS = 60;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const DIAGNOSTIC_CAPTURE_RETENTION_MS = DIAGNOSTIC_CAPTURE_RETENTION_DAYS * MILLISECONDS_PER_DAY;
const DIAGNOSTIC_CAPTURE_WARNING_LABEL = 'Diagnostic capture maintenance';
const DIAGNOSTIC_CAPTURE_MAINTENANCE_PHASE = 'maintenance';
const MAX_SAFE_METADATA_LENGTH = 128;
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const DIAGNOSTIC_CAPTURE_CAUSE_CODES = {
  RedactionFailed: 'diagnostic-redaction-failed',
  RowTooLarge: 'diagnostic-row-too-large',
  StorageFailed: 'diagnostic-storage-failed',
  StorageUnavailable: 'diagnostic-storage-unavailable',
} as const satisfies Readonly<Record<string, DiagnosticProviderAuditCauseCode>>;

export interface DiagnosticCaptureInput {
  readonly actionType: DiagnosticActionType;
  readonly contractVersion?: string;
  readonly providerId: DiagnosticCaptureProviderId;
  readonly providerOperationId?: string;
  readonly resultText: string;
  readonly sourceKind: DiagnosticSourceKind;
  readonly sourceText: string;
  readonly targetLanguage?: string;
}

export type DiagnosticCaptureInsertResult =
  | { readonly actionId: string; readonly status: 'success' }
  | {
      readonly causeCode:
        typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.RedactionFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.RowTooLarge;
      readonly status: 'skipped';
    }
  | {
      readonly causeCode:
        typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable;
      readonly status: 'failure';
    };

export type DiagnosticCaptureMaintenanceResult =
  | { readonly affectedRows: number; readonly status: 'success' }
  | {
      readonly causeCode:
        typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable;
      readonly status: 'failure';
    };

export type DiagnosticCaptureReadResult =
  | { readonly rows: readonly DiagnosticCaptureRow[]; readonly status: 'success' }
  | {
      readonly causeCode:
        typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable;
      readonly status: 'failure';
    };

export interface DiagnosticCaptureStorageDependencies {
  readonly logger: {
    warn(...args: unknown[]): void;
  };
  readonly now: () => Date;
  readonly randomUUID: () => string;
  readonly redactor: Pick<DiagnosticTextRedactor, 'redact'>;
}

/** Owns validation, redaction, serialized persistence admission, and shutdown draining. */
export class DiagnosticCaptureStorage {
  private acceptingOperations = true;
  private operationQueue: Promise<void> = Promise.resolve();
  private shutdownPromise: Promise<DiagnosticCaptureMaintenanceResult> | null = null;

  public constructor(
    private readonly repository: DiagnosticCaptureRepository,
    private readonly dependencies: DiagnosticCaptureStorageDependencies,
  ) {}

  public insert(input: DiagnosticCaptureInput): Promise<DiagnosticCaptureInsertResult> {
    return this.enqueue(
      () => this.insertNow(input),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public prune(): Promise<DiagnosticCaptureMaintenanceResult> {
    return this.enqueue(
      () => this.pruneNow(),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public pruneAndPurge(categories: readonly DiagnosticActionType[]): Promise<DiagnosticCaptureMaintenanceResult> {
    return this.enqueue(
      () => this.pruneAndPurgeNow(categories),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public purge(categories: readonly DiagnosticActionType[]): Promise<DiagnosticCaptureMaintenanceResult> {
    return this.enqueue(
      () => this.purgeNow(categories),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public readForArchive(categories: readonly DiagnosticActionType[]): Promise<DiagnosticCaptureReadResult> {
    return this.enqueue(
      () => this.readForArchiveNow(categories),
      this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public readPrunedArchiveSnapshot(categories: readonly DiagnosticActionType[]): Promise<DiagnosticCaptureReadResult> {
    return this.enqueue(
      () => this.readPrunedArchiveSnapshotNow(categories),
      this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable),
      this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed),
    );
  }

  public async pruneOnStartup(): Promise<void> {
    try {
      const result = await this.prune();
      if (result.status === 'failure') this.warnMaintenance(result.causeCode);
    } catch {
      this.warnMaintenance(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
    }
  }

  public shutdown(): Promise<DiagnosticCaptureMaintenanceResult> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.acceptingOperations = false;
    this.shutdownPromise = this.operationQueue.then(() => ({ affectedRows: 0, status: 'success' }) as const);
    return this.shutdownPromise;
  }

  private enqueue<Result>(operation: () => Result, unavailableResult: Result, failedResult: Result): Promise<Result> {
    if (!this.acceptingOperations) return Promise.resolve(unavailableResult);

    const runSafely = (): Result => {
      try {
        return operation();
      } catch {
        return failedResult;
      }
    };
    const result = this.operationQueue.then(runSafely, runSafely);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private insertNow(input: DiagnosticCaptureInput): DiagnosticCaptureInsertResult {
    if (!this.isValidInput(input)) {
      return this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
    }

    let sourceRedaction: DiagnosticTextRedactionResult;
    let resultRedaction: DiagnosticTextRedactionResult;
    try {
      sourceRedaction = this.validateRedactionResult(this.dependencies.redactor.redact(input.sourceText));
      resultRedaction = this.validateRedactionResult(this.dependencies.redactor.redact(input.resultText));
      if (sourceRedaction.redactorVersion !== resultRedaction.redactorVersion) {
        throw new Error('inconsistent-diagnostic-redactor-version');
      }
    } catch {
      return {
        causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.RedactionFailed,
        status: 'skipped',
      };
    }

    let prepared: DiagnosticCaptureRecord | null;
    try {
      prepared = this.prepareCapture(input, sourceRedaction, resultRedaction);
    } catch {
      return this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
    }
    if (!prepared) {
      return {
        causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.RowTooLarge,
        status: 'skipped',
      };
    }

    try {
      this.repository.insert(prepared, {
        capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
        retentionCutoff: this.retentionCutoff(prepared.recordedAt),
      });
      return { actionId: prepared.actionId, status: 'success' };
    } catch (error: unknown) {
      return this.storageFailure(this.storageCause(error));
    }
  }

  private pruneNow(): DiagnosticCaptureMaintenanceResult {
    try {
      const recordedAt = this.getRecordedAt();
      const affectedRows = this.repository.prune({
        capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
        retentionCutoff: this.retentionCutoff(recordedAt),
      });
      return { affectedRows, status: 'success' };
    } catch (error: unknown) {
      return this.storageFailure(this.storageCause(error));
    }
  }

  private pruneAndPurgeNow(categories: readonly DiagnosticActionType[]): DiagnosticCaptureMaintenanceResult {
    const normalizedCategories = this.normalizeCategories(categories);
    if (!normalizedCategories) return this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);

    try {
      const recordedAt = this.getRecordedAt();
      const affectedRows = this.repository.pruneAndPurge(
        {
          capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
          retentionCutoff: this.retentionCutoff(recordedAt),
        },
        normalizedCategories,
      );
      return { affectedRows, status: 'success' };
    } catch (error: unknown) {
      return this.storageFailure(this.storageCause(error));
    }
  }

  private purgeNow(categories: readonly DiagnosticActionType[]): DiagnosticCaptureMaintenanceResult {
    const normalizedCategories = this.normalizeCategories(categories);
    if (!normalizedCategories) return this.storageFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);

    try {
      return {
        affectedRows: this.repository.purge(normalizedCategories),
        status: 'success',
      };
    } catch (error: unknown) {
      return this.storageFailure(this.storageCause(error));
    }
  }

  private readForArchiveNow(categories: readonly DiagnosticActionType[]): DiagnosticCaptureReadResult {
    const normalizedCategories = this.normalizeCategories(categories);
    if (!normalizedCategories) return this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);

    try {
      return {
        rows: this.repository.readForArchive(normalizedCategories),
        status: 'success',
      };
    } catch (error: unknown) {
      return this.readFailure(this.storageCause(error));
    }
  }

  private readPrunedArchiveSnapshotNow(categories: readonly DiagnosticActionType[]): DiagnosticCaptureReadResult {
    const normalizedCategories = this.normalizeCategories(categories);
    if (!normalizedCategories) return this.readFailure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);

    try {
      const recordedAt = this.getRecordedAt();
      this.repository.prune({
        capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
        retentionCutoff: this.retentionCutoff(recordedAt),
      });
      return {
        rows: this.repository.readForArchive(normalizedCategories),
        status: 'success',
      };
    } catch (error: unknown) {
      return this.readFailure(this.storageCause(error));
    }
  }

  private prepareCapture(
    input: DiagnosticCaptureInput,
    source: DiagnosticTextRedactionResult,
    result: DiagnosticTextRedactionResult,
  ): DiagnosticCaptureRecord | null {
    const sourceBytes = Buffer.byteLength(source.text, 'utf8');
    const resultBytes = Buffer.byteLength(result.text, 'utf8');
    const retainedBytes = sourceBytes + resultBytes;
    if (retainedBytes > DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES) return null;

    const actionId = this.dependencies.randomUUID();
    if (!this.isCanonicalUuid(actionId)) throw new Error('invalid-diagnostic-action-id');

    return {
      actionId,
      actionType: input.actionType,
      contractVersion: input.contractVersion ?? null,
      providerId: input.providerId,
      providerOperationId: input.providerOperationId ?? null,
      recordedAt: this.getRecordedAt(),
      redactionCount: source.redactionCount + result.redactionCount,
      redactorVersion: source.redactorVersion,
      resultBytes,
      resultText: result.text,
      retainedBytes,
      sourceBytes,
      sourceKind: input.sourceKind,
      sourceText: source.text,
      targetLanguage: input.targetLanguage ?? null,
    };
  }

  private validateRedactionResult(result: DiagnosticTextRedactionResult): DiagnosticTextRedactionResult {
    if (
      typeof result.text !== 'string' ||
      !Number.isSafeInteger(result.redactionCount) ||
      result.redactionCount < 0 ||
      !Number.isSafeInteger(result.redactorVersion) ||
      result.redactorVersion <= 0
    ) {
      throw new Error('invalid-diagnostic-redaction-result');
    }
    return result;
  }

  private isValidInput(input: DiagnosticCaptureInput): boolean {
    if (!input || typeof input !== 'object') return false;
    if (typeof input.sourceText !== 'string' || typeof input.resultText !== 'string') return false;
    if (!DIAGNOSTIC_SOURCE_KINDS.includes(input.sourceKind)) return false;
    if (!DIAGNOSTIC_ACTION_TYPES.includes(input.actionType)) return false;
    if (input.providerOperationId !== undefined && !this.isCanonicalUuid(input.providerOperationId)) return false;
    if (!this.isSafeOptionalMetadata(input.contractVersion) || !this.isSafeOptionalMetadata(input.targetLanguage)) {
      return false;
    }
    if (input.actionType === 'translation') {
      return (
        isTranslationProviderId(input.providerId) &&
        (input.contractVersion === undefined ||
          input.contractVersion === TRANSLATION_PROVIDER_INFO[input.providerId].contractVersion) &&
        (input.targetLanguage === undefined || isTranslationTargetLanguage(input.providerId, input.targetLanguage))
      );
    }
    return isKnownPrettifyProviderId(input.providerId) && input.targetLanguage === undefined;
  }

  private isSafeOptionalMetadata(value: string | undefined): boolean {
    return (
      value === undefined ||
      (typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_SAFE_METADATA_LENGTH &&
        !value.includes('\r') &&
        !value.includes('\n'))
    );
  }

  private normalizeCategories(categories: readonly DiagnosticActionType[]): DiagnosticActionType[] | null {
    if (!Array.isArray(categories)) return null;
    const normalized: DiagnosticActionType[] = [];
    for (const category of categories as readonly unknown[]) {
      if (!this.isActionType(category)) return null;
      if (!normalized.includes(category)) normalized.push(category);
    }
    return normalized;
  }

  private isActionType(value: unknown): value is DiagnosticActionType {
    return typeof value === 'string' && DIAGNOSTIC_ACTION_TYPES.includes(value as DiagnosticActionType);
  }

  private getRecordedAt(): string {
    const now = this.dependencies.now();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new Error('invalid-diagnostic-clock');
    }
    return now.toISOString();
  }

  private retentionCutoff(recordedAt: string): string {
    const recordedAtMs = Date.parse(recordedAt);
    if (!Number.isFinite(recordedAtMs)) throw new Error('invalid-diagnostic-cutoff');
    return new Date(recordedAtMs - DIAGNOSTIC_CAPTURE_RETENTION_MS).toISOString();
  }

  private isCanonicalUuid(value: unknown): value is string {
    return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value);
  }

  private storageCause(
    error: unknown,
  ): typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable {
    return error instanceof RepositoryError && error.code === REPOSITORY_ERROR_CODES.Unavailable
      ? DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable
      : DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed;
  }

  private storageFailure(
    causeCode:
      typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
  ): Extract<DiagnosticCaptureInsertResult | DiagnosticCaptureMaintenanceResult, { status: 'failure' }> {
    return { causeCode, status: 'failure' };
  }

  private readFailure(
    causeCode:
      typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed | typeof DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
  ): Extract<DiagnosticCaptureReadResult, { status: 'failure' }> {
    return { causeCode, status: 'failure' };
  }

  private warnMaintenance(causeCode: DiagnosticProviderAuditCauseCode): void {
    try {
      this.dependencies.logger.warn(DIAGNOSTIC_CAPTURE_WARNING_LABEL, {
        causeCode,
        phase: DIAGNOSTIC_CAPTURE_MAINTENANCE_PHASE,
      });
    } catch {
      // Startup maintenance diagnostics are fail-open.
    }
  }
}
