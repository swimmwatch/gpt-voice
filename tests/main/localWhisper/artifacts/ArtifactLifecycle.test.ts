import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  LocalWhisperArtifactLifecycleError,
  type ArtifactWorkerProcessInput,
  type ArtifactWorkerProcessResult,
  type LocalWhisperArtifactOperationResult,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import {
  ArtifactTransferQueue,
  type ArtifactTransferQueueTask,
} from '@main/localWhisper/artifacts/ArtifactTransferQueue';
import { ManagedArtifactRemovalClearanceIssuer } from '@main/localWhisper/filesystem/ManagedArtifactRemovalClearanceIssuer';
import {
  createLocalWhisperRendererSafeFailure,
  toLocalWhisperArtifactId,
  type LocalWhisperArtifactId,
  type LocalWhisperFailureCode,
} from '@shared/localWhisper';
import {
  MODEL_TRANSFER,
  STRONG_ETAG,
  FixtureStreamingArtifactWorker,
  RecordingArtifactHttpClient,
  createArtifactServiceHarness,
  sha256,
} from './artifactTestUtils';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let reject: (error: unknown) => void = () => undefined;
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((_resolve, _reject) => {
    reject = _reject;
    resolve = _resolve;
  });
  return { promise, reject, resolve };
}

function artifactId(value: string): LocalWhisperArtifactId {
  const parsed = toLocalWhisperArtifactId(value);
  assert.ok(parsed);
  return parsed;
}

function assertFailure(
  result: LocalWhisperArtifactOperationResult,
  code: LocalWhisperFailureCode,
  state: 'Cancelled' | 'Failed' | 'Resumable',
): void {
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.state, state);
  assert.equal(result.error.code, code);
  assert.equal(Object.isFrozen(result.error), true);
}

async function* emptyStream(): AsyncIterable<Uint8Array> {
  for (const chunk of [] as Uint8Array[]) yield chunk;
}

class BlockingArtifactWorker extends FixtureStreamingArtifactWorker {
  public readonly started = deferred<void>();
  private readonly blocked = deferred<ArtifactWorkerProcessResult>();

  public override async process(_input: ArtifactWorkerProcessInput): Promise<ArtifactWorkerProcessResult> {
    this.started.resolve();
    return await this.blocked.promise;
  }

  public override async cancel(operationId: string): Promise<void> {
    await super.cancel(operationId);
    this.blocked.reject(new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED'));
  }
}

function queueSuccess(operationId: string, artifact: LocalWhisperArtifactId): LocalWhisperArtifactOperationResult {
  return Object.freeze({
    success: true,
    operationId,
    artifactId: artifact,
    state: 'Installed',
    inventoryRevision: 1,
  });
}

describe('LocalWhisperArtifactService lifecycle', () => {
  test('batches durable journal writes while retaining renderer progress for a large transfer', async () => {
    const transfer = Buffer.alloc(10 * 1024 * 1024, 0x51);
    const harness = createArtifactServiceHarness({ modelTransfer: transfer, transferChunkBytes: 64 * 1024 });

    const result = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;

    assert.equal(result.success, true);
    assert.ok(harness.journalStore.writes <= 4);
    assert.equal(harness.progress.get(result.operationId)?.receivedBytes, transfer.byteLength);
  });

  test('installs exact signed model and runtime revisions and refreshes inventory', async () => {
    const harness = createArtifactServiceHarness();
    const model = harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    });
    const modelResult = await model.completion;
    assert.deepEqual(modelResult, {
      success: true,
      operationId: model.operationId,
      artifactId: harness.catalogFixture.model.artifactId,
      state: 'Installed',
      inventoryRevision: 2,
    });

    const runtime = harness.service.startDownload({
      artifactId: harness.catalogFixture.runtime.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    });
    const runtimeResult = await runtime.completion;
    assert.equal(runtimeResult.success, true);
    assert.deepEqual(
      harness.store.installed,
      new Set([harness.catalogFixture.model.artifactId, harness.catalogFixture.runtime.artifactId]),
    );
    assert.equal(harness.store.promotions, 2);
    assert.equal(harness.inventory.revision, 3);
    assert.equal(harness.signatureVerifier.calls.length, 2);
    assert.equal(harness.signatureVerifier.calls[0].digest, harness.catalogFixture.model.expectedTransferSha256);
    assert.equal(harness.signatureVerifier.calls[1].digest, harness.catalogFixture.runtime.expectedTransferSha256);
    const snapshot = harness.progress.get(runtime.operationId);
    assert.equal(snapshot?.state, 'Installed');
    assert.equal(Object.isFrozen(snapshot), true);
  });

  test('keeps installed siblings unchanged across length, hash, and signature failures', async () => {
    const lengthClient = new RecordingArtifactHttpClient(async () => ({
      status: 200,
      body: emptyStream(),
      headers: {
        contentLength: MODEL_TRANSFER.byteLength,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
    }));
    const lengthHarness = createArtifactServiceHarness({ client: lengthClient });
    lengthHarness.store.installed.add(lengthHarness.catalogFixture.runtime.artifactId);
    const length = await lengthHarness.service.startDownload({
      artifactId: lengthHarness.catalogFixture.model.artifactId,
      expectedInventoryRevision: lengthHarness.inventory.revision,
    }).completion;
    assertFailure(length, 'DOWNLOAD_FAILED', 'Failed');
    if (!length.success) {
      assert.equal(length.error.retryable, true);
      assert.equal(length.error.recoveryAction, 'retry-download');
    }
    assert.deepEqual(lengthHarness.store.installed, new Set([lengthHarness.catalogFixture.runtime.artifactId]));

    const hashHarness = createArtifactServiceHarness();
    hashHarness.store.installed.add(hashHarness.catalogFixture.runtime.artifactId);
    const hashFixture = hashHarness.worker.fixtures.get(hashHarness.catalogFixture.model.artifactId);
    assert.ok(hashFixture);
    hashHarness.worker.fixtures.set(hashHarness.catalogFixture.model.artifactId, {
      ...hashFixture,
      transferSha256: sha256(Buffer.from('wrong transfer object')),
    });
    const hash = await hashHarness.service.startDownload({
      artifactId: hashHarness.catalogFixture.model.artifactId,
      expectedInventoryRevision: hashHarness.inventory.revision,
    }).completion;
    assertFailure(hash, 'HASH_MISMATCH', 'Failed');
    if (!hash.success) {
      assert.equal(hash.error.retryable, false);
      assert.equal(hash.error.recoveryAction, 'discard-and-fetch-trusted-revision');
    }
    assert.deepEqual(hashHarness.store.installed, new Set([hashHarness.catalogFixture.runtime.artifactId]));
    hashHarness.worker.fixtures.set(hashHarness.catalogFixture.model.artifactId, hashFixture);
    const retried = await hashHarness.service.retry({
      artifactId: hashHarness.catalogFixture.model.artifactId,
      expectedInventoryRevision: hashHarness.inventory.revision,
    }).completion;
    assert.equal(retried.success, true);
    assert.equal(hashHarness.client.requests.length, 2);

    const signatureHarness = createArtifactServiceHarness();
    signatureHarness.store.installed.add(signatureHarness.catalogFixture.model.artifactId);
    signatureHarness.signatureVerifier.valid = false;
    const signature = await signatureHarness.service.startDownload({
      artifactId: signatureHarness.catalogFixture.runtime.artifactId,
      expectedInventoryRevision: signatureHarness.inventory.revision,
    }).completion;
    assertFailure(signature, 'SIGNATURE_INVALID', 'Failed');
    assert.deepEqual(signatureHarness.store.installed, new Set([signatureHarness.catalogFixture.model.artifactId]));
    assert.equal(signatureHarness.store.promotions, 0);
  });

  test('rejects absent artifact IDs and stale inventory epochs before privileged effects', async () => {
    const harness = createArtifactServiceHarness();
    const absent = await harness.service.startDownload({
      artifactId: artifactId('forged-but-well-formed-artifact'),
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(absent, 'INVALID_SETTINGS', 'Failed');

    const stale = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision + 1,
    }).completion;
    assertFailure(stale, 'STALE_CONFIGURATION', 'Failed');
    assert.equal(harness.client.requests.length, 0);
    assert.equal(harness.journalStore.values.size, 0);
    assert.equal(harness.store.promotions, 0);
  });

  test('resumes only the exact offset with the original strong ETag and verifies the complete spool', async () => {
    const prefixLength = 7;
    const client = new RecordingArtifactHttpClient(async (request) => ({
      status: request.rangeStart === null ? 200 : 206,
      body: (async function* (): AsyncIterable<Uint8Array> {
        const start = request.rangeStart ?? 0;
        if (start === 0) {
          yield Uint8Array.from(MODEL_TRANSFER.subarray(0, prefixLength));
          yield Uint8Array.from(MODEL_TRANSFER.subarray(prefixLength));
          return;
        }
        yield Uint8Array.from(MODEL_TRANSFER.subarray(start));
      })(),
      headers: {
        acceptRanges: 'bytes',
        contentLength: MODEL_TRANSFER.byteLength - (request.rangeStart ?? 0),
        contentRange:
          request.rangeStart === null
            ? null
            : `bytes ${request.rangeStart}-${MODEL_TRANSFER.byteLength - 1}/${MODEL_TRANSFER.byteLength}`,
        etag: STRONG_ETAG,
        location: null,
      },
    }));
    const harness = createArtifactServiceHarness({ client });
    const fixture = harness.worker.fixtures.get(harness.catalogFixture.model.artifactId);
    assert.ok(fixture);
    harness.worker.fixtures.set(harness.catalogFixture.model.artifactId, {
      ...fixture,
      failAfterBytes: prefixLength,
      failureCode: 'DOWNLOAD_OFFLINE',
    });

    const interrupted = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(interrupted, 'DOWNLOAD_OFFLINE', 'Resumable');
    const journal = harness.journalStore.values.get(harness.catalogFixture.model.artifactId) as {
      readonly receivedLength: number;
      readonly serverValidator: string;
      readonly state: string;
    };
    assert.equal(journal.receivedLength, prefixLength);
    assert.equal(journal.serverValidator, STRONG_ETAG);
    assert.equal(journal.state, 'Resumable');

    harness.worker.fixtures.set(harness.catalogFixture.model.artifactId, {
      ...fixture,
      failAfterBytes: undefined,
    });
    const restarted = createArtifactServiceHarness({
      client,
      journalStore: harness.journalStore,
      worker: harness.worker,
    });
    const resumed = await restarted.service.resume({
      artifactId: restarted.catalogFixture.model.artifactId,
      expectedInventoryRevision: restarted.inventory.revision,
    }).completion;
    assert.equal(resumed.success, true);
    assert.equal(client.requests.length, 2);
    assert.equal(client.requests[1].rangeStart, prefixLength);
    assert.equal(client.requests[1].ifRange, STRONG_ETAG);
    assert.equal(restarted.journalStore.values.has(restarted.catalogFixture.model.artifactId), false);
    assert.equal(restarted.store.installed.has(restarted.catalogFixture.model.artifactId), true);
  });

  test('rejects a changed resume ETag, discards only that spool, and preserves installed siblings', async () => {
    const prefixLength = 5;
    const client = new RecordingArtifactHttpClient(async (request) => ({
      status: request.rangeStart === null ? 200 : 206,
      body: (async function* (): AsyncIterable<Uint8Array> {
        yield Uint8Array.from(MODEL_TRANSFER.subarray(request.rangeStart ?? 0, prefixLength));
      })(),
      headers: {
        contentLength: MODEL_TRANSFER.byteLength - (request.rangeStart ?? 0),
        contentRange:
          request.rangeStart === null
            ? null
            : `bytes ${request.rangeStart}-${MODEL_TRANSFER.byteLength - 1}/${MODEL_TRANSFER.byteLength}`,
        etag: request.rangeStart === null ? STRONG_ETAG : '"changed-etag"',
        location: null,
      },
    }));
    const harness = createArtifactServiceHarness({ client });
    harness.store.installed.add(harness.catalogFixture.runtime.artifactId);
    const fixture = harness.worker.fixtures.get(harness.catalogFixture.model.artifactId);
    assert.ok(fixture);
    harness.worker.fixtures.set(harness.catalogFixture.model.artifactId, {
      ...fixture,
      failAfterBytes: prefixLength,
      failureCode: 'DOWNLOAD_FAILED',
    });
    const interrupted = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(interrupted, 'DOWNLOAD_FAILED', 'Resumable');

    const rejected = await harness.service.resume({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(rejected, 'RESUME_INVALID', 'Failed');
    assert.deepEqual(harness.store.installed, new Set([harness.catalogFixture.runtime.artifactId]));
    assert.equal(harness.journalStore.values.size, 0);
    assert.equal(harness.worker.spools.size, 0);
    assert.equal(harness.store.promotions, 0);
  });

  test('cancels an active operation and rejects a duplicate artifact without promotion', async () => {
    const worker = new BlockingArtifactWorker();
    const harness = createArtifactServiceHarness({ worker });
    const first = harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    });
    await worker.started.promise;

    const duplicate = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(duplicate, 'OPERATION_CONFLICT', 'Failed');
    assert.equal(harness.service.cancel(first.operationId), true);
    const cancelled = await first.completion;
    assertFailure(cancelled, 'DOWNLOAD_CANCELLED', 'Cancelled');
    assert.deepEqual(worker.cancelled, [first.operationId]);
    assert.equal(harness.client.requests[0].signal.aborted, true);
    assert.equal(harness.store.promotions, 0);
    assert.equal(harness.journalStore.values.size, 0);
  });

  test('fails disk preflight before HTTP and leaves no transfer state', async () => {
    const harness = createArtifactServiceHarness();
    harness.disk.freeBytes = 0;
    const result = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assertFailure(result, 'INSUFFICIENT_DISK', 'Failed');
    assert.equal(harness.client.requests.length, 0);
    assert.equal(harness.journalStore.values.size, 0);
    assert.equal(harness.store.promotions, 0);
  });

  test('requires exact coordinator clearance for removal and never selects a fallback', async () => {
    const harness = createArtifactServiceHarness();
    const installed = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;
    assert.equal(installed.success, true);
    const issuer = new ManagedArtifactRemovalClearanceIssuer();

    const denied = await harness.service.remove({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
      clearance: issuer.issue(harness.catalogFixture.runtime.artifactId),
    });
    assertFailure(denied, 'DELETE_FAILED', 'Failed');
    assert.equal(harness.store.installed.has(harness.catalogFixture.model.artifactId), true);
    assert.equal(harness.inventory.revision, 3);

    const removed = await harness.service.remove({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
      clearance: issuer.issue(harness.catalogFixture.model.artifactId),
    });
    assert.equal(removed.success, true);
    assert.equal(removed.state, 'Missing');
    assert.equal(harness.store.installed.size, 0);
    assert.equal(harness.store.deletions, 1);
  });
});

describe('ArtifactTransferQueue concurrency', () => {
  test('runs at most two transfers, publishes visible FIFO positions, and cancels queued work', async () => {
    const queue = new ArtifactTransferQueue();
    const gates = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()];
    const starts: string[] = [];
    const positions = new Map<string, number[]>();
    const tasks = gates.map((gate, index): ArtifactTransferQueueTask => {
      const operationId = `queue-operation-${String(index + 1).padStart(16, '0')}`;
      const id = artifactId(`queue-artifact-${index + 1}`);
      return {
        operationId,
        artifactId: id,
        run: async () => {
          starts.push(operationId);
          await gate.promise;
          return queueSuccess(operationId, id);
        },
        cancelledBeforeStart: () => ({
          success: false,
          operationId,
          artifactId: id,
          state: 'Cancelled',
          error: createLocalWhisperRendererSafeFailure('DOWNLOAD_CANCELLED', { artifactId: id }),
        }),
        onQueued: (position) => positions.set(operationId, [...(positions.get(operationId) ?? []), position]),
        onStarted: () => undefined,
      };
    });
    const completions = tasks.map((task) => queue.enqueue(task));
    assert.equal(queue.activeCount, 2);
    assert.equal(queue.queuedCount, 2);
    assert.deepEqual(starts, [tasks[0].operationId, tasks[1].operationId]);
    const thirdPositions = positions.get(tasks[2].operationId);
    const fourthPositions = positions.get(tasks[3].operationId);
    assert.ok(thirdPositions);
    assert.ok(fourthPositions);
    assert.equal(thirdPositions[thirdPositions.length - 1], 1);
    assert.equal(fourthPositions[fourthPositions.length - 1], 2);

    assert.equal(queue.cancel(tasks[3].operationId), true);
    assertFailure(await completions[3], 'DOWNLOAD_CANCELLED', 'Cancelled');
    assert.equal(starts.includes(tasks[3].operationId), false);
    gates[0].resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(starts, [tasks[0].operationId, tasks[1].operationId, tasks[2].operationId]);
    assert.equal(queue.activeCount, 2);
    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(completions.slice(0, 3));
    assert.equal(queue.activeCount, 0);
  });
});
