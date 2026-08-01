import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { format } from 'prettier';

import {
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  createLocalWhisperAudioChunk,
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperRevisionId,
  type LocalWhisperWorkerControlMessage,
} from '@shared/localWhisper';

const OUTPUT_DIRECTORY = resolve('tests/fixtures/local-whisper/protocol/v1');
const OUTPUT_PATH = resolve(OUTPUT_DIRECTORY, 'manifest.json');

function frame(kind: number, body: Uint8Array, declaredLength = body.byteLength): Uint8Array {
  const result = new Uint8Array(5 + body.byteLength);
  const view = new DataView(result.buffer);
  view.setUint32(0, declaredLength, false);
  view.setUint8(4, kind);
  result.set(body, 5);
  return result;
}

function controlJson(json: string): Uint8Array {
  return frame(0x01, new TextEncoder().encode(json));
}

function changed(source: Uint8Array, offset: number, value: number): Uint8Array {
  const result = new Uint8Array(source);
  result[offset] = value;
  return result;
}

function writeBinary(category: string, name: string, bytes: Uint8Array): string {
  const relativePath = `${category}/${name}.bin`;
  const path = resolve(OUTPUT_DIRECTORY, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes, { mode: 0o600 });
  return relativePath;
}

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid synthetic fixture revision');
  return result;
}

function residency(): LocalWhisperResidencyKey {
  const deviceId = toLocalWhisperOpaqueDeviceId('fixture-gpu');
  if (!deviceId) throw new Error('Invalid synthetic fixture device');
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

function messages(): readonly [name: string, message: LocalWhisperWorkerControlMessage][] {
  const selectedResidency = residency();
  return [
    ['hello', { type: 'hello', protocolVersion: 1 }],
    [
      'helloAck',
      {
        type: 'helloAck',
        protocolVersion: 1,
        engine: 'whisperCpp',
        runtimeRevision: revision('runtime-pack-v1'),
        runtimeBuildDigest: 'a'.repeat(64),
        backend: 'cuda',
        capabilities: ['cuda-sm-75', 'cuda-sm-86'],
        maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
        maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
      },
    ],
    ['probe', { type: 'probe', protocolVersion: 1, requestId: 'probe-1' }],
    ['probed', { type: 'probed', protocolVersion: 1, requestId: 'probe-1' }],
    [
      'load',
      {
        type: 'load',
        protocolVersion: 1,
        requestId: 'load-1',
        modelPath: '/private/fixture/model.bin',
        residency: selectedResidency,
      },
    ],
    ['loaded', { type: 'loaded', protocolVersion: 1, requestId: 'load-1', residency: selectedResidency }],
    ['warmup', { type: 'warmup', protocolVersion: 1, requestId: 'warm-1' }],
    ['warmed', { type: 'warmed', protocolVersion: 1, requestId: 'warm-1' }],
    [
      'transcribe',
      {
        type: 'transcribe',
        protocolVersion: 1,
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
    ],
    ['transcript', { type: 'transcript', protocolVersion: 1, requestId: 'tx-1', text: 'synthetic result' }],
    [
      'cancel',
      {
        type: 'cancel',
        protocolVersion: 1,
        requestId: 'cancel-1',
        targetRequestId: 'tx-1',
      },
    ],
    [
      'cancelled',
      {
        type: 'cancelled',
        protocolVersion: 1,
        requestId: 'cancel-1',
        targetRequestId: 'tx-1',
      },
    ],
    ['unload', { type: 'unload', protocolVersion: 1, requestId: 'free-1' }],
    ['unloaded', { type: 'unloaded', protocolVersion: 1, requestId: 'free-1' }],
    ['shutdown', { type: 'shutdown', protocolVersion: 1, requestId: 'stop-1' }],
    ['shutdownAck', { type: 'shutdownAck', protocolVersion: 1, requestId: 'stop-1' }],
    [
      'failure',
      {
        type: 'failure',
        protocolVersion: 1,
        requestId: 'load-1',
        code: 'MODEL_LOAD_FAILED',
      },
    ],
  ];
}

const audio = [
  ['first', createLocalWhisperAudioChunk('tx-1', 0, false, Uint8Array.from([1, 2]))],
  ['middle', createLocalWhisperAudioChunk('tx-1', 1, false, Uint8Array.from([3, 4]))],
  ['final', createLocalWhisperAudioChunk('tx-1', 2, true, Uint8Array.from([5, 6]))],
  ['empty-final', createLocalWhisperAudioChunk('empty-1', 0, true, new Uint8Array())],
] as const;

const validAudioFrames = Object.fromEntries(
  audio.map(([name, chunk]) => [name, encodeLocalWhisperAudioFrame(chunk)]),
) as Readonly<Record<string, Uint8Array>>;
const malformed = [
  ['truncated-control', frame(0x01, Uint8Array.from([0x7b]), 8)],
  ['unknown-kind', frame(0x7f, new Uint8Array())],
  ['oversized-control-prefix', frame(0x01, new Uint8Array(), LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES + 1)],
  [
    'oversized-audio-prefix',
    frame(0x02, new Uint8Array(), 1 + 1 + 4 + 2 + 128 + LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES + 1),
  ],
  ['invalid-control-utf8', frame(0x01, Uint8Array.from([0xff]))],
  ['duplicate-control-key', controlJson('{"type":"hello","type":"hello","protocolVersion":1}')],
  ['unknown-control-key', controlJson('{"type":"hello","protocolVersion":1,"unknown":true}')],
  [
    'trailing-control-byte',
    Uint8Array.from([...encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: 1 }), 0]),
  ],
  ['invalid-audio-version', changed(validAudioFrames.first ?? new Uint8Array(), 5, 2)],
  ['invalid-audio-final-flag', changed(validAudioFrames.first ?? new Uint8Array(), 6, 2)],
  ['empty-audio-request-id', changed(changed(validAudioFrames.first ?? new Uint8Array(), 11, 0), 12, 0)],
  ['nonterminal-empty-audio', frame(0x02, Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 4, 0x74, 0x78, 0x2d, 0x31]))],
] as const;

const streamViolations = [
  {
    name: 'duplicate-audio-sequence',
    frameNames: ['first', 'first'],
    frameHex: [validAudioFrames.first, validAudioFrames.first].map((value) =>
      Buffer.from(value ?? new Uint8Array()).toString('hex'),
    ),
  },
  {
    name: 'audio-after-terminal',
    frameNames: ['empty-final', 'first'],
    frameHex: [validAudioFrames['empty-final'], validAudioFrames.first].map((value) =>
      Buffer.from(value ?? new Uint8Array()).toString('hex'),
    ),
  },
] as const;

const manifest = {
  schemaVersion: 1,
  protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  control: messages().map(([name, message]) => {
    const encoded = encodeLocalWhisperControlFrame(message);
    return {
      name,
      message,
      binaryFile: writeBinary('control', name, encoded),
      frameHex: Buffer.from(encoded).toString('hex'),
    };
  }),
  audio: audio.map(([name, chunk]) => ({
    name,
    requestId: chunk.requestId,
    sequence: chunk.sequence,
    final: chunk.final,
    bytesHex: Buffer.from(chunk.bytes).toString('hex'),
    binaryFile: writeBinary('audio', name, validAudioFrames[name] ?? new Uint8Array()),
    frameHex: Buffer.from(validAudioFrames[name] ?? new Uint8Array()).toString('hex'),
  })),
  malformed: malformed.map(([name, bytes]) => ({
    name,
    binaryFile: writeBinary('malformed', name, bytes),
    frameHex: Buffer.from(bytes).toString('hex'),
  })),
  streams: streamViolations,
};

async function writeManifest(): Promise<void> {
  const contents = await format(JSON.stringify(manifest), {
    endOfLine: 'lf',
    parser: 'json',
    printWidth: 120,
    tabWidth: 2,
  });
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeFileSync(OUTPUT_PATH, contents, { mode: 0o600 });
}

void writeManifest();
