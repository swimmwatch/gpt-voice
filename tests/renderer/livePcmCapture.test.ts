import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { LivePcmCaptureSession, type LivePcmCaptureResources } from '@renderer/audio/livePcmCaptureSession';
import { LIVE_PCM_FRAME_BYTES, PCM16_WAV_HEADER_BYTES, concatenatePcmChunks } from '@renderer/audio/pcm16';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const WORKLET_PATH = path.join(PROJECT_ROOT, 'src/renderer/audio/livePcmCapture.worklet.js');
const PROCESSOR_NAME = 'gpt-voice-live-pcm-capture';

interface ResourceHarness {
  closeCalls: number;
  disconnectCalls: number;
  emit(message: unknown): void;
  getLateHandler(): ((message: unknown) => void) | null;
  resources: LivePcmCaptureResources;
  stopTrackCalls: number;
}

function createResourceHarness(inputSampleRate = 16_000): ResourceHarness {
  let handler: ((message: unknown) => void) | null = null;
  let lateHandler: ((message: unknown) => void) | null = null;
  const harness: ResourceHarness = {
    closeCalls: 0,
    disconnectCalls: 0,
    emit: (message) => handler?.(message),
    getLateHandler: () => lateHandler,
    resources: {
      inputSampleRate,
      close: () => {
        harness.closeCalls += 1;
        return Promise.resolve();
      },
      disconnect: () => {
        harness.disconnectCalls += 1;
      },
      setMessageHandler: (nextHandler) => {
        if (nextHandler) lateHandler = nextHandler;
        handler = nextHandler;
      },
      stopTracks: () => {
        harness.stopTrackCalls += 1;
      },
    },
    stopTrackCalls: 0,
  };
  return harness;
}

describe('live PCM capture session', () => {
  it('streams frames, excludes paused messages, and releases resources on finish', async () => {
    const harness = createResourceHarness();
    const frames: Uint8Array[] = [];
    const session = new LivePcmCaptureSession(harness.resources, {
      onFrame: (frame) => frames.push(frame.slice()),
    });
    const first = Float32Array.from({ length: 1_001 }, (_, index) => Math.sin(index / 17));
    const paused = new Float32Array(801).fill(1);
    const last = Float32Array.from({ length: 1_003 }, (_, index) => Math.cos(index / 21));

    harness.emit({ type: 'samples', channels: [first] });
    session.pause();
    harness.emit({ type: 'samples', channels: [paused] });
    session.resume();
    harness.emit({ type: 'samples', channels: [last] });
    harness.emit({ type: 'unknown', channels: [new Float32Array([1])] });
    const lateHandler = harness.getLateHandler();
    const result = await session.finish();
    const frameCountAfterFinish = frames.length;
    lateHandler?.({ type: 'samples', channels: [new Float32Array(2_000).fill(1)] });

    assert.ok(frames.length > 0);
    assert.ok(frames.every((frame) => frame.byteLength === LIVE_PCM_FRAME_BYTES));
    assert.equal(frames.length, frameCountAfterFinish);
    assert.equal(harness.disconnectCalls, 1);
    assert.equal(harness.stopTrackCalls, 1);
    assert.equal(harness.closeCalls, 1);

    const pcm = concatenatePcmChunks([...frames, result.finalChunk]);
    assert.deepEqual(new Uint8Array(result.recordingWav, PCM16_WAV_HEADER_BYTES), pcm);
  });

  it('clears resources once on cancel and ignores late worklet messages', async () => {
    const harness = createResourceHarness();
    const frames: Uint8Array[] = [];
    const session = new LivePcmCaptureSession(harness.resources, {
      onFrame: (frame) => frames.push(frame.slice()),
    });
    harness.emit({ type: 'samples', channels: [new Float32Array(2_000).fill(0.25)] });
    const lateHandler = harness.getLateHandler();

    await session.cancel();
    await session.cancel();
    const frameCountAfterCancel = frames.length;
    lateHandler?.({ type: 'samples', channels: [new Float32Array(2_000).fill(1)] });

    assert.equal(frames.length, frameCountAfterCancel);
    assert.equal(harness.disconnectCalls, 1);
    assert.equal(harness.stopTrackCalls, 1);
    assert.equal(harness.closeCalls, 1);
    await assert.rejects(session.finish(), /no longer active/u);
  });
});

describe('live PCM AudioWorklet', () => {
  it('posts copied channel samples with transferable buffers and stays alive', () => {
    const source = readFileSync(WORKLET_PATH, 'utf8');
    const posted: Array<{ message: unknown; transfer: ArrayBuffer[] }> = [];
    const registration: {
      name: string;
      Processor?: new () => { process(inputs: Float32Array[][]): boolean };
    } = { name: '' };

    class TestAudioWorkletProcessor {
      readonly port = {
        postMessage: (message: unknown, transfer: ArrayBuffer[]) => posted.push({ message, transfer }),
      };
    }

    vm.runInNewContext(source, {
      AudioWorkletProcessor: TestAudioWorkletProcessor,
      Float32Array,
      registerProcessor: (name: string, processor: new () => { process(inputs: Float32Array[][]): boolean }) => {
        registration.name = name;
        registration.Processor = processor;
      },
    });

    assert.equal(registration.name, PROCESSOR_NAME);
    assert.ok(registration.Processor);
    const processor = new registration.Processor();
    const left = new Float32Array([0.25, -0.5]);
    const right = new Float32Array([0.75, 1]);

    assert.equal(processor.process([[left, right]]), true);
    assert.equal(processor.process([]), true);
    assert.equal(posted.length, 1);

    const message = posted[0]?.message as { channels: Float32Array[]; type: string };
    assert.equal(message.type, 'samples');
    assert.deepEqual(message.channels[0], left);
    assert.deepEqual(message.channels[1], right);
    assert.notEqual(message.channels[0]?.buffer, left.buffer);
    assert.equal(posted[0]?.transfer[0], message.channels[0]?.buffer);
    assert.equal(posted[0]?.transfer[1], message.channels[1]?.buffer);

    left[0] = 1;
    assert.equal(message.channels[0]?.[0], 0.25);
  });
});
