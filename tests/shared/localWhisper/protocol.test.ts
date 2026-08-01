import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  LOCAL_WHISPER_AUDIO_FRAME_KIND,
  LOCAL_WHISPER_CONTROL_FRAME_KIND,
  LOCAL_WHISPER_FRAME_HEADER_BYTES,
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  createLocalWhisperAudioChunk,
  decodeLocalWhisperAudioFrame,
  decodeLocalWhisperControlFrame,
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  getLocalWhisperFrameKind,
  isLocalWhisperWorkerClientMessage,
  isLocalWhisperWorkerServerMessage,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperRevisionId,
  type LocalWhisperWorkerControlMessage,
  type LocalWhisperWorkerDeviceBinding,
} from '@shared/localWhisper';
import { LocalWhisperFrameCodec } from '@main/localWhisper/supervisor/LocalWhisperFrameCodec';

interface GoldenControlVector {
  readonly binaryFile: string;
  readonly frameHex: string;
  readonly message: LocalWhisperWorkerControlMessage;
  readonly name: string;
}

interface GoldenAudioVector {
  readonly binaryFile: string;
  readonly bytesHex: string;
  readonly final: boolean;
  readonly frameHex: string;
  readonly name: string;
  readonly requestId: string;
  readonly sequence: number;
}

interface GoldenMalformedVector {
  readonly binaryFile: string;
  readonly frameHex: string;
  readonly name: string;
}

interface GoldenStreamViolation {
  readonly frameHex: readonly string[];
  readonly frameNames: readonly string[];
  readonly name: string;
}

interface GoldenManifest {
  readonly protocolVersion: number;
  readonly control: readonly GoldenControlVector[];
  readonly audio: readonly GoldenAudioVector[];
  readonly malformed: readonly GoldenMalformedVector[];
  readonly streams: readonly GoldenStreamViolation[];
}

const GOLDEN_DIRECTORY = 'tests/fixtures/local-whisper/protocol/v1';
const CPU_DEVICE_BINDING = Object.freeze({ kind: 'cpu' }) satisfies LocalWhisperWorkerDeviceBinding;
const GPU_DEVICE_BINDING = Object.freeze({ kind: 'gpuIndex', index: 0 }) satisfies LocalWhisperWorkerDeviceBinding;
const MAX_GPU_DEVICE_BINDING = Object.freeze({
  kind: 'gpuIndex',
  index: 255,
}) satisfies LocalWhisperWorkerDeviceBinding;

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid test revision');
  return result;
}

function residency(): LocalWhisperResidencyKey {
  const deviceId = toLocalWhisperOpaqueDeviceId('fixture-gpu');
  if (!deviceId) throw new Error('Invalid test device');
  return Object.freeze({
    engine: 'whisperCpp',
    runtimePackRevision: revision('runtime-pack-v1'),
    target: 'gpu',
    backend: 'cuda',
    deviceId,
    model: Object.freeze({
      engine: 'whisperCpp',
      logicalModel: 'tiny',
      sourceCheckpointRevision: revision('checkpoint-v1'),
      artifactRevision: revision('artifact-v1'),
      nativeFormat: 'ggml',
      variant: 'full',
    }),
    precision: null,
    resolvedCpuThreads: null,
  });
}

function controlFrameFromJson(json: string, kind: number = LOCAL_WHISPER_CONTROL_FRAME_KIND): Uint8Array {
  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(LOCAL_WHISPER_FRAME_HEADER_BYTES + body.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, body.byteLength, false);
  view.setUint8(4, kind);
  frame.set(body, LOCAL_WHISPER_FRAME_HEADER_BYTES);
  return frame;
}

function fixtureMessages(): readonly LocalWhisperWorkerControlMessage[] {
  const sharedResidency = residency();
  return Object.freeze([
    { type: 'hello', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION },
    {
      type: 'helloAck',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      engine: 'whisperCpp',
      runtimeRevision: revision('runtime-pack-v1'),
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: Object.freeze(['cuda-sm-75', 'cuda-sm-86']),
      maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
      maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
    },
    {
      type: 'probe',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-1',
      deviceBinding: GPU_DEVICE_BINDING,
    },
    {
      type: 'probed',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-1',
      deviceBinding: GPU_DEVICE_BINDING,
    },
    {
      type: 'probe',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-cpu-1',
      deviceBinding: CPU_DEVICE_BINDING,
    },
    {
      type: 'probed',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-cpu-1',
      deviceBinding: CPU_DEVICE_BINDING,
    },
    {
      type: 'probe',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-gpu-max-1',
      deviceBinding: MAX_GPU_DEVICE_BINDING,
    },
    {
      type: 'probed',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'probe-gpu-max-1',
      deviceBinding: MAX_GPU_DEVICE_BINDING,
    },
    {
      type: 'load',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'load-1',
      deviceBinding: GPU_DEVICE_BINDING,
      modelPath: '/private/fixture/model.bin',
      residency: sharedResidency,
    },
    {
      type: 'loaded',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'load-1',
      deviceBinding: GPU_DEVICE_BINDING,
      residency: sharedResidency,
    },
    { type: 'warmup', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'warm-1' },
    { type: 'warmed', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'warm-1' },
    {
      type: 'transcribe',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'tx-1',
      settingsEpoch: 9,
      audioByteLength: 4,
      options: {
        language: null,
        initialPrompt: '',
        temperatureHundredths: 0,
        strategy: 'greedy',
        candidateCount: null,
      },
    },
    {
      type: 'transcript',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'tx-1',
      text: 'synthetic result',
    },
    {
      type: 'cancel',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'cancel-1',
      targetRequestId: 'tx-1',
    },
    {
      type: 'cancelled',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'cancel-1',
      targetRequestId: 'tx-1',
    },
    { type: 'unload', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'free-1' },
    { type: 'unloaded', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'free-1' },
    { type: 'shutdown', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'stop-1' },
    {
      type: 'shutdownAck',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'stop-1',
    },
    {
      type: 'failure',
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId: 'load-1',
      code: 'MODEL_LOAD_FAILED',
    },
  ]);
}

test('control messages round-trip with an explicit control frame kind', () => {
  for (const message of fixtureMessages()) {
    const frame = encodeLocalWhisperControlFrame(message);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    assert.equal(view.getUint32(0, false), frame.byteLength - LOCAL_WHISPER_FRAME_HEADER_BYTES);
    assert.equal(getLocalWhisperFrameKind(frame), LOCAL_WHISPER_CONTROL_FRAME_KIND);
    assert.deepEqual(decodeLocalWhisperControlFrame(frame), message);
  }
});

test('client and server validators reject unknown, cross-field, and stale shapes', () => {
  const sharedResidency = residency();
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'cancel',
      protocolVersion: 1,
      requestId: 'same',
      targetRequestId: 'same',
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'load',
      protocolVersion: 1,
      requestId: 'load-1',
      deviceBinding: GPU_DEVICE_BINDING,
      modelPath: '/model',
      residency: { ...sharedResidency, backend: 'cpu' },
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'helloAck',
      protocolVersion: 1,
      engine: 'whisperCpp',
      runtimeRevision: 'runtime-pack-v1',
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: ['cuda-sm-86', 'cuda-sm-86'],
      maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
      maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
    }),
    false,
  );
  for (const index of [-1, 0.5, 256]) {
    assert.equal(
      isLocalWhisperWorkerClientMessage({
        type: 'probe',
        protocolVersion: 1,
        requestId: 'probe-invalid',
        deviceBinding: { kind: 'gpuIndex', index },
      }),
      false,
    );
  }
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'load',
      protocolVersion: 1,
      requestId: 'load-mismatch',
      deviceBinding: CPU_DEVICE_BINDING,
      modelPath: '/model',
      residency: sharedResidency,
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'loaded',
      protocolVersion: 1,
      requestId: 'load-mismatch',
      deviceBinding: CPU_DEVICE_BINDING,
      residency: sharedResidency,
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'probed',
      protocolVersion: 1,
      requestId: 'probe-1',
      unknown: true,
    }),
    false,
  );
});

test('control decoding rejects duplicate keys, unknown kinds, invalid UTF-8, and trailing bytes', () => {
  const duplicate = controlFrameFromJson('{"type":"hello","type":"hello","protocolVersion":1}');
  assert.throws(() => decodeLocalWhisperControlFrame(duplicate), /Malformed/u);

  const unknownKind = controlFrameFromJson('{"type":"hello","protocolVersion":1}', 0x7f);
  assert.throws(() => getLocalWhisperFrameKind(unknownKind), /Unknown/u);
  assert.throws(() => decodeLocalWhisperControlFrame(unknownKind), /Malformed/u);

  const invalidUtf8 = new Uint8Array([0, 0, 0, 1, LOCAL_WHISPER_CONTROL_FRAME_KIND, 0xff]);
  assert.throws(() => decodeLocalWhisperControlFrame(invalidUtf8), /Malformed/u);

  const nonJsonWhitespace = controlFrameFromJson('\u00a0{"type":"hello","protocolVersion":1}');
  assert.throws(() => decodeLocalWhisperControlFrame(nonJsonWhitespace), /Malformed/u);

  const valid = encodeLocalWhisperControlFrame(fixtureMessages()[0]);
  const trailing = new Uint8Array(valid.byteLength + 1);
  trailing.set(valid);
  assert.throws(() => decodeLocalWhisperControlFrame(trailing), /Malformed/u);
});

test('audio frames include protocol version, final flag, sequence, and request ID', () => {
  const chunks = [
    createLocalWhisperAudioChunk('tx-1', 0, false, new Uint8Array([1, 2])),
    createLocalWhisperAudioChunk('tx-1', 1, true, new Uint8Array([3, 4])),
  ];
  for (const chunk of chunks) {
    const frame = encodeLocalWhisperAudioFrame(chunk);
    assert.equal(getLocalWhisperFrameKind(frame), LOCAL_WHISPER_AUDIO_FRAME_KIND);
    assert.deepEqual(decodeLocalWhisperAudioFrame(frame), chunk);
  }
});

test('audio decoding rejects invalid version, final flag, request ID, and non-terminal empty chunks', () => {
  const valid = encodeLocalWhisperAudioFrame(createLocalWhisperAudioChunk('tx-1', 0, true, new Uint8Array([1])));
  for (const [offset, value] of [
    [5, 2],
    [6, 3],
  ] as const) {
    const malformed = new Uint8Array(valid);
    malformed[offset] = value;
    assert.throws(() => decodeLocalWhisperAudioFrame(malformed), /Malformed|Invalid/u);
  }
  const missingRequestId = new Uint8Array(valid);
  missingRequestId[11] = 0;
  missingRequestId[12] = 0;
  assert.throws(() => decodeLocalWhisperAudioFrame(missingRequestId), /Malformed|Invalid/u);
  assert.throws(() => createLocalWhisperAudioChunk('tx-1', 0, false, new Uint8Array()), /Invalid/u);
});

test('checked-in language-neutral golden vectors match the canonical codec', () => {
  const manifest = JSON.parse(readFileSync(`${GOLDEN_DIRECTORY}/manifest.json`, 'utf8')) as GoldenManifest;
  assert.equal(manifest.protocolVersion, LOCAL_WHISPER_WORKER_PROTOCOL_VERSION);
  for (const vector of manifest.control) {
    const frame = encodeLocalWhisperControlFrame(vector.message);
    assert.equal(Buffer.from(frame).toString('hex'), vector.frameHex, vector.name);
    assert.deepEqual(readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`), Buffer.from(frame));
    assert.deepEqual(decodeLocalWhisperControlFrame(frame), vector.message, vector.name);
  }
  for (const vector of manifest.audio) {
    const chunk = createLocalWhisperAudioChunk(
      vector.requestId,
      vector.sequence,
      vector.final,
      Buffer.from(vector.bytesHex, 'hex'),
    );
    const frame = encodeLocalWhisperAudioFrame(chunk);
    assert.equal(Buffer.from(frame).toString('hex'), vector.frameHex, vector.name);
    assert.deepEqual(readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`), Buffer.from(frame));
    assert.deepEqual(decodeLocalWhisperAudioFrame(frame), chunk, vector.name);
  }
  for (const vector of manifest.malformed) {
    const bytes = readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`);
    assert.equal(bytes.toString('hex'), vector.frameHex, vector.name);
    assert.throws(
      () => {
        const codec = new LocalWhisperFrameCodec();
        codec.push(bytes);
        codec.finish();
      },
      Error,
      vector.name,
    );
  }
  assert.deepEqual(
    manifest.streams.map((vector) => vector.name),
    ['duplicate-audio-sequence', 'audio-after-terminal'],
  );
  for (const vector of manifest.streams) {
    assert.equal(vector.frameHex.length, vector.frameNames.length, vector.name);
    assert.ok(
      vector.frameHex.every((hex) => /^[a-f0-9]+$/u.test(hex)),
      vector.name,
    );
  }
});
