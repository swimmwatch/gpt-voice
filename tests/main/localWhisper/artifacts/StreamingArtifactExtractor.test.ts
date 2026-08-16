import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ARTIFACT_MAX_BUFFER_BYTES,
  ARTIFACT_NO_PROGRESS_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactEntryType,
  type LocalWhisperArtifactDownloadSpec,
  type StreamingArtifactEntry,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import {
  ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS,
  PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
  StreamingArtifactExtractor,
  type ArtifactInstallationPipelineSnapshot,
} from '@main/localWhisper/artifacts/StreamingArtifactExtractor';
import type { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import type { ManagedArtifactExpectedFile } from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import {
  MODEL_FILE,
  RecordingManagedArtifactStore,
  createArtifactServiceHarness,
  entry,
  sha256,
} from './artifactTestUtils';

const SECOND_FILE = Buffer.from('second fixture model file', 'utf8');

interface Timer {
  readonly callback: () => void;
  readonly deadline: number;
  cancelled: boolean;
}

class ManualClock implements ArtifactClock {
  private current = 0;
  private readonly timers: Timer[] = [];

  public now(): number {
    return this.current;
  }

  public setTimeout(callback: () => void, delayMs: number): Timer {
    const timer = { callback, deadline: this.current + delayMs, cancelled: false };
    this.timers.push(timer);
    return timer;
  }

  public clearTimeout(handle: unknown): void {
    (handle as Timer).cancelled = true;
  }

  public advance(delayMs: number): void {
    this.current += delayMs;
    for (const timer of this.timers) {
      if (!timer.cancelled && timer.deadline <= this.current) {
        timer.cancelled = true;
        timer.callback();
      }
    }
  }

  public get activeTimerCount(): number {
    return this.timers.filter((timer) => !timer.cancelled).length;
  }
}

function realClock(): ArtifactClock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  };
}

function secondExpectedFile(fileId = 'second-model-file'): ManagedArtifactExpectedFile {
  const parsed = toLocalWhisperArtifactId(fileId);
  assert.ok(parsed);
  return Object.freeze({
    fileId: parsed,
    kind: 'data',
    mode: 0o600,
    sha256: sha256(SECOND_FILE),
    sizeBytes: SECOND_FILE.byteLength,
  });
}

function withExpectedFiles(
  base: LocalWhisperArtifactDownloadSpec,
  expectedFiles: readonly ManagedArtifactExpectedFile[],
): LocalWhisperArtifactDownloadSpec {
  return Object.freeze({
    ...base,
    descriptor: Object.freeze({ ...base.descriptor, expectedFiles: Object.freeze([...expectedFiles]) }),
    expandedSizeBytes: expectedFiles.reduce((total, file) => total + file.sizeBytes, 0),
    expectedFiles: Object.freeze([...expectedFiles]),
  });
}

async function* noChunks(): AsyncIterable<Uint8Array> {
  for (const chunk of [] as Uint8Array[]) yield chunk;
}

async function* oneChunk(value: Uint8Array): AsyncIterable<Uint8Array> {
  yield value;
}

function metadataOnlyModelEntry(
  name: string,
  contents: Uint8Array,
  overrides: Partial<Omit<StreamingArtifactEntry, 'chunks' | 'name'>> = {},
): StreamingArtifactEntry {
  return entry(name, contents, { sha256: null, ...overrides });
}

async function expectArchiveInvalid(
  spec: LocalWhisperArtifactDownloadSpec,
  entries: readonly StreamingArtifactEntry[],
): Promise<void> {
  const harness = createArtifactServiceHarness();
  harness.store.installed.add(harness.catalogFixture.runtime.artifactId);
  await assert.rejects(
    new StreamingArtifactExtractor({
      clock: realClock(),
      maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
      observePipeline: null,
      store: harness.store,
    }).install(spec, entries, new AbortController().signal),
    (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'ARCHIVE_INVALID',
  );
  assert.deepEqual(harness.store.installed, new Set([harness.catalogFixture.runtime.artifactId]));
  assert.equal(harness.store.promotions, 0);
}

interface PendingWrite {
  readonly chunk: Uint8Array;
  readonly fileLease: ManagedArtifactLease;
  readonly onAbort: (() => void) | null;
  readonly reject: (error: Error) => void;
  readonly resolve: () => void;
  readonly signal: AbortSignal | null;
}

class ControlledWriteStore extends RecordingManagedArtifactStore {
  public readonly issuedBytes: number[] = [];
  public automatic = false;
  public maximumActive = 0;
  private active = 0;
  private readonly pendingWrites: PendingWrite[] = [];

  public get pendingCount(): number {
    return this.pendingWrites.length;
  }

  public override async appendStagedFile(
    fileLease: ManagedArtifactLease,
    chunk: Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    this.issuedBytes.push(chunk[0] ?? 0);
    if (this.automatic) {
      await super.appendStagedFile(fileLease, chunk);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const pending: PendingWrite = {
        chunk: Uint8Array.from(chunk),
        fileLease,
        onAbort: signal
          ? (): void => {
              void this.complete(pending, new Error('fixture cancelled'));
            }
          : null,
        reject,
        resolve,
        signal: signal ?? null,
      };
      this.pendingWrites.push(pending);
      this.active += 1;
      this.maximumActive = Math.max(this.maximumActive, this.active);
      if (signal && pending.onAbort) signal.addEventListener('abort', pending.onAbort, { once: true });
    });
  }

  public async completeNext(error?: Error): Promise<void> {
    const pending = this.pendingWrites[0];
    if (!pending) throw new Error('No pending artifact write');
    await this.complete(pending, error);
  }

  private async complete(pending: PendingWrite, error?: Error): Promise<void> {
    const index = this.pendingWrites.indexOf(pending);
    if (index === -1) return;
    this.pendingWrites.splice(index, 1);
    this.active -= 1;
    if (pending.signal && pending.onAbort) pending.signal.removeEventListener('abort', pending.onAbort);
    if (error) {
      pending.reject(error);
      return;
    }
    try {
      await super.appendStagedFile(pending.fileLease, pending.chunk);
      pending.resolve();
    } catch (writeError) {
      pending.reject(writeError instanceof Error ? writeError : new Error('fixture write failed'));
    }
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('Timed out waiting for pipeline fixture');
}

function pipelineFixture(chunkCount: number): {
  readonly chunks: readonly Uint8Array[];
  readonly entry: StreamingArtifactEntry;
  readonly spec: LocalWhisperArtifactDownloadSpec;
} {
  const base = createArtifactServiceHarness().catalogFixture.runtime;
  const chunks = Object.freeze(Array.from({ length: chunkCount }, (_, index) => Uint8Array.of(index + 1)));
  const contents = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const expected = Object.freeze({
    ...base.expectedFiles[0],
    sha256: sha256(contents),
    sizeBytes: contents.byteLength,
  });
  const spec = withExpectedFiles(base, [expected]);
  const streamingEntry = Object.freeze({
    chunks: (async function* (): AsyncIterable<Uint8Array> {
      for (const chunk of chunks) yield Uint8Array.from(chunk);
    })(),
    mode: expected.mode,
    name: expected.fileId,
    sha256: expected.sha256,
    sizeBytes: expected.sizeBytes,
    type: 'regular' as const,
  });
  return Object.freeze({ chunks, entry: streamingEntry, spec });
}

async function drainSuccessfulWrites(store: ControlledWriteStore, expectedCount: number): Promise<void> {
  while (store.issuedBytes.length < expectedCount || store.pendingCount > 0) {
    await waitFor(() => store.pendingCount > 0);
    await store.completeNext();
  }
}

describe('StreamingArtifactExtractor manifest-first boundary', () => {
  test('rejects traversal, absolute paths, and undeclared names before staging', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    for (const name of ['../outside', '/absolute', String.raw`C:\absolute`, 'unexpected-file']) {
      await expectArchiveInvalid(base, [metadataOnlyModelEntry(name, MODEL_FILE)]);
    }
  });

  test('rejects duplicate and case-colliding entries', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const second = secondExpectedFile();
    const duplicateSpec = withExpectedFiles(base, [...base.expectedFiles, second]);
    await expectArchiveInvalid(duplicateSpec, [
      metadataOnlyModelEntry(base.expectedFiles[0].fileId, MODEL_FILE),
      metadataOnlyModelEntry(base.expectedFiles[0].fileId, SECOND_FILE),
    ]);

    const caseId = String(base.expectedFiles[0].fileId).toUpperCase();
    const caseSpec = withExpectedFiles(base, [...base.expectedFiles, secondExpectedFile(caseId)]);
    await expectArchiveInvalid(caseSpec, [
      metadataOnlyModelEntry(base.expectedFiles[0].fileId, MODEL_FILE),
      metadataOnlyModelEntry(caseId, SECOND_FILE),
    ]);
  });

  test('rejects every link, special-file, and sparse entry type', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const unsupportedTypes: readonly ArtifactEntryType[] = [
      'directory',
      'symlink',
      'hardlink',
      'junction',
      'fifo',
      'socket',
      'device',
      'sparse',
    ];
    for (const type of unsupportedTypes) {
      await expectArchiveInvalid(base, [metadataOnlyModelEntry(base.expectedFiles[0].fileId, MODEL_FILE, { type })]);
    }
  });

  test('rejects wrong mode, declared size, declared hash, and expanded-size evidence', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const expected = base.expectedFiles[0];
    await expectArchiveInvalid(base, [metadataOnlyModelEntry(expected.fileId, MODEL_FILE, { mode: 0o755 })]);
    await expectArchiveInvalid(base, [
      metadataOnlyModelEntry(expected.fileId, MODEL_FILE, { sizeBytes: MODEL_FILE.byteLength + 1 }),
    ]);
    await expectArchiveInvalid(base, [
      metadataOnlyModelEntry(expected.fileId, MODEL_FILE, { sha256: sha256(Buffer.from('wrong')) }),
    ]);
    await expectArchiveInvalid(Object.freeze({ ...base, expandedSizeBytes: base.expandedSizeBytes + 1 }), [
      metadataOnlyModelEntry(expected.fileId, MODEL_FILE),
    ]);
  });

  test('rejects truncated model files but accepts a same-size replacement without hashing', async () => {
    const harness = createArtifactServiceHarness();
    const base = harness.catalogFixture.model;
    const valid = metadataOnlyModelEntry(base.expectedFiles[0].fileId, MODEL_FILE);
    await expectArchiveInvalid(base, [{ ...valid, chunks: noChunks() }]);

    const wrongContents = Buffer.alloc(MODEL_FILE.byteLength, 0x78);
    await new StreamingArtifactExtractor({
      clock: realClock(),
      maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
      observePipeline: null,
      store: harness.store,
    }).install(base, [{ ...valid, chunks: oneChunk(wrongContents) }], new AbortController().signal);
    assert.deepEqual(harness.store.installed, new Set([base.artifactId]));
    assert.equal(harness.store.promotions, 1);
  });
});

describe('StreamingArtifactExtractor bounded installation pipeline', () => {
  test('keeps the production binding serial until cross-platform selection', () => {
    assert.equal(PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW, 1);
    assert.deepEqual(ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS, [1, 2, 4, 8]);
  });

  for (const window of ARTIFACT_INSTALLATION_PIPELINE_CANDIDATE_WINDOWS) {
    test(`issues source-ordered writes with candidate window ${window}`, async () => {
      const store = new ControlledWriteStore();
      const snapshots: ArtifactInstallationPipelineSnapshot[] = [];
      const fixture = pipelineFixture(window + 2);
      const extractor = new StreamingArtifactExtractor({
        clock: realClock(),
        maximumInFlightWrites: window,
        observePipeline: (snapshot) => snapshots.push(snapshot),
        store,
      });

      const installation = extractor.install(fixture.spec, [fixture.entry], new AbortController().signal);
      await waitFor(() => store.issuedBytes.length === window);
      assert.equal(store.maximumActive, window);
      await store.completeNext();
      await waitFor(() => store.issuedBytes.length === window + 1);
      await drainSuccessfulWrites(store, fixture.chunks.length);
      await installation;

      assert.deepEqual(
        store.issuedBytes,
        fixture.chunks.map((chunk) => chunk[0] ?? 0),
      );
      assert.equal(store.promotions, 1);
      assert.ok(Math.max(...snapshots.map(({ inFlightWrites }) => inFlightWrites)) <= window);
      assert.ok(Math.max(...snapshots.map(({ peakOwnedBytes }) => peakOwnedBytes)) <= ARTIFACT_MAX_BUFFER_BYTES);
      assert.ok(snapshots.every(({ ownedBytes }) => ownedBytes >= 0 && ownedBytes <= ARTIFACT_MAX_BUFFER_BYTES));
    });
  }

  test('settles all issued writes after a failure before discard and supports a clean retry', async () => {
    const store = new ControlledWriteStore();
    const fixture = pipelineFixture(6);
    const extractor = new StreamingArtifactExtractor({
      clock: realClock(),
      maximumInFlightWrites: 4,
      observePipeline: null,
      store,
    });

    const failedInstallation = extractor.install(fixture.spec, [fixture.entry], new AbortController().signal);
    await waitFor(() => store.issuedBytes.length === 4);
    await store.completeNext(new Error('fixture write failure'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(store.issuedBytes.length, 4);
    while (store.pendingCount > 0) await store.completeNext();
    await assert.rejects(
      failedInstallation,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'INSTALL_FAILED',
    );
    assert.equal(store.discardedStaging, 1);
    assert.equal(store.promotions, 0);

    store.automatic = true;
    const retry = pipelineFixture(6);
    await extractor.install(retry.spec, [retry.entry], new AbortController().signal);
    assert.equal(store.promotions, 1);
  });

  test('cancellation stops issuance, settles pending writes, discards staging, and permits retry', async () => {
    const store = new ControlledWriteStore();
    const fixture = pipelineFixture(6);
    const controller = new AbortController();
    const extractor = new StreamingArtifactExtractor({
      clock: realClock(),
      maximumInFlightWrites: 4,
      observePipeline: null,
      store,
    });

    const cancelled = extractor.install(fixture.spec, [fixture.entry], controller.signal);
    await waitFor(() => store.issuedBytes.length === 4);
    controller.abort();
    await assert.rejects(
      cancelled,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'DOWNLOAD_CANCELLED',
    );
    assert.equal(store.issuedBytes.length, 4);
    assert.equal(store.pendingCount, 0);
    assert.equal(store.discardedStaging, 1);

    store.automatic = true;
    const retry = pipelineFixture(6);
    await extractor.install(retry.spec, [retry.entry], new AbortController().signal);
    assert.equal(store.promotions, 1);
  });

  test('times out stalled writes, settles them before discard, and permits retry', async () => {
    const clock = new ManualClock();
    const store = new ControlledWriteStore();
    const fixture = pipelineFixture(6);
    const extractor = new StreamingArtifactExtractor({
      clock,
      maximumInFlightWrites: 4,
      observePipeline: null,
      store,
    });

    const timedOut = extractor.install(fixture.spec, [fixture.entry], new AbortController().signal);
    await waitFor(() => store.issuedBytes.length === 4);
    assert.equal(clock.activeTimerCount, 4);
    clock.advance(ARTIFACT_NO_PROGRESS_TIMEOUT_MS);
    await assert.rejects(
      timedOut,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'OPERATION_TIMEOUT',
    );
    assert.equal(store.issuedBytes.length, 4);
    assert.equal(store.pendingCount, 0);
    assert.equal(clock.activeTimerCount, 0);
    assert.equal(store.discardedStaging, 1);
    assert.equal(store.promotions, 0);

    store.automatic = true;
    const retry = pipelineFixture(6);
    await extractor.install(retry.spec, [retry.entry], new AbortController().signal);
    assert.equal(store.promotions, 1);
  });

  test('rejects a concurrent installation without disturbing the active transfer', async () => {
    const store = new ControlledWriteStore();
    const firstFixture = pipelineFixture(2);
    const secondFixture = pipelineFixture(2);
    const extractor = new StreamingArtifactExtractor({
      clock: realClock(),
      maximumInFlightWrites: 1,
      observePipeline: null,
      store,
    });

    const active = extractor.install(firstFixture.spec, [firstFixture.entry], new AbortController().signal);
    await waitFor(() => store.pendingCount === 1);
    await assert.rejects(
      extractor.install(secondFixture.spec, [secondFixture.entry], new AbortController().signal),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'OPERATION_CONFLICT',
    );
    await drainSuccessfulWrites(store, firstFixture.chunks.length);
    await active;
    assert.equal(store.promotions, 1);
  });
});
