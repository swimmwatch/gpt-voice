import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  ARTIFACT_MAX_BUFFER_BYTES,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactStreamingWorker,
  type ArtifactWorkerProcessInput,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { ArtifactProgressStore } from '@main/localWhisper/artifacts/ArtifactProgressStore';
import { StreamingArtifactVerifier } from '@main/localWhisper/artifacts/StreamingArtifactVerifier';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { RealArtifactClock, createArtifactCatalogFixture } from './artifactTestUtils';

const SYNTHETIC_CHUNK_BYTES = 1024 * 1024;
const SYNTHETIC_TOTAL_BYTES = 2 * 1024 * 1024 * 1024 + SYNTHETIC_CHUNK_BYTES;

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
}

async function* generatedMultiGiBStream(): AsyncIterable<Uint8Array> {
  const reusableChunk = new Uint8Array(SYNTHETIC_CHUNK_BYTES);
  const chunks = SYNTHETIC_TOTAL_BYTES / SYNTHETIC_CHUNK_BYTES;
  for (let index = 0; index < chunks; index += 1) {
    yield reusableChunk;
    if (index % 64 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe('Task 05 streaming bounds', () => {
  test('processes a generated multi-GiB stream with bounded peak memory and a responsive heartbeat', async () => {
    const fixture = createArtifactCatalogFixture();
    const spec = Object.freeze({
      ...fixture.model,
      expectedTransferSizeBytes: SYNTHETIC_TOTAL_BYTES,
    });
    let observedChunks = 0;
    let heartbeat = 0;
    const worker: ArtifactStreamingWorker = {
      process: async (input: ArtifactWorkerProcessInput) => {
        let receivedBytes = 0;
        let peakBufferedBytes = 0;
        for await (const chunk of input.stream) {
          observedChunks += 1;
          receivedBytes += chunk.byteLength;
          peakBufferedBytes = Math.max(peakBufferedBytes, chunk.byteLength);
        }
        return {
          entries: [],
          peakBufferedBytes,
          receivedBytes,
          spoolId: input.operationId,
          transferSha256: spec.expectedTransferSha256,
        };
      },
      cancel: async () => undefined,
      terminate: async () => undefined,
      discard: async () => undefined,
    };
    const heartbeatTimer = setInterval(() => {
      heartbeat += 1;
    }, 0);
    try {
      const result = await new StreamingArtifactVerifier({
        clock: new RealArtifactClock(),
        signatureVerifier: { verify: async () => true },
        worker,
      }).verify({
        operationId: 'synthetic-stream-operation-000001',
        spec,
        transport: {
          body: generatedMultiGiBStream(),
          expectedCompleteLength: SYNTHETIC_TOTAL_BYTES,
          resumeOffset: 0,
          validator: '"synthetic-etag"',
          dispose: async () => undefined,
        },
        resume: null,
        signal: new AbortController().signal,
        onProgress: async () => undefined,
      });
      assert.equal(result.receivedBytes, SYNTHETIC_TOTAL_BYTES);
      assert.equal(result.peakBufferedBytes, SYNTHETIC_CHUNK_BYTES);
      assert.ok(result.peakBufferedBytes <= ARTIFACT_MAX_BUFFER_BYTES);
      assert.ok(observedChunks > 2_000);
      assert.ok(heartbeat > 0);
    } finally {
      clearInterval(heartbeatTimer);
    }
  });

  test('terminates a cancellation-insensitive worker at the exact five-second bound', async () => {
    const fixture = createArtifactCatalogFixture();
    const clock = new ManualClock();
    let cancellations = 0;
    let terminations = 0;
    const worker: ArtifactStreamingWorker = {
      process: async () => await new Promise(() => undefined),
      cancel: async () => {
        cancellations += 1;
        await new Promise(() => undefined);
      },
      terminate: async () => {
        terminations += 1;
      },
      discard: async () => undefined,
    };
    const controller = new AbortController();
    const verification = new StreamingArtifactVerifier({
      clock,
      signatureVerifier: { verify: async () => true },
      worker,
    }).verify({
      operationId: 'hung-helper-operation-00000001',
      spec: fixture.model,
      transport: {
        body: generatedMultiGiBStream(),
        expectedCompleteLength: fixture.model.expectedTransferSizeBytes,
        resumeOffset: 0,
        validator: '"hung-etag"',
        dispose: async () => undefined,
      },
      resume: null,
      signal: controller.signal,
      onProgress: async () => undefined,
    });
    controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(cancellations, 1);
    clock.advance(ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS - 1);
    await Promise.resolve();
    assert.equal(terminations, 0);
    clock.advance(1);
    await assert.rejects(
      verification,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'DOWNLOAD_CANCELLED',
    );
    assert.equal(terminations, 1);
  });

  test('keeps progress immutable and rate-limits non-terminal chunk updates', () => {
    const clock = new ManualClock();
    const progress = new ArtifactProgressStore(clock);
    const artifact = toLocalWhisperArtifactId('progress-artifact');
    assert.ok(artifact);
    const initial = progress.publish({
      operationId: 'progress-operation-00000001',
      artifactId: artifact,
      action: 'download',
      state: 'Downloading',
      receivedBytes: 1,
      totalBytes: 10,
    });
    const limited = progress.publish({
      operationId: initial.operationId,
      artifactId: artifact,
      action: 'download',
      state: 'Downloading',
      receivedBytes: 2,
      totalBytes: 10,
    });
    assert.equal(limited, initial);
    clock.advance(100);
    const published = progress.publish({
      operationId: initial.operationId,
      artifactId: artifact,
      action: 'download',
      state: 'Downloading',
      receivedBytes: 3,
      totalBytes: 10,
    });
    assert.notEqual(published, initial);
    assert.equal(published.receivedBytes, 3);
    assert.equal(Object.isFrozen(published), true);
    assert.equal(Object.isFrozen(progress.list()), true);
  });
});
