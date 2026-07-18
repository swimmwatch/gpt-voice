import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STREAMING_TRANSCRIPTION_IPC_CHANNELS,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';
import { MainStreamingTranscriptionRejection } from '@main/services/MainStreamingTranscriptionRejection';
import {
  StreamingTranscriptionIpcController,
  type StreamingTranscriptionIpcHandler,
} from '@main/streamingTranscriptionIpcController';
import type {
  CancelMainStreamingTranscriptionInput,
  FinishMainStreamingTranscriptionInput,
  MainStreamingTranscriptionService,
  SendMainStreamingTranscriptionChunkInput,
  StartMainStreamingTranscriptionInput,
} from '@main/services/streamingTranscription';

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

class FakeSender {
  destroyed = false;
  private readonly destroyedListeners = new Set<() => void>();

  addDestroyedListener(listener: () => void): void {
    this.destroyedListeners.add(listener);
  }

  removeDestroyedListener(listener: () => void): void {
    this.destroyedListeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    for (const listener of [...this.destroyedListeners]) listener();
  }

  get listenerCount(): number {
    return this.destroyedListeners.size;
  }
}

interface ServiceCalls {
  starts: StartMainStreamingTranscriptionInput[];
  chunks: SendMainStreamingTranscriptionChunkInput[];
  finishes: FinishMainStreamingTranscriptionInput[];
  cancels: CancelMainStreamingTranscriptionInput[];
  lifecycleCancellations: number;
}

interface Harness {
  controller: StreamingTranscriptionIpcController<FakeSender>;
  calls: ServiceCalls;
  handlers: Map<string, StreamingTranscriptionIpcHandler<FakeSender>>;
  invoke: (channel: string, sender: FakeSender, ...args: readonly unknown[]) => Promise<unknown>;
  mainSender: FakeSender | null;
  removedChannels: string[];
  runBrowserShutdownHook: () => Promise<void>;
}

function createHarness(overrides: Partial<MainStreamingTranscriptionService> = {}): Harness {
  const calls: ServiceCalls = {
    starts: [],
    chunks: [],
    finishes: [],
    cancels: [],
    lifecycleCancellations: 0,
  };
  const handlers = new Map<string, StreamingTranscriptionIpcHandler<FakeSender>>();
  const removedChannels: string[] = [];
  let browserShutdownHook: (() => Promise<void>) | null = null;
  const state: { mainSender: FakeSender | null } = { mainSender: new FakeSender() };
  const service: MainStreamingTranscriptionService = {
    async start(input) {
      calls.starts.push(input);
      return { operationId: OPERATION_ID, lifecycle: StreamingTranscriptionLifecycle.Starting };
    },
    async sendChunk(input) {
      calls.chunks.push(input);
      return {
        operationId: input.operationId,
        lifecycle: StreamingTranscriptionLifecycle.Streaming,
        acceptedSequence: typeof input.sequence === 'number' ? input.sequence : -1,
      };
    },
    async finish(input) {
      calls.finishes.push(input);
      return { success: true, lifecycle: StreamingTranscriptionLifecycle.Completed, text: 'recognized' };
    },
    async cancel(input) {
      calls.cancels.push(input);
      return { operationId: input.operationId, lifecycle: StreamingTranscriptionLifecycle.Cancelled };
    },
    async cancelActiveForLifecycle() {
      calls.lifecycleCancellations += 1;
    },
    ...overrides,
  };
  const controller = new StreamingTranscriptionIpcController<FakeSender>({
    addSenderDestroyedListener: (sender, listener) => sender.addDestroyedListener(listener),
    getMainWindowSender: () => state.mainSender,
    isSenderDestroyed: (sender) => sender.destroyed,
    registerBeforeBrowserShutdownHook: (hook) => {
      browserShutdownHook = hook;
      return () => {
        browserShutdownHook = null;
      };
    },
    registerHandler: (channel, handler) => handlers.set(channel, handler),
    removeHandler: (channel) => {
      removedChannels.push(channel);
      handlers.delete(channel);
    },
    removeSenderDestroyedListener: (sender, listener) => sender.removeDestroyedListener(listener),
    service,
  });
  return {
    controller,
    calls,
    handlers,
    invoke: async (channel, sender, ...args) => {
      const handler = handlers.get(channel);
      assert.ok(handler, `Missing handler for ${channel}`);
      return handler(sender, ...args);
    },
    get mainSender() {
      return state.mainSender;
    },
    set mainSender(sender: FakeSender | null) {
      state.mainSender = sender;
    },
    removedChannels,
    runBrowserShutdownHook: async () => {
      const hook = browserShutdownHook;
      assert.ok(hook);
      await hook();
    },
  };
}

function getMainSender(harness: Harness): FakeSender {
  const sender = harness.mainSender;
  assert.ok(sender);
  return sender;
}

describe('streaming transcription IPC controller', () => {
  it('registers four exact handlers and reuses one opaque owner for the current main window', async () => {
    const harness = createHarness();
    const sender = getMainSender(harness);

    assert.deepEqual([...harness.handlers.keys()], Object.values(STREAMING_TRANSCRIPTION_IPC_CHANNELS));
    assert.deepEqual(await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, sender), {
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Starting,
    });
    assert.deepEqual(
      await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk, sender, OPERATION_ID, 0, new Uint8Array(2)),
      {
        success: true,
        operationId: OPERATION_ID,
        lifecycle: StreamingTranscriptionLifecycle.Streaming,
        acceptedSequence: 0,
      },
    );
    await harness.invoke(
      STREAMING_TRANSCRIPTION_IPC_CHANNELS.finish,
      sender,
      OPERATION_ID,
      1,
      new Uint8Array(0),
      new ArrayBuffer(44),
    );
    assert.deepEqual(await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.cancel, sender, OPERATION_ID), {
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    });

    const owners = [
      harness.calls.starts[0].owner,
      harness.calls.chunks[0].owner,
      harness.calls.finishes[0].owner,
      harness.calls.cancels[0].owner,
    ];
    assert.equal(
      owners.every((owner) => owner === owners[0]),
      true,
    );
    assert.equal(sender.listenerCount, 1);
  });

  it('rejects settings, stale, missing, destroyed, and replaced main-window senders before service access', async () => {
    const harness = createHarness();
    const firstMain = getMainSender(harness);
    const settingsSender = new FakeSender();

    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, settingsSender));
    harness.mainSender = null;
    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, firstMain));
    harness.mainSender = firstMain;
    firstMain.destroyed = true;
    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, firstMain));
    firstMain.destroyed = false;
    await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, firstMain);

    const replacement = new FakeSender();
    harness.mainSender = replacement;
    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, firstMain));
    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, replacement));

    assert.equal(harness.calls.starts.length, 1);
  });

  it('rejects malformed operation IDs before service access', async () => {
    const harness = createHarness();
    const sender = getMainSender(harness);
    const malformedIds: unknown[] = [undefined, 1, 'not-a-uuid', '00000000-0000-4000-8000-00000000000A'];

    for (const malformedId of malformedIds) {
      const result = await harness.invoke(
        STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk,
        sender,
        malformedId,
        0,
        new Uint8Array(2),
      );
      assert.deepEqual(result, {
        success: false,
        error: {
          lifecycle: StreamingTranscriptionLifecycle.Failed,
          code: StreamingTranscriptionErrorCode.InvalidOperation,
        },
        retryEligible: false,
      });
    }
    assert.equal(harness.calls.chunks.length, 0);
  });

  it('forwards malformed sequence and audio values without copying so the service remains authoritative', async () => {
    const rejectedChunkInputs: SendMainStreamingTranscriptionChunkInput[] = [];
    const rejectedFinishInputs: FinishMainStreamingTranscriptionInput[] = [];
    const rejection = new MainStreamingTranscriptionRejection(
      {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.InvalidChunk,
      },
      true,
    );
    const harness = createHarness({
      async sendChunk(input) {
        rejectedChunkInputs.push(input);
        throw rejection;
      },
      async finish(input) {
        rejectedFinishInputs.push(input);
        throw rejection;
      },
    });
    const sender = getMainSender(harness);
    const oversized = new Uint8Array(2_732);
    const wrongWav = new Uint8Array(44);

    const sendResult = await harness.invoke(
      STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk,
      sender,
      OPERATION_ID,
      -1,
      oversized,
    );
    const finishResult = await harness.invoke(
      STREAMING_TRANSCRIPTION_IPC_CHANNELS.finish,
      sender,
      OPERATION_ID,
      0.5,
      new Uint8Array(1),
      wrongWav,
    );

    assert.equal(rejectedChunkInputs[0].chunk, oversized);
    assert.equal(rejectedFinishInputs[0].recordingWav, wrongWav);
    assert.deepEqual(sendResult, {
      success: false,
      error: rejection.error,
      retryEligible: true,
    });
    assert.deepEqual(finishResult, sendResult);
    assert.deepEqual(Object.keys(sendResult as object).sort(), ['error', 'retryEligible', 'success']);
  });

  it('maps unexpected service failures without exposing raw messages or metadata', async () => {
    const harness = createHarness({
      async start() {
        throw new Error('private provider output');
      },
    });

    const result = await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, getMainSender(harness));

    assert.deepEqual(result, {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Failed,
        code: StreamingTranscriptionErrorCode.TransportFailure,
      },
      retryEligible: false,
    });
    assert.equal(JSON.stringify(result).includes('private provider output'), false);
  });

  it('copies valid PCM and WAV values before service ownership', async () => {
    const harness = createHarness();
    const sender = getMainSender(harness);
    const chunk = new Uint8Array([1, 2]);
    const finalChunk = new Uint8Array([3, 4]);
    const wav = new Uint8Array([5, 6, 7, 8]).buffer;

    const sendPromise = harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk, sender, OPERATION_ID, 0, chunk);
    const finishPromise = harness.invoke(
      STREAMING_TRANSCRIPTION_IPC_CHANNELS.finish,
      sender,
      OPERATION_ID,
      1,
      finalChunk,
      wav,
    );
    chunk.fill(9);
    finalChunk.fill(9);
    new Uint8Array(wav).fill(9);
    await Promise.all([sendPromise, finishPromise]);

    assert.notEqual(harness.calls.chunks[0].chunk, chunk);
    assert.deepEqual(harness.calls.chunks[0].chunk, new Uint8Array([1, 2]));
    assert.notEqual(harness.calls.finishes[0].finalChunk, finalChunk);
    assert.deepEqual(harness.calls.finishes[0].finalChunk, new Uint8Array([3, 4]));
    assert.notEqual(harness.calls.finishes[0].recordingWav, wav);
    assert.deepEqual(
      new Uint8Array(harness.calls.finishes[0].recordingWav as ArrayBuffer),
      new Uint8Array([5, 6, 7, 8]),
    );
  });

  it('cancels on sender destruction and browser shutdown but not while the main window merely remains alive', async () => {
    const harness = createHarness();
    const sender = getMainSender(harness);
    await harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, sender);
    assert.equal(harness.calls.lifecycleCancellations, 0);

    await harness.runBrowserShutdownHook();
    assert.equal(harness.calls.lifecycleCancellations, 1);
    sender.destroy();
    await Promise.resolve();
    assert.equal(harness.calls.lifecycleCancellations, 2);
    assert.equal(sender.listenerCount, 0);
  });

  it('removes only its four handlers and cancels once across duplicate disposal', async () => {
    const harness = createHarness();
    const unrelatedHandler: StreamingTranscriptionIpcHandler<FakeSender> = async () => ({
      success: true,
      operationId: OPERATION_ID,
      lifecycle: StreamingTranscriptionLifecycle.Cancelled,
    });
    harness.handlers.set('unrelated', unrelatedHandler);

    await Promise.all([harness.controller.dispose(), harness.controller.dispose()]);

    assert.deepEqual(harness.removedChannels, Object.values(STREAMING_TRANSCRIPTION_IPC_CHANNELS));
    assert.equal(harness.handlers.get('unrelated'), unrelatedHandler);
    assert.equal(harness.calls.lifecycleCancellations, 1);
    await assert.rejects(harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, getMainSender(harness)));
  });

  it('suppresses a late successful provider start after sender destruction', async () => {
    const startDeferred = createDeferred<Awaited<ReturnType<MainStreamingTranscriptionService['start']>>>();
    const harness = createHarness({
      start: () => startDeferred.promise,
    });
    const sender = getMainSender(harness);
    const pending = harness.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start, sender);
    sender.destroy();
    startDeferred.resolve({ operationId: OPERATION_ID, lifecycle: StreamingTranscriptionLifecycle.Starting });

    assert.deepEqual(await pending, {
      success: false,
      error: {
        lifecycle: StreamingTranscriptionLifecycle.Cancelled,
        code: StreamingTranscriptionErrorCode.Cancelled,
      },
      retryEligible: false,
    });
    assert.equal(harness.calls.lifecycleCancellations, 1);
  });
});
