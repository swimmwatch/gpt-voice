import { createHash } from 'node:crypto';

import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import {
  MAX_GUARD_REQUEST_PAYLOAD_BYTES,
  MAX_GUARD_WRITE_FILE_CHUNK_BYTES,
} from '../filesystem/NativeManagedFilesystemGuardTransport';
import {
  ARTIFACT_MAX_BUFFER_BYTES,
  ARTIFACT_NO_PROGRESS_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactManagedStorePort,
  type ArtifactClock,
  type LocalWhisperArtifactDownloadSpec,
  type StreamingArtifactEntry,
} from './ArtifactLifecycleTypes';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OWNED_RAW_CHUNK_COPIES = 3;
const OWNED_ENCODED_REQUEST_COPIES = 2;

export const ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS = Object.freeze([1, 2, 4, 8] as const);
export type ArtifactInstallationPipelineWindow = (typeof ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS)[number];
export const PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW: ArtifactInstallationPipelineWindow = 1;

export interface ArtifactInstallationPipelineSnapshot {
  readonly inFlightWrites: number;
  readonly ownedBytes: number;
  readonly peakOwnedBytes: number;
}

/** Closed qualification-only milestones; they never contain artifact names, paths, or bytes. */
export const ARTIFACT_INSTALLATION_DIAGNOSTIC_STAGES = [
  'stagingCreationStarted',
  'stagingCreated',
  'stagedFileCreationStarted',
  'stagedFileCreated',
  'writesSettled',
  'fileSealStarted',
  'fileSealed',
  'fileReleased',
  'promotionStarted',
  'promoted',
  'journalRemovalStarted',
  'journalRemoved',
  'spoolDiscardStarted',
  'spoolDiscarded',
  'inventoryRefreshStarted',
  'inventoryRefreshed',
  'installedPublished',
  'operationCompletionObserved',
  'operationCompletionRecorded',
  'operationCompletionAwaited',
  'settingsApplyStarted',
  'settingsApplied',
  'loadRequested',
  'coordinatorPreflightStarted',
  'coordinatorPreflightSetupResolved',
  'coordinatorPreflightCatalogResolved',
  'coordinatorPreflightBackendPrepared',
  'coordinatorPreflightGpuAuthorityAcquired',
  'coordinatorPreflightGpuRegistryDiscovered',
  'coordinatorPreflightGpuResourcesSampled',
  'coordinatorPreflightAvailabilitySampled',
  'coordinatorPreflightFingerprintCreated',
  'coordinatorPreflightCompleted',
  'modelAuthorityStarted',
  'runtimeAuthorityStarted',
  'workerStartRequested',
  'fullLoadSessionCreated',
  'fullLoadHandshakeStarted',
  'fullLoadHandshakeCompleted',
  'fullLoadRequestStarted',
  'fullLoadRequestCompleted',
  'supervisorLaunchReturned',
  'supervisorTransportBound',
  'supervisorHelloSendStarted',
  'supervisorHelloSent',
  'supervisorHandshakeReceived',
  'supervisorHandshakeTimedOut',
  'supervisorCleanupStarted',
  'supervisorTerminationRequested',
  'supervisorForceTerminationRequested',
  'supervisorCleanupCompleted',
  'supervisorCleanupFailed',
  'nativeDiagnosticsFlushStarted',
  'nativeDiagnosticsFlushCompleted',
  'nativeDiagnosticsFlushTimedOut',
  'sessionProcessLaunched',
  'nativeModelGuardEntered',
  'nativeLauncherExecRequested',
  'nativeLauncherEntered',
  'nativeLauncherWorkerVerified',
  'nativeLauncherWorkerCreated',
  'nativeLauncherAcknowledged',
  'nativeWorkerChildStarted',
  'nativeWorkerExecRequested',
  'nativeWorkerEntered',
  'nativeWorkerProcessStarted',
  'nativeWorkerProcessReady',
  'nativeWorkerModelLoadStarted',
  'nativeWorkerModelLoadFailed',
  'nativeWorkerFailure',
  'nativeLaunchReady',
  'nativeLaunchRejected',
  'nativeLaunchClosed',
  'nativeLaunchMalformed',
  'nativeLaunchError',
  'nativeLaunchExited',
  'nativeLaunchTimeout',
  'warmupStarted',
  'authorityRevalidationStarted',
] as const;

export type ArtifactInstallationDiagnosticStage = (typeof ARTIFACT_INSTALLATION_DIAGNOSTIC_STAGES)[number];

export interface StreamingArtifactExtractorDependencies {
  readonly clock: ArtifactClock;
  readonly maximumInFlightWrites: ArtifactInstallationPipelineWindow;
  /** Present only in the isolated qualification composition; observer failures are ignored. */
  readonly onInstallationStage?: (stage: ArtifactInstallationDiagnosticStage) => void;
  readonly observePipeline: ((snapshot: ArtifactInstallationPipelineSnapshot) => void) | null;
  readonly store: ArtifactManagedStorePort;
}

function isPipelineWindow(value: number): value is ArtifactInstallationPipelineWindow {
  return ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS.some((candidate) => candidate === value);
}

function ownedWriteBytes(chunkBytes: number): number {
  const ownedBytes =
    chunkBytes * OWNED_RAW_CHUNK_COPIES + MAX_GUARD_REQUEST_PAYLOAD_BYTES * OWNED_ENCODED_REQUEST_COPIES;
  if (!Number.isSafeInteger(ownedBytes) || ownedBytes > ARTIFACT_MAX_BUFFER_BYTES) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return ownedBytes;
}

class BoundedArtifactWritePipeline {
  private readonly controller = new AbortController();
  private readonly forwardAbort = (): void => this.controller.abort();
  private readonly pending = new Set<Promise<void>>();
  private ownedBytes = 0;
  private peakOwnedBytes = 0;
  private terminalError: unknown = null;

  public constructor(
    private readonly dependencies: StreamingArtifactExtractorDependencies,
    private readonly signal: AbortSignal,
  ) {
    if (!isPipelineWindow(dependencies.maximumInFlightWrites)) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    signal.addEventListener('abort', this.forwardAbort, { once: true });
    if (signal.aborted) this.controller.abort();
  }

  public async enqueue(fileLease: ManagedArtifactLease, chunk: Uint8Array): Promise<void> {
    const writeOwnedBytes = ownedWriteBytes(chunk.byteLength);
    await this.waitForCapacity(writeOwnedBytes);
    this.throwIfUnavailable();

    const timeout = this.dependencies.clock.setTimeout(() => {
      this.terminalError ??= new LocalWhisperArtifactLifecycleError('OPERATION_TIMEOUT');
      this.controller.abort();
    }, ARTIFACT_NO_PROGRESS_TIMEOUT_MS);
    const tracked = this.dependencies.store
      .appendStagedFile(fileLease, chunk, this.controller.signal)
      .then(
        () => undefined,
        (error: unknown) => {
          this.terminalError ??= error;
        },
      )
      .finally(() => {
        this.dependencies.clock.clearTimeout(timeout);
        this.pending.delete(tracked);
        this.ownedBytes -= writeOwnedBytes;
        this.observe();
      });
    this.pending.add(tracked);
    this.ownedBytes += writeOwnedBytes;
    this.peakOwnedBytes = Math.max(this.peakOwnedBytes, this.ownedBytes);
    this.observe();
  }

  public async finish(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.race(this.pending);
      this.throwIfUnavailable();
    }
    this.throwIfUnavailable();
  }

  public async settle(): Promise<void> {
    await Promise.all(this.pending);
  }

  public dispose(): void {
    this.signal.removeEventListener('abort', this.forwardAbort);
  }

  private async waitForCapacity(nextOwnedBytes: number): Promise<void> {
    while (
      this.pending.size >= this.dependencies.maximumInFlightWrites ||
      this.ownedBytes + nextOwnedBytes > ARTIFACT_MAX_BUFFER_BYTES
    ) {
      if (this.pending.size === 0) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      await Promise.race(this.pending);
      this.throwIfUnavailable();
    }
  }

  private throwIfUnavailable(): void {
    if (this.signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
    if (this.terminalError instanceof Error) throw this.terminalError;
    if (this.terminalError !== null) throw new LocalWhisperArtifactLifecycleError('INSTALL_FAILED');
  }

  private observe(): void {
    this.dependencies.observePipeline?.(
      Object.freeze({
        inFlightWrites: this.pending.size,
        ownedBytes: this.ownedBytes,
        peakOwnedBytes: this.peakOwnedBytes,
      }),
    );
  }
}

function isUnsafeName(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > 128 ||
    value.startsWith('/') ||
    /^[A-Za-z]:/u.test(value) ||
    value.includes('\\') ||
    value.includes('/') ||
    value.includes('\0') ||
    value === '.' ||
    value === '..' ||
    value.split('/').some((segment) => segment === '..')
  );
}

function validateEntries(
  spec: LocalWhisperArtifactDownloadSpec,
  entries: readonly StreamingArtifactEntry[],
): ReadonlyMap<LocalWhisperArtifactId, StreamingArtifactEntry> {
  const metadataOnlyModel = spec.transferProfile === 'pinned-raw-model-v1';
  if (entries.length !== spec.expectedFiles.length) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  const byName = new Map<string, StreamingArtifactEntry>();
  const caseFolded = new Set<string>();
  for (const entry of entries) {
    const folded = entry.name.toLocaleLowerCase('en-US');
    if (
      isUnsafeName(entry.name) ||
      entry.type !== 'regular' ||
      byName.has(entry.name) ||
      caseFolded.has(folded) ||
      !Number.isSafeInteger(entry.sizeBytes) ||
      entry.sizeBytes < 0 ||
      !Number.isSafeInteger(entry.mode) ||
      entry.mode < 0 ||
      entry.mode > 0o777 ||
      (metadataOnlyModel
        ? entry.sha256 !== null
        : typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256))
    ) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    byName.set(entry.name, entry);
    caseFolded.add(folded);
  }
  const mapped = new Map<LocalWhisperArtifactId, StreamingArtifactEntry>();
  let expandedBytes = 0;
  for (const expected of spec.expectedFiles) {
    const entry = byName.get(expected.fileId);
    if (
      !entry ||
      entry.mode !== expected.mode ||
      entry.sizeBytes !== expected.sizeBytes ||
      (metadataOnlyModel ? entry.sha256 !== null : entry.sha256 !== expected.sha256)
    ) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    expandedBytes += entry.sizeBytes;
    if (!Number.isSafeInteger(expandedBytes)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    mapped.set(expected.fileId, entry);
  }
  if (byName.size !== mapped.size || expandedBytes !== spec.expandedSizeBytes) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return mapped;
}

/** Materializes authenticated entries through one bounded, source-ordered installation pipeline. */
export class StreamingArtifactExtractor {
  private installing = false;

  public constructor(private readonly dependencies: StreamingArtifactExtractorDependencies) {
    if (!isPipelineWindow(dependencies.maximumInFlightWrites)) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
  }

  public async install(
    spec: LocalWhisperArtifactDownloadSpec,
    entries: readonly StreamingArtifactEntry[],
    signal: AbortSignal,
  ): Promise<void> {
    if (this.installing) throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
    this.installing = true;
    try {
      await this.installExclusive(spec, entries, signal);
    } finally {
      this.installing = false;
    }
  }

  private async installExclusive(
    spec: LocalWhisperArtifactDownloadSpec,
    entries: readonly StreamingArtifactEntry[],
    signal: AbortSignal,
  ): Promise<void> {
    const validated = validateEntries(spec, entries);
    const metadataOnlyModel = spec.transferProfile === 'pinned-raw-model-v1';
    const pipeline = new BoundedArtifactWritePipeline(this.dependencies, signal);
    let staging: ManagedArtifactLease | null = null;
    let promoted = false;
    try {
      if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      this.observeInstallationStage('stagingCreationStarted');
      staging = await this.dependencies.store.createStaging(spec.descriptor);
      this.observeInstallationStage('stagingCreated');
      for (const expected of spec.expectedFiles) {
        if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
        const entry = validated.get(expected.fileId);
        if (!entry) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
        this.observeInstallationStage('stagedFileCreationStarted');
        const fileLease = await this.dependencies.store.createStagedFile(staging, expected.fileId);
        this.observeInstallationStage('stagedFileCreated');
        let written = 0;
        const hash = metadataOnlyModel ? null : createHash('sha256');
        try {
          for await (const chunk of entry.chunks) {
            if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
            if (!(chunk instanceof Uint8Array) || chunk.byteLength > MAX_GUARD_WRITE_FILE_CHUNK_BYTES) {
              throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
            }
            if (chunk.byteLength === 0) continue;
            written += chunk.byteLength;
            if (!Number.isSafeInteger(written) || written > expected.sizeBytes) {
              throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
            }
            hash?.update(chunk);
            await pipeline.enqueue(fileLease, chunk);
          }
          await pipeline.finish();
          this.observeInstallationStage('writesSettled');
          if (written !== expected.sizeBytes || (!metadataOnlyModel && hash?.digest('hex') !== expected.sha256)) {
            throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
          }
          this.observeInstallationStage('fileSealStarted');
          await this.dependencies.store.sealStagedFile(fileLease);
          this.observeInstallationStage('fileSealed');
          await fileLease.release();
          this.observeInstallationStage('fileReleased');
        } catch (error) {
          await pipeline.settle();
          await fileLease.release().catch(() => undefined);
          throw error;
        }
      }
      this.observeInstallationStage('promotionStarted');
      if (metadataOnlyModel) await this.dependencies.store.promoteMetadataOnlyModel(spec.descriptor, staging);
      else await this.dependencies.store.promote(spec.descriptor, staging);
      promoted = true;
      this.observeInstallationStage('promoted');
    } catch (error) {
      await pipeline.settle();
      if (staging && !promoted) {
        try {
          await this.dependencies.store.discardStaging(staging);
        } catch {
          throw new LocalWhisperArtifactLifecycleError('CLEANUP_FAILED');
        }
      }
      if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      if (error instanceof LocalWhisperArtifactLifecycleError) throw error;
      throw new LocalWhisperArtifactLifecycleError('INSTALL_FAILED');
    } finally {
      pipeline.dispose();
    }
  }

  private observeInstallationStage(stage: ArtifactInstallationDiagnosticStage): void {
    try {
      this.dependencies.onInstallationStage?.(stage);
    } catch {
      // Qualification diagnostics must not alter the installation outcome.
    }
  }
}
