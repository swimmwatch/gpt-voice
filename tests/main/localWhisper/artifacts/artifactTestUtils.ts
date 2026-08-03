/* eslint-disable max-classes-per-file -- one deterministic fixture graph keeps lifecycle tests explicit. */
import { createHash } from 'node:crypto';

import { ArtifactCatalogResolver } from '@main/localWhisper/artifacts/ArtifactCatalogResolver';
import {
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactDiskSpacePort,
  type ArtifactHttpClient,
  type ArtifactHttpClientRequest,
  type ArtifactHttpClientResponse,
  type ArtifactInventoryPort,
  type ArtifactSafeLogger,
  type ArtifactSignatureVerifier,
  type ArtifactStreamingWorker,
  type ArtifactTransferJournalStore,
  type ArtifactWorkerProcessInput,
  type ArtifactWorkerProcessResult,
  type LocalWhisperArtifactDownloadSpec,
  type StreamingArtifactEntry,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { ArtifactProgressStore } from '@main/localWhisper/artifacts/ArtifactProgressStore';
import { ArtifactTransferJournalRepository } from '@main/localWhisper/artifacts/ArtifactTransferJournalRepository';
import { ArtifactTransferQueue } from '@main/localWhisper/artifacts/ArtifactTransferQueue';
import { CatalogHttpTransport } from '@main/localWhisper/artifacts/CatalogHttpTransport';
import { LocalWhisperArtifactService } from '@main/localWhisper/artifacts/LocalWhisperArtifactService';
import { StreamingArtifactExtractor } from '@main/localWhisper/artifacts/StreamingArtifactExtractor';
import { StreamingArtifactVerifier } from '@main/localWhisper/artifacts/StreamingArtifactVerifier';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import {
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
  type ManagedArtifactDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import type { ManagedArtifactRemovalClearance } from '@main/localWhisper/filesystem/ManagedArtifactRemovalClearance';
import type { LocalWhisperArtifactId } from '@shared/localWhisper';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

export const STRONG_ETAG = '"fixture-etag-v1"';
export const MODEL_TRANSFER = Buffer.from('fixture-model-transfer-object', 'utf8');
export const MODEL_FILE = Buffer.from('fixture-model-materialized-data', 'utf8');
export const RUNTIME_TRANSFER = Buffer.from('fixture-runtime-transfer-object', 'utf8');
export const RUNTIME_FILE = Buffer.from('fixture-runtime-worker', 'utf8');

export function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export class RealArtifactClock implements ArtifactClock {
  public now(): number {
    return Date.now();
  }

  public setTimeout(callback: () => void, delayMs: number): NodeJS.Timeout {
    return setTimeout(callback, delayMs);
  }

  public clearTimeout(handle: unknown): void {
    clearTimeout(handle as NodeJS.Timeout);
  }
}

export class MemoryArtifactJournalStore implements ArtifactTransferJournalStore {
  public readonly values = new Map<LocalWhisperArtifactId, unknown>();

  public async list(): Promise<readonly unknown[]> {
    return [...this.values.values()].map((value) => structuredClone(value));
  }

  public async read(artifactId: LocalWhisperArtifactId): Promise<unknown> {
    const value = this.values.get(artifactId);
    return value === undefined ? null : structuredClone(value);
  }

  public async write(artifactId: LocalWhisperArtifactId, value: unknown): Promise<void> {
    this.values.set(artifactId, structuredClone(value));
  }

  public async remove(artifactId: LocalWhisperArtifactId): Promise<void> {
    this.values.delete(artifactId);
  }
}

export type HttpHandler = (request: ArtifactHttpClientRequest) => Promise<ArtifactHttpClientResponse>;

export class RecordingArtifactHttpClient implements ArtifactHttpClient {
  public readonly requests: ArtifactHttpClientRequest[] = [];

  public constructor(public handler: HttpHandler) {}

  public async open(request: ArtifactHttpClientRequest): Promise<ArtifactHttpClientResponse> {
    this.requests.push(request);
    return await this.handler(request);
  }
}

interface WorkerFixture {
  readonly entries: readonly StreamingArtifactEntry[];
  readonly transferSha256: string;
  readonly peakBufferedBytes?: number;
  readonly failAfterBytes?: number;
  readonly failureCode?: 'DOWNLOAD_FAILED' | 'DOWNLOAD_OFFLINE';
}

export class FixtureStreamingArtifactWorker implements ArtifactStreamingWorker {
  public readonly fixtures = new Map<LocalWhisperArtifactId, WorkerFixture>();
  public readonly spools = new Map<string, number>();
  public readonly cancelled: string[] = [];
  public readonly terminated: string[] = [];
  public maximumObservedChunkBytes = 0;
  public active = 0;
  public maximumActive = 0;

  public async process(input: ArtifactWorkerProcessInput): Promise<ArtifactWorkerProcessResult> {
    const fixture = this.fixtures.get(input.artifactId);
    if (!fixture) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    const spoolId = input.resume?.spoolId ?? input.operationId;
    let received = input.resume?.offset ?? 0;
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      for await (const chunk of input.stream) {
        if (input.signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
        this.maximumObservedChunkBytes = Math.max(this.maximumObservedChunkBytes, chunk.byteLength);
        received += chunk.byteLength;
        this.spools.set(spoolId, received);
        await input.onProgress(received);
        if (fixture.failAfterBytes !== undefined && received >= fixture.failAfterBytes) {
          throw new LocalWhisperArtifactLifecycleError(fixture.failureCode ?? 'DOWNLOAD_FAILED');
        }
        await Promise.resolve();
      }
      return Object.freeze({
        entries: fixture.entries,
        peakBufferedBytes: fixture.peakBufferedBytes ?? this.maximumObservedChunkBytes,
        receivedBytes: received,
        spoolId,
        transferSha256: fixture.transferSha256,
      });
    } finally {
      this.active -= 1;
    }
  }

  public async cancel(operationId: string): Promise<void> {
    this.cancelled.push(operationId);
  }

  public async terminate(operationId: string): Promise<void> {
    this.terminated.push(operationId);
  }

  public async discard(spoolId: string): Promise<void> {
    this.spools.delete(spoolId);
  }
}

export class RecordingSignatureVerifier implements ArtifactSignatureVerifier {
  public readonly calls: Array<{ readonly digest: string; readonly keyId: LocalWhisperArtifactId }> = [];
  public valid = true;

  public async verify(input: {
    readonly digest: string;
    readonly keyId: LocalWhisperArtifactId;
    readonly signatureBase64: string;
  }): Promise<boolean> {
    this.calls.push({ digest: input.digest, keyId: input.keyId });
    return this.valid;
  }
}

interface StagingRecord {
  readonly descriptor: ManagedArtifactDescriptor;
  readonly files: Map<LocalWhisperArtifactId, Uint8Array[]>;
}

export class RecordingManagedArtifactStore {
  public readonly installed = new Set<LocalWhisperArtifactId>();
  public discardedStaging = 0;
  public promotions = 0;
  public deletions = 0;
  private readonly staging = new WeakMap<ManagedArtifactLease, StagingRecord>();
  private readonly files = new WeakMap<ManagedArtifactLease, Uint8Array[]>();

  public async createStaging(descriptor: ManagedArtifactDescriptor): Promise<ManagedArtifactLease> {
    const lease = this.lease(descriptor, 'staging');
    this.staging.set(lease, { descriptor, files: new Map() });
    return lease;
  }

  public async createStagedFile(
    stagingLease: ManagedArtifactLease,
    fileId: LocalWhisperArtifactId,
  ): Promise<ManagedArtifactLease> {
    const record = this.staging.get(stagingLease);
    if (!record || !record.descriptor.expectedFiles.some((expected) => expected.fileId === fileId)) {
      throw new Error('invalid staging file');
    }
    const chunks: Uint8Array[] = [];
    record.files.set(fileId, chunks);
    const lease = this.lease(record.descriptor, 'staging');
    this.files.set(lease, chunks);
    return lease;
  }

  public async appendStagedFile(fileLease: ManagedArtifactLease, chunk: Uint8Array): Promise<void> {
    const chunks = this.files.get(fileLease);
    if (!chunks) throw new Error('invalid file lease');
    chunks.push(Uint8Array.from(chunk));
  }

  public async sealStagedFile(fileLease: ManagedArtifactLease): Promise<void> {
    await fileLease.release();
  }

  public async promote(descriptor: ManagedArtifactDescriptor, stagingLease: ManagedArtifactLease): Promise<void> {
    const record = this.staging.get(stagingLease);
    if (!record || record.descriptor !== descriptor) throw new Error('invalid staging lease');
    for (const expected of descriptor.expectedFiles) {
      const chunks = record.files.get(expected.fileId);
      if (!chunks) throw new Error('missing staged file');
      const value = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
      if (value.byteLength !== expected.sizeBytes || sha256(value) !== expected.sha256) {
        throw new Error('staged file mismatch');
      }
    }
    this.installed.add(descriptor.artifactId);
    this.promotions += 1;
    await stagingLease.release();
  }

  public async discardStaging(stagingLease: ManagedArtifactLease): Promise<void> {
    this.discardedStaging += 1;
    await stagingLease.release();
  }

  public async deleteArtifact(
    descriptor: ManagedArtifactDescriptor,
    clearance: ManagedArtifactRemovalClearance,
  ): Promise<void> {
    if (!clearance.authorizes(descriptor.artifactId) || !this.installed.has(descriptor.artifactId)) {
      throw new Error('delete failed');
    }
    this.installed.delete(descriptor.artifactId);
    this.deletions += 1;
  }

  private lease(descriptor: ManagedArtifactDescriptor, purpose: 'staging'): ManagedArtifactLease {
    return new ManagedArtifactLease(
      {
        artifactId: descriptor.artifactId,
        artifactKind: descriptor.kind,
        canonicalName: descriptor.canonicalName,
        catalogDigest: descriptor.catalogDigest,
        identity: {
          deviceOrVolumeId: 'fixture-volume',
          fileId: `fixture-${descriptor.canonicalName}`,
          linkCount: 1,
          mode: 0o700,
          parentFileId: 'fixture-parent',
          sizeBytes: 0,
          type: 'directory',
        },
        purpose,
      },
      `fixture-token-${descriptor.canonicalName}`,
      async () => undefined,
    );
  }
}

export class RecordingInventory implements ArtifactInventoryPort {
  public revision = 1;

  public getRevision(): number {
    return this.revision;
  }

  public async refresh(): Promise<number> {
    this.revision += 1;
    return this.revision;
  }
}

export class RecordingDiskSpace implements ArtifactDiskSpacePort {
  public freeBytes = Number.MAX_SAFE_INTEGER;
  public retainedBytes = 0;

  public async getFreeBytes(): Promise<number> {
    return this.freeBytes;
  }

  public async getRetainedInstalledBytes(): Promise<number> {
    return this.retainedBytes;
  }
}

export class RecordingSafeLogger implements ArtifactSafeLogger {
  public readonly events: Array<{ readonly event: string; readonly metadata: Readonly<Record<string, unknown>> }> = [];

  public info(event: string, metadata: Readonly<Record<string, string | number | boolean>>): void {
    this.events.push({ event, metadata });
  }

  public warn(event: string, metadata: Readonly<Record<string, string | number | boolean>>): void {
    this.events.push({ event, metadata });
  }
}

export interface ArtifactCatalogFixture {
  readonly catalog: ReturnType<ArtifactCatalogResolver['getCatalog']>;
  readonly model: LocalWhisperArtifactDownloadSpec;
  readonly runtime: LocalWhisperArtifactDownloadSpec;
}

export function entry(
  name: string,
  contents: Uint8Array,
  overrides: Partial<Omit<StreamingArtifactEntry, 'chunks' | 'name'>> = {},
): StreamingArtifactEntry {
  return Object.freeze({
    name,
    type: 'regular' as const,
    mode: 0o600,
    sizeBytes: contents.byteLength,
    sha256: sha256(contents),
    chunks: byteStream(contents, 0),
    ...overrides,
  });
}

export function createArtifactCatalogFixture(): ArtifactCatalogFixture {
  const source = createFixtureCatalogPayload();
  const sourceRuntime = source.runtimes[0];
  const sourceModel = source.models[0];
  const runtime = {
    ...sourceRuntime,
    identity: {
      ...sourceRuntime.identity,
      archiveSizeBytes: RUNTIME_TRANSFER.byteLength,
      archiveSha256: sha256(RUNTIME_TRANSFER),
      expectedFiles: [
        {
          ...sourceRuntime.identity.expectedFiles[0],
          mode: 0o755,
          sizeBytes: RUNTIME_FILE.byteLength,
          sha256: sha256(RUNTIME_FILE),
        },
      ],
    },
  };
  const model = {
    ...sourceModel,
    expectedFiles: [
      {
        ...sourceModel.expectedFiles[0],
        mode: 0o600,
        sizeBytes: MODEL_FILE.byteLength,
        sha256: sha256(MODEL_FILE),
      },
    ],
    transferSizeBytes: MODEL_TRANSFER.byteLength,
    transferSha256: sha256(MODEL_TRANSFER),
    installedSizeBytes: MODEL_FILE.byteLength,
  };
  const payload = { ...source, runtimes: [runtime], models: [model] };
  const loaded = new LocalWhisperCatalogRepository({
    readDocument: () => signFixtureCatalog(payload),
    trustPolicy: createFixtureCatalogTrustPolicy(),
  }).load();
  if (!loaded.success) throw new Error(`fixture catalog failed: ${loaded.code}`);
  const resolver = new ArtifactCatalogResolver({ getCatalog: () => loaded.catalog });
  return {
    catalog: loaded.catalog,
    runtime: resolver.resolve(
      createManagedRuntimeDescriptor(loaded.catalog, loaded.catalog.payload.runtimes[0]).artifactId,
    ),
    model: resolver.resolve(createManagedModelDescriptor(loaded.catalog, loaded.catalog.payload.models[0]).artifactId),
  };
}

async function* byteStream(value: Uint8Array, start: number): AsyncIterable<Uint8Array> {
  yield Uint8Array.from(value.subarray(start));
}

export interface ArtifactServiceHarness {
  readonly catalogFixture: ArtifactCatalogFixture;
  readonly client: RecordingArtifactHttpClient;
  readonly disk: RecordingDiskSpace;
  readonly inventory: RecordingInventory;
  readonly journalStore: MemoryArtifactJournalStore;
  readonly logger: RecordingSafeLogger;
  readonly progress: ArtifactProgressStore;
  readonly service: LocalWhisperArtifactService;
  readonly signatureVerifier: RecordingSignatureVerifier;
  readonly store: RecordingManagedArtifactStore;
  readonly worker: FixtureStreamingArtifactWorker;
}

export function createArtifactServiceHarness(
  options: {
    readonly journalStore?: MemoryArtifactJournalStore;
    readonly worker?: FixtureStreamingArtifactWorker;
    readonly client?: RecordingArtifactHttpClient;
  } = {},
): ArtifactServiceHarness {
  const catalogFixture = createArtifactCatalogFixture();
  const transfers = new Map([
    [catalogFixture.model.requestUrl, MODEL_TRANSFER],
    [catalogFixture.runtime.requestUrl, RUNTIME_TRANSFER],
  ]);
  const client =
    options.client ??
    new RecordingArtifactHttpClient(async (request) => {
      const value = transfers.get(request.url);
      if (!value) throw new Error('unknown fixture URL');
      const start = request.rangeStart ?? 0;
      return {
        status: start > 0 ? 206 : 200,
        body: byteStream(value, start),
        headers: {
          contentLength: value.byteLength - start,
          contentRange: start > 0 ? `bytes ${start}-${value.byteLength - 1}/${value.byteLength}` : null,
          acceptRanges: 'bytes',
          etag: STRONG_ETAG,
          location: null,
        },
      };
    });
  const worker = options.worker ?? new FixtureStreamingArtifactWorker();
  worker.fixtures.set(catalogFixture.model.artifactId, {
    entries: [entry(catalogFixture.model.expectedFiles[0].fileId, MODEL_FILE)],
    transferSha256: sha256(MODEL_TRANSFER),
  });
  worker.fixtures.set(catalogFixture.runtime.artifactId, {
    entries: [
      entry(catalogFixture.runtime.expectedFiles[0].fileId, RUNTIME_FILE, {
        mode: catalogFixture.runtime.expectedFiles[0].mode,
      }),
    ],
    transferSha256: sha256(RUNTIME_TRANSFER),
  });
  const clock = new RealArtifactClock();
  const journalStore = options.journalStore ?? new MemoryArtifactJournalStore();
  const journals = new ArtifactTransferJournalRepository(journalStore);
  const signatureVerifier = new RecordingSignatureVerifier();
  const store = new RecordingManagedArtifactStore();
  const inventory = new RecordingInventory();
  const disk = new RecordingDiskSpace();
  const progress = new ArtifactProgressStore(clock);
  const logger = new RecordingSafeLogger();
  let operationCounter = 0;
  const resolver = new ArtifactCatalogResolver({ getCatalog: () => catalogFixture.catalog });
  const verifier = new StreamingArtifactVerifier({ clock, signatureVerifier, worker });
  const service = new LocalWhisperArtifactService({
    catalogResolver: resolver,
    clock,
    diskSpace: disk,
    extractor: new StreamingArtifactExtractor(store),
    generateOperationId: () => `artifact-operation-${String(++operationCounter).padStart(20, '0')}`,
    inventory,
    journals,
    logger,
    progress,
    queue: new ArtifactTransferQueue(),
    store,
    transport: new CatalogHttpTransport({ client, clock }),
    verifier,
  });
  return {
    catalogFixture,
    client,
    disk,
    inventory,
    journalStore,
    logger,
    progress,
    service,
    signatureVerifier,
    store,
    worker,
  };
}
