import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES,
  MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES,
  STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type FinishStreamingTranscriptionIpcResult,
  type SendStreamingTranscriptionChunkIpcResult,
  type StartStreamingTranscriptionIpcResult,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';
import {
  StreamingRecordingLocalErrorCode,
  StreamingTranscriptionQueue,
  type StreamingRecordingFailure,
  type StreamingTranscriptionQueueScheduler,
  type StreamingTranscriptionRendererClient,
} from '@renderer/audio/streamingTranscriptionQueue';

const OPERATION_ID = '00000000-0000-4000-8000-000000000001' as StreamingTranscriptionOperationId;

function createDeferred<Value>(): { promise: Promise<Value>; resolve: (value: Value) => void } {
  let settle = (_value: Value): void => {
    throw new Error('Deferred promise was not initialized');
  };
  const promise = new Promise<Value>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
}

class TestScheduler implements StreamingTranscriptionQueueScheduler {
  currentTime = 0;
  readonly waits: number[] = [];

  now(): number {
    return this.currentTime;
  }

  wait(durationMs: number): Promise<void> {
    this.waits.push(durationMs);
    this.currentTime += durationMs;
    return Promise.resolve();
  }
}

interface ClientCalls {
  cancels: StreamingTranscriptionOperationId[];
  finishes: Array<{
    finalChunk: Uint8Array;
    operationId: StreamingTranscriptionOperationId;
    recordingWav: ArrayBuffer;
    sequence: number;
  }>;
  sends: Array<{
    chunk: Uint8Array;
    operationId: StreamingTranscriptionOperationId;
    sequence: number;
    startedAt: number;
  }>;
  starts: number;
}

interface QueueHarness {
  calls: ClientCalls;
  failures: StreamingRecordingFailure[];
  queue: StreamingTranscriptionQueue;
  scheduler: TestScheduler;
  start: ReturnType<typeof createDeferred<StartStreamingTranscriptionIpcResult>>;
}

function createQueueHarness(overrides: Partial<StreamingTranscriptionRendererClient> = {}): QueueHarness {
  const scheduler = new TestScheduler();
  const start = createDeferred<StartStreamingTranscriptionIpcResult>();
  const calls: ClientCalls = { cancels: [], finishes: [], sends: [], starts: 0 };
  const failures: StreamingRecordingFailure[] = [];
  const client: StreamingTranscriptionRendererClient = {
    async startStreamingTranscription() {
      calls.starts += 1;
      return start.promise;
    },
    async sendStreamingTranscriptionChunk(operationId, sequence, chunk) {
      calls.sends.push({ chunk: chunk.slice(), operationId, sequence, startedAt: scheduler.now() });
      return {
        success: true,
        operationId,
        lifecycle: StreamingTranscriptionLifecycle.Streaming,
        acceptedSequence: sequence,
      };
    },
    async finishStreamingTranscription(operationId, sequence, finalChunk, recordingWav) {
      calls.finishes.push({
        finalChunk: finalChunk.slice(),
        operationId,
        recordingWav: recordingWav.slice(0),
        sequence,
      });
      return { success: true, lifecycle: StreamingTranscriptionLifecycle.Completed, text: 'recognized' };
    },
    async cancelStreamingTranscription(operationId) {
      calls.cancels.push(operationId);
      return { success: true, operationId, lifecycle: StreamingTranscriptionLifecycle.Cancelled };
    },
    ...overrides,
  };
  return {
    calls,
    failures,
    queue: new StreamingTranscriptionQueue({ client, onFailure: (failure) => failures.push(failure), scheduler }),
    scheduler,
    start,
  };
}

function createFrame(fill: number): Uint8Array {
  return new Uint8Array(MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES).fill(fill);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushAsyncTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('streaming transcription renderer queue', () => {
  it('buffers before start, copies frames, and paces serialized sends by their start timestamps', async () => {
    const sendDurations = [20, 100, 0];
    let inFlight = 0;
    let maxInFlight = 0;
    const harness = createQueueHarness({
      async sendStreamingTranscriptionChunk(operationId, sequence, chunk) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        harness.calls.sends.push({ chunk: chunk.slice(), operationId, sequence, startedAt: harness.scheduler.now() });
        harness.scheduler.currentTime += sendDurations[sequence] ?? 0;
        inFlight -= 1;
        return {
          success: true,
          operationId,
          lifecycle: StreamingTranscriptionLifecycle.Streaming,
          acceptedSequence: sequence,
        };
      },
    });
    const firstFrame = createFrame(1);

    assert.equal(harness.queue.enqueueFrame(firstFrame), true);
    assert.equal(harness.queue.enqueueFrame(createFrame(2)), true);
    assert.equal(harness.queue.enqueueFrame(createFrame(3)), true);
    firstFrame.fill(9);
    assert.equal(harness.calls.sends.length, 0);

    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));

    assert.equal(result.success, true);
    assert.equal(maxInFlight, 1);
    assert.deepEqual(
      harness.calls.sends.map(({ sequence, startedAt }) => ({ sequence, startedAt })),
      [
        { sequence: 0, startedAt: 0 },
        { sequence: 1, startedAt: STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS },
        { sequence: 2, startedAt: STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS + 100 },
      ],
    );
    assert.equal(harness.calls.sends[0]?.chunk[0], 1);
    assert.equal(harness.scheduler.waits.length, 1);
    assert.ok(Math.abs(harness.scheduler.waits[0] - (STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS - 20)) < 1e-9);
  });

  it('allows exactly 64 pending frames and makes overflow retryable without sending backlog', async () => {
    const harness = createQueueHarness();

    for (let index = 0; index < MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES; index += 1) {
      assert.equal(harness.queue.enqueueFrame(createFrame(index)), true);
    }
    assert.equal(harness.queue.enqueueFrame(createFrame(255)), false);
    assert.deepEqual(harness.failures, [
      {
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.QueueOverflow,
        retryEligible: true,
      },
    ]);

    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await harness.queue.cancel();

    assert.equal(harness.calls.sends.length, 0);
    assert.deepEqual(harness.calls.cancels, [OPERATION_ID]);
  });

  it('never starts a later send before the preceding IPC call completes', async () => {
    const firstSend = createDeferred<SendStreamingTranscriptionChunkIpcResult>();
    const secondSend = createDeferred<SendStreamingTranscriptionChunkIpcResult>();
    const harness = createQueueHarness({
      sendStreamingTranscriptionChunk(operationId, sequence, chunk) {
        harness.calls.sends.push({ chunk: chunk.slice(), operationId, sequence, startedAt: harness.scheduler.now() });
        return sequence === 0 ? firstSend.promise : secondSend.promise;
      },
    });
    harness.queue.enqueueFrame(createFrame(1));
    harness.queue.enqueueFrame(createFrame(2));
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await flushAsyncTurn();
    assert.equal(harness.calls.sends.length, 1);

    firstSend.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Streaming,
      acceptedSequence: 0,
    });
    await flushAsyncTurn();
    assert.equal(harness.calls.sends.length, 2);

    secondSend.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Streaming,
      acceptedSequence: 1,
    });
    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));
    assert.equal(result.success, true);
  });

  it('supports Stop before start resolves and forwards copied final audio after the queue drains', async () => {
    const harness = createQueueHarness();
    const finalChunk = new Uint8Array([1, 2]);
    const recordingWav = new Uint8Array([3, 4, 5, 6]).buffer;
    harness.queue.enqueueFrame(createFrame(7));
    const finishPromise = harness.queue.finish(finalChunk, recordingWav);
    finalChunk.fill(9);
    new Uint8Array(recordingWav).fill(9);
    await flushMicrotasks();
    assert.equal(harness.calls.finishes.length, 0);

    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    const result = await finishPromise;

    assert.equal(result.success, true);
    assert.equal(harness.calls.finishes.length, 1);
    assert.equal(harness.calls.finishes[0]?.sequence, 1);
    assert.deepEqual(harness.calls.finishes[0]?.finalChunk, new Uint8Array([1, 2]));
    assert.deepEqual(
      new Uint8Array(harness.calls.finishes[0]?.recordingWav ?? new ArrayBuffer(0)),
      new Uint8Array([3, 4, 5, 6]),
    );
  });

  it('cancels a late start result and discards pending audio', async () => {
    const harness = createQueueHarness();
    harness.queue.enqueueFrame(createFrame(1));
    const cancelPromise = harness.queue.cancel();

    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    await cancelPromise;

    assert.deepEqual(harness.calls.cancels, [OPERATION_ID]);
    assert.equal(harness.calls.sends.length, 0);
    assert.deepEqual(harness.failures, []);
  });

  it('terminates once on send failure and preserves typed retry eligibility', async () => {
    const failureResult: SendStreamingTranscriptionChunkIpcResult = {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.TransportFailure,
      },
      retryEligible: true,
    };
    const harness = createQueueHarness({
      async sendStreamingTranscriptionChunk() {
        return failureResult;
      },
    });
    harness.queue.enqueueFrame(createFrame(1));
    harness.queue.enqueueFrame(createFrame(2));
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });

    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));
    await flushMicrotasks();

    assert.deepEqual(result, failureResult);
    assert.deepEqual(harness.failures, [{ kind: 'ipc', error: failureResult.error, retryEligible: true }]);
    assert.equal(harness.calls.cancels.length, 1);
  });

  it('rejects mismatched acknowledgements as a retryable transport failure', async () => {
    const harness = createQueueHarness({
      async sendStreamingTranscriptionChunk(operationId) {
        return {
          success: true,
          operationId,
          lifecycle: StreamingTranscriptionLifecycle.Streaming,
          acceptedSequence: 99,
        };
      },
    });
    harness.queue.enqueueFrame(createFrame(1));
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });

    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));

    assert.deepEqual(result, {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.TransportFailure,
      },
      retryEligible: true,
    });
    assert.equal(harness.failures.length, 1);
  });

  it('preserves a start failure without attempting audio or cancellation', async () => {
    const harness = createQueueHarness();
    const startFailure: StartStreamingTranscriptionIpcResult = {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.InvalidOperation,
      },
      retryEligible: false,
    };
    harness.queue.enqueueFrame(createFrame(1));
    harness.start.resolve(startFailure);

    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));

    assert.deepEqual(result, startFailure);
    assert.deepEqual(harness.failures, [{ kind: 'ipc', error: startFailure.error, retryEligible: false }]);
    assert.equal(harness.calls.sends.length, 0);
    assert.equal(harness.calls.cancels.length, 0);
  });

  it('returns finish failures to the Stop owner without firing a duplicate asynchronous callback', async () => {
    const finishFailure: FinishStreamingTranscriptionIpcResult = {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.TransportFailure,
      },
      retryEligible: true,
    };
    const harness = createQueueHarness({
      async finishStreamingTranscription() {
        return finishFailure;
      },
    });
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });

    assert.deepEqual(await harness.queue.finish(new Uint8Array([1, 2]), new ArrayBuffer(46)), finishFailure);
    assert.deepEqual(harness.failures, []);
  });

  it('rejects invalid capture frames without leaking operation state', async () => {
    const harness = createQueueHarness();
    assert.equal(harness.queue.enqueueFrame(new Uint8Array(2)), false);
    assert.deepEqual(harness.failures, [
      {
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.InvalidAudio,
        retryEligible: false,
      },
    ]);
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    const result = await harness.queue.finish(new Uint8Array(), new ArrayBuffer(44));

    assert.equal(result.success, false);
    assert.equal(harness.calls.sends.length, 0);
    assert.equal(harness.calls.finishes.length, 0);
  });

  it('returns final-only completion without a chunk send', async () => {
    const harness = createQueueHarness();
    harness.start.resolve({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    const result: FinishStreamingTranscriptionIpcResult = await harness.queue.finish(
      new Uint8Array([1, 2]),
      new ArrayBuffer(46),
    );

    assert.equal(result.success, true);
    assert.equal(harness.calls.sends.length, 0);
    assert.equal(harness.calls.finishes[0]?.sequence, 0);
  });
});
