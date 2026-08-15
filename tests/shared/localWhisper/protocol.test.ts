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
  type LocalWhisperWorkerControlMessage,
  type LocalWhisperWorkerClientMessage,
} from '@shared/localWhisper';
import { LocalWhisperFrameCodec } from '@main/localWhisper/supervisor/LocalWhisperFrameCodec';

interface GoldenManifest {
  readonly protocolVersion: number;
  readonly control: readonly {
    readonly binaryFile: string;
    readonly message: LocalWhisperWorkerControlMessage;
    readonly name: string;
    readonly sha256: string;
  }[];
  readonly audio: readonly {
    readonly binaryFile: string;
    readonly bytesHex: string;
    readonly final: boolean;
    readonly name: string;
    readonly requestId: string;
    readonly sequence: number;
  }[];
  readonly malformed: readonly { readonly binaryFile: string; readonly name: string }[];
  readonly streams: readonly { readonly frameNames: readonly string[]; readonly name: string }[];
}

const GOLDEN_DIRECTORY = 'tests/fixtures/local-whisper/protocol/v1';
const AUTHORITY_ID = 'AAECAwQFBgcICQoLDA0ODw';
const CHALLENGE = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';

function manifest(): GoldenManifest {
  return JSON.parse(readFileSync(`${GOLDEN_DIRECTORY}/manifest.json`, 'utf8')) as GoldenManifest;
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

test('control messages round-trip with exact authority and proof schemas', () => {
  for (const vector of manifest().control) {
    const frame = encodeLocalWhisperControlFrame(vector.message);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    assert.equal(view.getUint32(0, false), frame.byteLength - LOCAL_WHISPER_FRAME_HEADER_BYTES);
    assert.equal(getLocalWhisperFrameKind(frame), LOCAL_WHISPER_CONTROL_FRAME_KIND);
    assert.deepEqual(decodeLocalWhisperControlFrame(frame), vector.message, vector.name);
    assert.deepEqual(readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`), Buffer.from(frame), vector.name);
    assert.equal(JSON.stringify(vector.message).includes('modelPath'), false, vector.name);
  }
});

test('client and server validators reject path, cross-domain, and stale authority shapes', () => {
  const gpuLoad = manifest()
    .control.map(({ message }) => message)
    .find(
      (message): message is Extract<LocalWhisperWorkerClientMessage, { readonly type: 'load' }> =>
        message.type === 'load' && message.residency.target === 'gpu',
    );
  assert.ok(gpuLoad);
  assert.equal(isLocalWhisperWorkerClientMessage(gpuLoad), true);
  for (const residency of [
    { ...gpuLoad.residency, configuredGpuCpuThreads: 4, resolvedCpuThreads: 8 },
    { ...gpuLoad.residency, resolvedCpuThreads: 0 },
    { ...gpuLoad.residency, resolvedCpuThreads: 65_537 },
    { ...gpuLoad.residency, logicalProcessorTopologyGeneration: -1 },
    { ...gpuLoad.residency, configurationEpoch: -1 },
  ]) {
    assert.equal(isLocalWhisperWorkerClientMessage({ ...gpuLoad, residency }), false);
  }
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'probe',
      protocolVersion: 1,
      requestId: 'probe-1',
      authorityId: AUTHORITY_ID,
      deviceBinding: { kind: 'gpuIndex', index: 0 },
      loadChallenge: CHALLENGE,
      registryFingerprint: 'a'.repeat(64),
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'probe',
      protocolVersion: 1,
      requestId: 'probe-1',
      authorityId: AUTHORITY_ID,
      deviceBinding: { kind: 'cpu' },
      probeChallenge: CHALLENGE,
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerClientMessage({
      type: 'load',
      protocolVersion: 1,
      requestId: 'load-1',
      authorityId: AUTHORITY_ID,
      deviceBinding: { kind: 'cpu' },
      modelPath: '/forbidden/model.bin',
    }),
    false,
  );
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'probed',
      protocolVersion: 1,
      requestId: 'probe-1',
      authorityId: AUTHORITY_ID,
      deviceBinding: { kind: 'gpuIndex', index: 0 },
      activatedOrdinal: 0,
      actualNativeIdentity: 'gpu-0',
      primaryExecutionNativeIdentity: 'gpu-0',
      loadProof: 'a'.repeat(64),
      registryFingerprint: 'b'.repeat(64),
    }),
    false,
  );
  for (const index of [-1, 0.5, 256]) {
    assert.equal(
      isLocalWhisperWorkerClientMessage({
        type: 'probe',
        protocolVersion: 1,
        requestId: 'probe-invalid',
        authorityId: AUTHORITY_ID,
        deviceBinding: { kind: 'gpuIndex', index },
        probeChallenge: CHALLENGE,
        registryFingerprint: 'a'.repeat(64),
      }),
      false,
    );
  }
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
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'cancelTooLate',
      protocolVersion: 1,
      requestId: 'cancel-1',
      targetRequestId: 'tx-1',
    }),
    true,
  );
  assert.equal(
    isLocalWhisperWorkerServerMessage({
      type: 'cancelTooLate',
      protocolVersion: 1,
      requestId: 'cancel-1',
      targetRequestId: 'tx-1',
      unexpected: true,
    }),
    false,
  );
});

test('control decoding rejects duplicate keys, numeric spelling, invalid UTF-8, and trailing bytes', () => {
  for (const json of [
    '{"type":"hello","type":"hello","protocolVersion":1}',
    '{"type":"hello","protocolVersion":01}',
    '{"type":"hello","protocolVersion":1.0}',
    '{"type":"hello","protocolVersion":1e0}',
  ]) {
    assert.throws(() => decodeLocalWhisperControlFrame(controlFrameFromJson(json)), /Malformed/u);
  }
  const unknownKind = controlFrameFromJson('{"type":"hello","protocolVersion":1}', 0x7f);
  assert.throws(() => getLocalWhisperFrameKind(unknownKind), /Unknown/u);
  const invalidUtf8 = new Uint8Array([0, 0, 0, 1, LOCAL_WHISPER_CONTROL_FRAME_KIND, 0xff]);
  assert.throws(() => decodeLocalWhisperControlFrame(invalidUtf8), /Malformed/u);
  const nonJsonWhitespace = controlFrameFromJson('\u00a0{"type":"hello","protocolVersion":1}');
  assert.throws(() => decodeLocalWhisperControlFrame(nonJsonWhitespace), /Malformed/u);
  const valid = encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: 1 });
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

test('checked-in language-neutral frames match the canonical codec and malformed vectors fail', () => {
  const vectors = manifest();
  assert.equal(vectors.protocolVersion, LOCAL_WHISPER_WORKER_PROTOCOL_VERSION);
  for (const vector of vectors.audio) {
    const chunk = createLocalWhisperAudioChunk(
      vector.requestId,
      vector.sequence,
      vector.final,
      Buffer.from(vector.bytesHex, 'hex'),
    );
    assert.deepEqual(
      readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`),
      Buffer.from(encodeLocalWhisperAudioFrame(chunk)),
      vector.name,
    );
  }
  for (const vector of vectors.malformed) {
    const bytes = readFileSync(`${GOLDEN_DIRECTORY}/${vector.binaryFile}`);
    assert.throws(() => {
      const codec = new LocalWhisperFrameCodec();
      codec.push(bytes);
      codec.finish();
    }, vector.name);
  }
  assert.deepEqual(
    vectors.streams.map((vector) => vector.name),
    ['duplicate-audio-sequence', 'audio-after-terminal'],
  );
});
