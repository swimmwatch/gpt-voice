import type {
  LocalWhisperArtifactAction,
  LocalWhisperArtifactId,
  LocalWhisperFailureCode,
  LocalWhisperRendererSafeFailure,
  LocalWhisperRevisionId,
} from '@shared/localWhisper';

import type {
  LocalWhisperAuthenticatedCatalog,
  LocalWhisperCatalogRedirectPolicy,
  LocalWhisperTransferProfile,
} from '../catalog/LocalWhisperCatalogTypes';
import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import type { ManagedArtifactRemovalClearance } from '../filesystem/ManagedArtifactRemovalClearance';
import type { ManagedArtifactDescriptor, ManagedArtifactExpectedFile } from '../filesystem/ManagedArtifactStore';

export const ARTIFACT_CONNECTION_TIMEOUT_MS = 20_000;
export const ARTIFACT_NO_PROGRESS_TIMEOUT_MS = 60_000;
export const ARTIFACT_MAX_REDIRECTS = 5;
export const ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS = 12 * 60 * 60 * 1_000;
export const ARTIFACT_MAX_ACTIVE_TRANSFERS = 2;
export const ARTIFACT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
export const ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS = 5_000;
export const ARTIFACT_MIN_DISK_MARGIN_BYTES = 512 * 1024 * 1024;
export const ARTIFACT_PROGRESS_MIN_INTERVAL_MS = 100;
export const ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION = 1 as const;

export type LocalWhisperArtifactOperationId = string;
export type LocalWhisperArtifactOperationState =
  | 'Queued'
  | 'Downloading'
  | 'Resumable'
  | 'Verifying'
  | 'Installing'
  | 'Installed'
  | 'Deleting'
  | 'Missing'
  | 'Cancelled'
  | 'Failed';

export interface LocalWhisperArtifactDownloadSpec {
  readonly artifactId: LocalWhisperArtifactId;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly descriptor: ManagedArtifactDescriptor;
  readonly expandedSizeBytes: number;
  readonly expectedFiles: readonly ManagedArtifactExpectedFile[];
  readonly expectedTransferSha256: string;
  readonly expectedTransferSizeBytes: number;
  readonly originId: LocalWhisperArtifactId;
  readonly origin: string;
  readonly requestUrl: string;
  readonly redirectPolicy: LocalWhisperCatalogRedirectPolicy;
  readonly transferProfile: LocalWhisperTransferProfile;
  readonly artifactSignature: {
    readonly keyId: LocalWhisperArtifactId;
    readonly signatureBase64: string;
  } | null;
}

export interface ArtifactClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ArtifactHttpClientRequest {
  readonly signal: AbortSignal;
  readonly url: string;
  readonly rangeStart: number | null;
  readonly ifRange: string | null;
}

export interface ArtifactHttpClientResponse {
  readonly status: number;
  readonly body: AsyncIterable<Uint8Array>;
  readonly headers: {
    readonly contentLength: number | null;
    readonly contentRange: string | null;
    readonly acceptRanges?: string | null;
    readonly contentEncoding?: string | null;
    readonly contentType?: string | null;
    readonly etag: string | null;
    readonly location: string | null;
  };
}

export interface ArtifactHttpClient {
  open(request: ArtifactHttpClientRequest): Promise<ArtifactHttpClientResponse>;
}

export interface ArtifactTransportResumeRequest {
  readonly offset: number;
  readonly validator: string;
}

export interface ArtifactTransportStream {
  readonly body: AsyncIterable<Uint8Array>;
  readonly expectedCompleteLength: number;
  readonly resumeOffset: number;
  readonly validator: string | null;
}

export type ArtifactEntryType =
  'regular' | 'directory' | 'symlink' | 'hardlink' | 'junction' | 'fifo' | 'socket' | 'device' | 'sparse';

export interface StreamingArtifactEntry {
  readonly chunks: AsyncIterable<Uint8Array>;
  readonly mode: number;
  readonly name: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly type: ArtifactEntryType;
}

export interface ArtifactWorkerProcessInput {
  readonly artifactId: LocalWhisperArtifactId;
  readonly expectedFiles: readonly ManagedArtifactExpectedFile[];
  readonly expectedTransferSha256: string;
  readonly expectedTransferSizeBytes: number;
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly resume: { readonly offset: number; readonly spoolId: string } | null;
  readonly signal: AbortSignal;
  readonly stream: AsyncIterable<Uint8Array>;
  readonly transferProfile: LocalWhisperTransferProfile;
  readonly onProgress: (receivedBytes: number) => Promise<void>;
}

export interface ArtifactWorkerProcessResult {
  readonly entries: readonly StreamingArtifactEntry[];
  readonly peakBufferedBytes: number;
  readonly receivedBytes: number;
  readonly spoolId: string;
  readonly transferSha256: string;
}

export interface ArtifactStreamingWorker {
  process(input: ArtifactWorkerProcessInput): Promise<ArtifactWorkerProcessResult>;
  cancel(operationId: LocalWhisperArtifactOperationId): Promise<void>;
  terminate(operationId: LocalWhisperArtifactOperationId): Promise<void>;
  discard(spoolId: string): Promise<void>;
}

export interface ArtifactSignatureVerifier {
  verify(input: {
    readonly digest: string;
    readonly keyId: LocalWhisperArtifactId;
    readonly signatureBase64: string;
  }): Promise<boolean>;
}

export interface ArtifactTransferJournal {
  readonly schemaVersion: typeof ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION;
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly catalogDigest: string;
  readonly expectedLength: number;
  readonly expectedSha256: string;
  readonly originId: LocalWhisperArtifactId;
  readonly receivedLength: number;
  readonly serverValidator: string | null;
  readonly spoolId: string;
  readonly state: 'Downloading' | 'Resumable';
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface ArtifactTransferJournalStore {
  list(): Promise<readonly unknown[]>;
  read(artifactId: LocalWhisperArtifactId): Promise<unknown>;
  write(artifactId: LocalWhisperArtifactId, value: unknown): Promise<void>;
  remove(artifactId: LocalWhisperArtifactId): Promise<void>;
}

export interface ArtifactDiskSpacePort {
  getFreeBytes(): Promise<number>;
  getRetainedInstalledBytes(descriptor: ManagedArtifactDescriptor): Promise<number>;
}

export interface ArtifactInventoryPort {
  getRevision(): number;
  refresh(catalog: LocalWhisperAuthenticatedCatalog): Promise<number>;
}

export interface ArtifactManagedStorePort {
  createStaging(descriptor: ManagedArtifactDescriptor): Promise<ManagedArtifactLease>;
  createStagedFile(stagingLease: ManagedArtifactLease, fileId: LocalWhisperArtifactId): Promise<ManagedArtifactLease>;
  appendStagedFile(fileLease: ManagedArtifactLease, chunk: Uint8Array): Promise<void>;
  sealStagedFile(fileLease: ManagedArtifactLease): Promise<unknown>;
  promote(descriptor: ManagedArtifactDescriptor, stagingLease: ManagedArtifactLease): Promise<void>;
  discardStaging(stagingLease: ManagedArtifactLease): Promise<void>;
  deleteArtifact(descriptor: ManagedArtifactDescriptor, clearance: ManagedArtifactRemovalClearance): Promise<void>;
}

export interface ArtifactSafeLogger {
  info(event: string, metadata: Readonly<Record<string, string | number | boolean>>): void;
  warn(event: string, metadata: Readonly<Record<string, string | number | boolean>>): void;
}

export interface LocalWhisperArtifactProgressSnapshot {
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly action: LocalWhisperArtifactAction;
  readonly state: LocalWhisperArtifactOperationState;
  readonly receivedBytes: number;
  readonly totalBytes: number;
  readonly queuedPosition: number | null;
  readonly updatedAtMs: number;
  readonly failure: LocalWhisperRendererSafeFailure | null;
}

export interface LocalWhisperArtifactOperationSuccess {
  readonly success: true;
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly state: 'Installed' | 'Missing';
  readonly inventoryRevision: number;
}

export interface LocalWhisperArtifactOperationFailure {
  readonly success: false;
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly state: 'Cancelled' | 'Failed' | 'Resumable';
  readonly error: LocalWhisperRendererSafeFailure;
}

export type LocalWhisperArtifactOperationResult =
  LocalWhisperArtifactOperationSuccess | LocalWhisperArtifactOperationFailure;

export interface LocalWhisperArtifactOperationHandle {
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly completion: Promise<LocalWhisperArtifactOperationResult>;
}

export interface LocalWhisperArtifactDownloadRequest {
  readonly artifactId: LocalWhisperArtifactId;
  readonly expectedInventoryRevision: number;
}

export interface LocalWhisperArtifactRemoveRequest extends LocalWhisperArtifactDownloadRequest {
  readonly clearance: ManagedArtifactRemovalClearance;
}

/** Stable renderer-safe failure raised inside the artifact lifecycle boundary. */
export class LocalWhisperArtifactLifecycleError extends Error {
  public constructor(public readonly code: LocalWhisperFailureCode) {
    super(code);
    this.name = 'LocalWhisperArtifactLifecycleError';
  }
}
