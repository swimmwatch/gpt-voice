import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperArtifactId,
  type LocalWhisperFailureCode,
} from '@shared/localWhisper';

import { ManagedArtifactStoreError } from '../filesystem/ManagedArtifactStoreError';
import { ArtifactCatalogResolver } from './ArtifactCatalogResolver';
import {
  ARTIFACT_MIN_DISK_MARGIN_BYTES,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactDiskSpacePort,
  type ArtifactInventoryPort,
  type ArtifactManagedStorePort,
  type ArtifactSafeLogger,
  type ArtifactTransferJournal,
  type LocalWhisperArtifactDownloadRequest,
  type LocalWhisperArtifactDownloadSpec,
  type LocalWhisperArtifactOperationFailure,
  type LocalWhisperArtifactOperationHandle,
  type LocalWhisperArtifactOperationId,
  type LocalWhisperArtifactOperationResult,
  type LocalWhisperArtifactOperationSuccess,
  type LocalWhisperArtifactRemoveRequest,
} from './ArtifactLifecycleTypes';
import { ArtifactProgressStore } from './ArtifactProgressStore';
import { ArtifactTransferJournalRepository, isStrongArtifactValidator } from './ArtifactTransferJournalRepository';
import { ArtifactTransferQueue } from './ArtifactTransferQueue';
import { CatalogHttpTransport } from './CatalogHttpTransport';
import { StreamingArtifactExtractor } from './StreamingArtifactExtractor';
import { StreamingArtifactVerifier, type StreamingArtifactVerificationInput } from './StreamingArtifactVerifier';

const OPERATION_ID_PATTERN = /^[\w-]{16,128}$/u;
// A crash may safely replay the bounded tail because resume truncates to the authenticated journal offset.
// Avoid one atomic journal rewrite per transport chunk on Windows filesystems.
const TRANSFER_JOURNAL_PROGRESS_INTERVAL_BYTES = 4 * 1024 * 1024;

type DownloadMode = 'download' | 'resume' | 'retry' | 'update';

function errorCode(error: unknown, fallback: LocalWhisperFailureCode): LocalWhisperFailureCode {
  if (error instanceof LocalWhisperArtifactLifecycleError) return error.code;
  if (error instanceof ManagedArtifactStoreError && error.code === 'OPERATION_CONFLICT') return 'OPERATION_CONFLICT';
  return fallback;
}

function safeSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

export interface LocalWhisperArtifactServiceDependencies {
  readonly catalogResolver: ArtifactCatalogResolver;
  readonly clock: ArtifactClock;
  readonly diskSpace: ArtifactDiskSpacePort;
  readonly extractor: StreamingArtifactExtractor;
  readonly generateOperationId: () => LocalWhisperArtifactOperationId;
  readonly inventory: ArtifactInventoryPort;
  readonly journals: ArtifactTransferJournalRepository;
  readonly logger: ArtifactSafeLogger;
  readonly onTransferFailure?: (
    event: Readonly<{
      readonly artifactId: LocalWhisperArtifactId;
      readonly cleanupFailed: boolean;
      readonly primaryCode: LocalWhisperFailureCode;
    }>,
  ) => void;
  readonly progress: ArtifactProgressStore;
  readonly queue: ArtifactTransferQueue;
  readonly store: ArtifactManagedStorePort;
  readonly transport: CatalogHttpTransport;
  readonly verifier: StreamingArtifactVerifier;
}

/** Owns explicit artifact transfer/removal ordering without renderer path or URL authority. */
export class LocalWhisperArtifactService {
  private readonly destructiveArtifacts = new Set<LocalWhisperArtifactId>();

  public constructor(private readonly dependencies: LocalWhisperArtifactServiceDependencies) {}

  public startDownload(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle {
    return this.startTransfer(request, 'download');
  }

  public resume(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle {
    return this.startTransfer(request, 'resume');
  }

  public retry(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle {
    return this.startTransfer(request, 'retry');
  }

  public update(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle {
    return this.startTransfer(request, 'update');
  }

  public cancel(operationId: LocalWhisperArtifactOperationId): boolean {
    return this.dependencies.queue.cancel(operationId);
  }

  public async remove(request: LocalWhisperArtifactRemoveRequest): Promise<LocalWhisperArtifactOperationResult> {
    const operationId = this.operationId();
    let spec: LocalWhisperArtifactDownloadSpec | null = null;
    let removalAttempted = false;
    try {
      this.assertInventoryEpoch(request.expectedInventoryRevision);
      spec = this.dependencies.catalogResolver.resolve(request.artifactId);
      if (this.dependencies.queue.isArtifactBusy(spec.artifactId) || this.destructiveArtifacts.has(spec.artifactId)) {
        throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
      }
      this.destructiveArtifacts.add(spec.artifactId);
      this.publish(operationId, spec, 'remove', 'Deleting', 0, null, true);
      removalAttempted = true;
      await this.dependencies.store.deleteArtifact(spec.descriptor, request.clearance);
      const inventoryRevision = await this.dependencies.inventory.refresh(
        this.dependencies.catalogResolver.getCatalog(),
      );
      this.publish(operationId, spec, 'remove', 'Missing', spec.expectedTransferSizeBytes, null, true);
      this.dependencies.logger.info('local-whisper-artifact-removed', {
        artifactId: spec.artifactId,
        operationId,
      });
      return this.success(operationId, spec.artifactId, 'Missing', inventoryRevision);
    } catch (error) {
      const code = errorCode(error, 'DELETE_FAILED');
      if (removalAttempted && spec) {
        const removalSpec = spec;
        await this.dependencies.inventory.refresh(this.dependencies.catalogResolver.getCatalog()).catch(() => {
          this.dependencies.logger.warn('local-whisper-artifact-removal-refresh-failed', {
            artifactId: removalSpec.artifactId,
            operationId,
          });
        });
      }
      const failure = this.failure(operationId, request.artifactId, code, 'Failed');
      this.publishFailure(operationId, request.artifactId, 'remove', code, 'Failed');
      return failure;
    } finally {
      this.destructiveArtifacts.delete(request.artifactId);
    }
  }

  public async listSafeJournals(): Promise<readonly ArtifactTransferJournal[]> {
    return await this.dependencies.journals.listSafe();
  }

  private startTransfer(
    request: LocalWhisperArtifactDownloadRequest,
    mode: DownloadMode,
  ): LocalWhisperArtifactOperationHandle {
    const operationId = this.operationId();
    let spec: LocalWhisperArtifactDownloadSpec;
    try {
      this.assertInventoryEpoch(request.expectedInventoryRevision);
      spec = this.dependencies.catalogResolver.resolve(request.artifactId);
      if (this.destructiveArtifacts.has(spec.artifactId)) {
        throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
      }
    } catch (error) {
      const code = errorCode(error, 'INVALID_SETTINGS');
      this.publishFailure(operationId, request.artifactId, mode, code, 'Failed');
      return Object.freeze({
        operationId,
        completion: Promise.resolve(this.failure(operationId, request.artifactId, code, 'Failed')),
      });
    }
    try {
      const completion = this.dependencies.queue.enqueue({
        operationId,
        artifactId: spec.artifactId,
        run: async (signal) => await this.runTransfer(spec, operationId, mode, signal),
        cancelledBeforeStart: () => {
          this.publishFailure(operationId, spec.artifactId, mode, 'DOWNLOAD_CANCELLED', 'Cancelled');
          return this.failure(operationId, spec.artifactId, 'DOWNLOAD_CANCELLED', 'Cancelled');
        },
        onQueued: (position) => this.publish(operationId, spec, mode, 'Queued', 0, position, true),
        onStarted: () => this.publish(operationId, spec, mode, 'Downloading', 0, null, true),
      });
      return Object.freeze({ operationId, completion });
    } catch (error) {
      const code = errorCode(error, 'OPERATION_CONFLICT');
      this.publishFailure(operationId, spec.artifactId, mode, code, 'Failed');
      return Object.freeze({
        operationId,
        completion: Promise.resolve(this.failure(operationId, spec.artifactId, code, 'Failed')),
      });
    }
  }

  /** Runs one admitted immutable transfer through verification and promotion. */
  private async runTransfer(
    spec: LocalWhisperArtifactDownloadSpec,
    operationId: LocalWhisperArtifactOperationId,
    mode: DownloadMode,
    signal: AbortSignal,
  ): Promise<LocalWhisperArtifactOperationResult> {
    let journal: ArtifactTransferJournal | null = null;
    let resume: { readonly offset: number; readonly spoolId: string; readonly validator: string } | null = null;
    let latestReceivedBytes = 0;
    let transport: Awaited<ReturnType<CatalogHttpTransport['open']>> | null = null;
    try {
      const classification = await this.dependencies.journals.classifyResume(spec);
      if (mode === 'resume') {
        if (classification.kind !== 'resumable') throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
        journal = classification.journal;
        resume = {
          offset: journal.receivedLength,
          spoolId: journal.spoolId,
          validator: journal.serverValidator as string,
        };
        journal = await this.dependencies.journals.update(journal, {
          operationId,
          receivedLength: journal.receivedLength,
          serverValidator: journal.serverValidator,
          state: 'Downloading',
          updatedAtMs: this.dependencies.clock.now(),
        });
      } else {
        if (classification.kind === 'invalid' && !classification.safelyRemovable) {
          throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
        }
        if ((mode === 'download' || mode === 'update') && classification.kind !== 'missing') {
          throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
        }
        if (mode === 'retry' && classification.kind !== 'missing') {
          await this.discardClassification(classification);
        }
        journal = await this.dependencies.journals.create(spec, operationId, this.dependencies.clock.now());
      }
      await this.preflightDisk(spec, resume?.offset ?? 0);
      transport = await this.dependencies.transport.open(
        spec,
        resume ? { offset: resume.offset, validator: resume.validator } : null,
        signal,
      );
      journal = await this.dependencies.journals.update(journal, {
        receivedLength: resume?.offset ?? 0,
        serverValidator: isStrongArtifactValidator(transport.validator) ? transport.validator : null,
        state: 'Downloading',
        updatedAtMs: this.dependencies.clock.now(),
      });
      const verification: StreamingArtifactVerificationInput = {
        operationId,
        spec,
        transport,
        resume: resume ? { offset: resume.offset, spoolId: resume.spoolId } : null,
        signal,
        onProgress: async (receivedBytes) => {
          if (!journal) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
          latestReceivedBytes = receivedBytes;
          if (receivedBytes - journal.receivedLength >= TRANSFER_JOURNAL_PROGRESS_INTERVAL_BYTES) {
            journal = await this.dependencies.journals.update(journal, {
              receivedLength: receivedBytes,
              serverValidator: journal.serverValidator,
              state: 'Downloading',
              updatedAtMs: this.dependencies.clock.now(),
            });
          }
          this.publish(operationId, spec, mode, 'Downloading', receivedBytes, null, false);
        },
      };
      const processed = await (spec.transferProfile === 'pinned-raw-model-v1'
        ? this.dependencies.verifier.verifyMetadataOnlyModel(verification)
        : this.dependencies.verifier.verify(verification));
      if (processed.spoolId !== journal.spoolId) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      this.publish(operationId, spec, mode, 'Verifying', processed.receivedBytes, null, true);
      this.publish(operationId, spec, mode, 'Installing', processed.receivedBytes, null, true);
      await this.dependencies.extractor.install(spec, processed.entries, signal);
      await this.dependencies.journals.remove(spec.artifactId);
      await this.dependencies.verifier.discard(processed.spoolId);
      const inventoryRevision = await this.dependencies.inventory.refresh(
        this.dependencies.catalogResolver.getCatalog(),
      );
      this.publish(operationId, spec, mode, 'Installed', processed.receivedBytes, null, true);
      this.dependencies.logger.info('local-whisper-artifact-installed', {
        artifactId: spec.artifactId,
        bytes: processed.receivedBytes,
        operationId,
      });
      return this.success(operationId, spec.artifactId, 'Installed', inventoryRevision);
    } catch (error) {
      if (journal && latestReceivedBytes > journal.receivedLength) {
        try {
          journal = await this.dependencies.journals.update(journal, {
            receivedLength: latestReceivedBytes,
            serverValidator: journal.serverValidator,
            state: 'Downloading',
            updatedAtMs: this.dependencies.clock.now(),
          });
        } catch {
          // The prior durable offset is still safe: resume will truncate and replay only its bounded tail.
        }
      }
      const code = errorCode(error, 'DOWNLOAD_FAILED');
      return await this.finishFailedTransfer(spec, operationId, mode, journal, code);
    } finally {
      if (transport) {
        await transport.dispose().catch(() => {
          this.dependencies.logger.warn('local-whisper-artifact-transport-cleanup-failed', {
            artifactId: spec.artifactId,
            operationId,
          });
        });
      }
    }
  }

  private async finishFailedTransfer(
    spec: LocalWhisperArtifactDownloadSpec,
    operationId: LocalWhisperArtifactOperationId,
    mode: DownloadMode,
    journal: ArtifactTransferJournal | null,
    code: LocalWhisperFailureCode,
  ): Promise<LocalWhisperArtifactOperationFailure> {
    const resumable =
      journal !== null &&
      code !== 'DOWNLOAD_CANCELLED' &&
      (code === 'DOWNLOAD_FAILED' || code === 'DOWNLOAD_OFFLINE' || code === 'OPERATION_TIMEOUT') &&
      journal.receivedLength > 0 &&
      journal.receivedLength < journal.expectedLength &&
      isStrongArtifactValidator(journal.serverValidator);
    if (resumable && journal) {
      await this.dependencies.journals.update(journal, {
        receivedLength: journal.receivedLength,
        serverValidator: journal.serverValidator,
        state: 'Resumable',
        updatedAtMs: this.dependencies.clock.now(),
      });
      this.publishFailure(operationId, spec.artifactId, mode, code, 'Resumable', journal.receivedLength, spec);
      return this.failure(operationId, spec.artifactId, code, 'Resumable');
    }
    let finalCode = code;
    if (journal) {
      try {
        await this.dependencies.verifier.discard(journal.spoolId);
        await this.dependencies.journals.remove(spec.artifactId);
      } catch {
        finalCode = 'CLEANUP_FAILED';
      }
    }
    this.dependencies.onTransferFailure?.(
      Object.freeze({ artifactId: spec.artifactId, cleanupFailed: finalCode === 'CLEANUP_FAILED', primaryCode: code }),
    );
    const state = finalCode === 'DOWNLOAD_CANCELLED' ? 'Cancelled' : 'Failed';
    this.publishFailure(operationId, spec.artifactId, mode, finalCode, state, journal?.receivedLength ?? 0, spec);
    this.dependencies.logger.warn('local-whisper-artifact-transfer-failed', {
      artifactId: spec.artifactId,
      code: finalCode,
      operationId,
    });
    return this.failure(operationId, spec.artifactId, finalCode, state);
  }

  private async discardClassification(
    classification: Exclude<
      Awaited<ReturnType<ArtifactTransferJournalRepository['classifyResume']>>,
      { kind: 'missing' }
    >,
  ): Promise<void> {
    if (classification.kind === 'invalid' && !classification.safelyRemovable) {
      throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
    }
    const journal = classification.journal;
    await this.dependencies.verifier.discard(journal.spoolId);
    await this.dependencies.journals.remove(journal.artifactId);
  }

  private async preflightDisk(spec: LocalWhisperArtifactDownloadSpec, receivedBytes: number): Promise<void> {
    const remaining = spec.expectedTransferSizeBytes - receivedBytes;
    const retained = await this.dependencies.diskSpace.getRetainedInstalledBytes(spec.descriptor);
    const proportionalMargin = Math.ceil(spec.expandedSizeBytes * 0.1);
    const required = safeSum([
      remaining,
      spec.expandedSizeBytes,
      retained,
      Math.max(proportionalMargin, ARTIFACT_MIN_DISK_MARGIN_BYTES),
    ]);
    const free = await this.dependencies.diskSpace.getFreeBytes();
    if (required === null || !Number.isSafeInteger(free) || free < 0 || free < required) {
      throw new LocalWhisperArtifactLifecycleError('INSUFFICIENT_DISK');
    }
  }

  private assertInventoryEpoch(expected: number): void {
    if (!Number.isSafeInteger(expected) || expected <= 0 || expected !== this.dependencies.inventory.getRevision()) {
      throw new LocalWhisperArtifactLifecycleError('STALE_CONFIGURATION');
    }
  }

  private operationId(): LocalWhisperArtifactOperationId {
    const operationId = this.dependencies.generateOperationId();
    if (!OPERATION_ID_PATTERN.test(operationId)) throw new LocalWhisperArtifactLifecycleError('INVALID_SETTINGS');
    return operationId;
  }

  private publish(
    operationId: LocalWhisperArtifactOperationId,
    spec: LocalWhisperArtifactDownloadSpec,
    action: DownloadMode | 'remove',
    state: Parameters<ArtifactProgressStore['publish']>[0]['state'],
    receivedBytes: number,
    queuedPosition: number | null,
    force: boolean,
  ): void {
    this.dependencies.progress.publish(
      {
        operationId,
        artifactId: spec.artifactId,
        action,
        state,
        receivedBytes,
        totalBytes: spec.expectedTransferSizeBytes,
        queuedPosition,
      },
      force,
    );
  }

  private publishFailure(
    operationId: LocalWhisperArtifactOperationId,
    artifactId: LocalWhisperArtifactId,
    action: DownloadMode | 'remove',
    code: LocalWhisperFailureCode,
    state: 'Cancelled' | 'Failed' | 'Resumable',
    receivedBytes = 0,
    spec?: LocalWhisperArtifactDownloadSpec,
  ): void {
    this.dependencies.progress.publish(
      {
        operationId,
        artifactId,
        action,
        state,
        receivedBytes,
        totalBytes: spec?.expectedTransferSizeBytes ?? Math.max(receivedBytes, 1),
        failure: createLocalWhisperRendererSafeFailure(code, { artifactId }),
      },
      true,
    );
  }

  private failure(
    operationId: LocalWhisperArtifactOperationId,
    artifactId: LocalWhisperArtifactId,
    code: LocalWhisperFailureCode,
    state: 'Cancelled' | 'Failed' | 'Resumable',
  ): LocalWhisperArtifactOperationFailure {
    return Object.freeze({
      success: false,
      operationId,
      artifactId,
      state,
      error: createLocalWhisperRendererSafeFailure(code, { artifactId }),
    });
  }

  private success(
    operationId: LocalWhisperArtifactOperationId,
    artifactId: LocalWhisperArtifactId,
    state: 'Installed' | 'Missing',
    inventoryRevision: number,
  ): LocalWhisperArtifactOperationSuccess {
    return Object.freeze({ success: true, operationId, artifactId, state, inventoryRevision });
  }
}
