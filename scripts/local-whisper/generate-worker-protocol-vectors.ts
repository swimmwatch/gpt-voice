import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

import {
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  LOCAL_WHISPER_WAV_MAX_TOTAL_BYTES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  createLocalWhisperAudioChunk,
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperRevisionId,
  type LocalWhisperWorkerControlMessage,
  type LocalWhisperWorkerDeviceBinding,
} from '@shared/localWhisper';
import {
  createLocalWhisperDeviceProof,
  createLocalWhisperRegistryFingerprint,
  type LocalWhisperDeviceProofInput,
  type LocalWhisperDeviceRegistry,
} from '@main/localWhisper/supervisor/LocalWhisperDeviceAuthority';
import {
  encodeLocalWhisperModelAuthorityRecord,
  type LocalWhisperModelAuthorityBinding,
  type LocalWhisperModelAuthorityRecord,
} from '@main/localWhisper/supervisor/LocalWhisperModelAuthorityRecord';

const OUTPUT_DIRECTORY = resolve('tests/fixtures/local-whisper/protocol/v1');
const OUTPUT_PATH = resolve(OUTPUT_DIRECTORY, 'manifest.json');
const CHECK_CLEAN = process.argv.includes('--check-clean');
const CPU_DEVICE_BINDING = Object.freeze({ kind: 'cpu' }) satisfies LocalWhisperWorkerDeviceBinding;
const GPU_DEVICE_BINDING = Object.freeze({ kind: 'gpuIndex', index: 0 }) satisfies LocalWhisperWorkerDeviceBinding;
const MAX_GPU_DEVICE_BINDING = Object.freeze({
  kind: 'gpuIndex',
  index: 255,
}) satisfies LocalWhisperWorkerDeviceBinding;
const AUTHORITY_ID = Buffer.from(Uint8Array.from({ length: 16 }, (_, index) => index)).toString('base64url');
const PROBE_CHALLENGE = Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => index + 32)).toString('base64url');
const LOAD_CHALLENGE = Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => index + 64)).toString('base64url');

interface GeneratedBinary {
  readonly binaryFile: string;
  readonly sha256: string;
}

const generatedFiles = new Map<string, Uint8Array>();

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

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

function addBinary(category: string, name: string, bytes: Uint8Array): GeneratedBinary {
  const binaryFile = `${category}/${name}.bin`;
  generatedFiles.set(binaryFile, new Uint8Array(bytes));
  return { binaryFile, sha256: sha256(bytes) };
}

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid synthetic fixture revision');
  return result;
}

function residency(target: 'cpu' | 'gpu' = 'gpu'): LocalWhisperResidencyKey {
  const deviceId = target === 'gpu' ? toLocalWhisperOpaqueDeviceId('fixture-gpu') : null;
  if (target === 'gpu' && !deviceId) throw new Error('Invalid synthetic fixture device');
  return Object.freeze({
    engine: 'whisperCpp',
    runtimePackRevision: revision('runtime-pack-v1'),
    target,
    backend: target === 'gpu' ? 'cuda' : 'cpu',
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
    resolvedCpuThreads: target === 'cpu' ? 4 : null,
  });
}

function registry(): LocalWhisperDeviceRegistry {
  return Object.freeze({
    backendId: 'cuda',
    engineId: 'whisperCpp',
    entries: Object.freeze([
      Object.freeze({ backendId: 'cuda', nativeIdentity: '0000:01:00.0', ordinal: 0, type: 'gpu' as const }),
      Object.freeze({ backendId: 'cuda', nativeIdentity: '0000:02:00.0', ordinal: 255, type: 'igpu' as const }),
    ]),
    runtimeBuildDigest: 'a'.repeat(64),
  });
}

function proofInput(challenge: string, weightBytes: bigint): LocalWhisperDeviceProofInput {
  return Object.freeze({
    activatedOrdinal: 0,
    actualNativeIdentity: '0000:01:00.0',
    authorityId: AUTHORITY_ID,
    backendId: 'cuda',
    challenge,
    configurationEpoch: 7n,
    engineId: 'whisperCpp',
    primaryExecutionNativeIdentity: '0000:01:00.0',
    registryFingerprint: createLocalWhisperRegistryFingerprint(registry()),
    runtimeBuildDigest: 'a'.repeat(64),
    selectedDeviceModelWeightBytes: weightBytes,
    selectedOrdinal: 0,
    topologyGeneration: 11n,
  });
}

function loadedModelEvidence() {
  return Object.freeze({
    effectiveBackend: 'cuda' as const,
    effectivePrecision: null,
    model: residency().model,
    modelSha256: 'b'.repeat(64),
    primaryStateOwnership: 'worker' as const,
  });
}

function messages(): readonly [name: string, message: LocalWhisperWorkerControlMessage][] {
  const registryFingerprint = createLocalWhisperRegistryFingerprint(registry());
  const probeProof = createLocalWhisperDeviceProof('probe', proofInput(PROBE_CHALLENGE, 0n));
  const loadProof = createLocalWhisperDeviceProof('load', proofInput(LOAD_CHALLENGE, 1_048_576n));
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
    [
      'probe',
      {
        type: 'probe',
        protocolVersion: 1,
        requestId: 'probe-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: GPU_DEVICE_BINDING,
        probeChallenge: PROBE_CHALLENGE,
        registryFingerprint,
      },
    ],
    [
      'probed',
      {
        type: 'probed',
        protocolVersion: 1,
        requestId: 'probe-1',
        activatedOrdinal: 0,
        actualNativeIdentity: '0000:01:00.0',
        authorityId: AUTHORITY_ID,
        deviceBinding: GPU_DEVICE_BINDING,
        primaryExecutionNativeIdentity: '0000:01:00.0',
        probeProof,
        registryFingerprint,
      },
    ],
    [
      'probe-cpu',
      {
        type: 'probe',
        protocolVersion: 1,
        requestId: 'probe-cpu-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: CPU_DEVICE_BINDING,
      },
    ],
    [
      'probed-cpu',
      {
        type: 'probed',
        protocolVersion: 1,
        requestId: 'probe-cpu-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: CPU_DEVICE_BINDING,
      },
    ],
    [
      'probe-gpu-max',
      {
        type: 'probe',
        protocolVersion: 1,
        requestId: 'probe-gpu-max-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: MAX_GPU_DEVICE_BINDING,
        probeChallenge: PROBE_CHALLENGE,
        registryFingerprint,
      },
    ],
    [
      'load',
      {
        type: 'load',
        protocolVersion: 1,
        requestId: 'load-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: GPU_DEVICE_BINDING,
        loadChallenge: LOAD_CHALLENGE,
        registryFingerprint,
        residency: residency(),
      },
    ],
    [
      'loaded',
      {
        type: 'loaded',
        protocolVersion: 1,
        requestId: 'load-1',
        activatedOrdinal: 0,
        actualNativeIdentity: '0000:01:00.0',
        authorityId: AUTHORITY_ID,
        deviceBinding: GPU_DEVICE_BINDING,
        ...loadedModelEvidence(),
        loadProof,
        primaryExecutionNativeIdentity: '0000:01:00.0',
        registryFingerprint,
        residency: residency(),
        selectedDeviceModelWeightBytes: 1_048_576,
      },
    ],
    [
      'loaded-cpu',
      {
        type: 'loaded',
        protocolVersion: 1,
        requestId: 'load-cpu-1',
        authorityId: AUTHORITY_ID,
        deviceBinding: CPU_DEVICE_BINDING,
        effectiveBackend: 'cpu',
        effectivePrecision: null,
        model: residency('cpu').model,
        modelSha256: 'b'.repeat(64),
        primaryStateOwnership: 'worker',
        residency: residency('cpu'),
      },
    ],
    ['warmup', { type: 'warmup', protocolVersion: 1, requestId: 'warm-1' }],
    ['warmed', { type: 'warmed', protocolVersion: 1, requestId: 'warm-1' }],
    [
      'transcribe',
      {
        type: 'transcribe',
        protocolVersion: 1,
        requestId: 'tx-1',
        settingsEpoch: 9,
        audioByteLength: 46,
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
    ['cancel', { type: 'cancel', protocolVersion: 1, requestId: 'cancel-1', targetRequestId: 'tx-1' }],
    ['cancelled', { type: 'cancelled', protocolVersion: 1, requestId: 'cancel-1', targetRequestId: 'tx-1' }],
    ['unload', { type: 'unload', protocolVersion: 1, requestId: 'free-1' }],
    ['unloaded', { type: 'unloaded', protocolVersion: 1, requestId: 'free-1' }],
    ['shutdown', { type: 'shutdown', protocolVersion: 1, requestId: 'stop-1' }],
    ['shutdownAck', { type: 'shutdownAck', protocolVersion: 1, requestId: 'stop-1' }],
    ['failure', { type: 'failure', protocolVersion: 1, requestId: 'load-1', code: 'MODEL_LOAD_FAILED' }],
  ];
}

function jsonLimitVectors(): readonly { readonly name: string; readonly valid: boolean; readonly bytes: Uint8Array }[] {
  const eventValidGroups = Array.from({ length: 16 }, (_, index) =>
    Array.from({ length: index === 15 ? 252 : 254 }, () => 0),
  );
  const eventInvalidGroups = eventValidGroups.map((group, index) => (index === 15 ? [...group, 0] : group));
  const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
  return [
    { name: 'safe-integer-min', valid: true, bytes: utf8('-9007199254740991') },
    { name: 'safe-integer-max', valid: true, bytes: utf8('9007199254740991') },
    { name: 'safe-integer-underflow', valid: false, bytes: utf8('-9007199254740992') },
    { name: 'safe-integer-overflow', valid: false, bytes: utf8('9007199254740992') },
    { name: 'negative-zero', valid: false, bytes: utf8('-0') },
    { name: 'leading-zero', valid: false, bytes: utf8('01') },
    { name: 'decimal', valid: false, bytes: utf8('1.0') },
    { name: 'exponent', valid: false, bytes: utf8('1e2') },
    { name: 'plus', valid: false, bytes: utf8('+1') },
    { name: 'duplicate-root-key', valid: false, bytes: utf8('{"a":1,"a":2}') },
    { name: 'duplicate-nested-key', valid: false, bytes: utf8('{"a":{"b":1,"b":2}}') },
    { name: 'depth-16', valid: true, bytes: utf8(`${'['.repeat(16)}0${']'.repeat(16)}`) },
    { name: 'depth-17', valid: false, bytes: utf8(`${'['.repeat(17)}0${']'.repeat(17)}`) },
    {
      name: 'members-128',
      valid: true,
      bytes: utf8(JSON.stringify(Object.fromEntries(Array.from({ length: 128 }, (_, i) => [`k${i}`, i])))),
    },
    {
      name: 'members-129',
      valid: false,
      bytes: utf8(JSON.stringify(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`k${i}`, i])))),
    },
    { name: 'elements-256', valid: true, bytes: utf8(JSON.stringify(Array.from({ length: 256 }, () => 0))) },
    { name: 'elements-257', valid: false, bytes: utf8(JSON.stringify(Array.from({ length: 257 }, () => 0))) },
    { name: 'events-4096', valid: true, bytes: utf8(JSON.stringify(eventValidGroups)) },
    { name: 'events-4097', valid: false, bytes: utf8(JSON.stringify(eventInvalidGroups)) },
    { name: 'key-bytes-128', valid: true, bytes: utf8(JSON.stringify({ ['k'.repeat(128)]: 0 })) },
    { name: 'key-bytes-129', valid: false, bytes: utf8(JSON.stringify({ ['k'.repeat(129)]: 0 })) },
    { name: 'string-bytes-262144', valid: true, bytes: utf8(JSON.stringify('s'.repeat(262_144))) },
    { name: 'string-bytes-262145', valid: false, bytes: utf8(JSON.stringify('s'.repeat(262_145))) },
    { name: 'invalid-utf8', valid: false, bytes: Uint8Array.of(0xff) },
    { name: 'invalid-escape', valid: false, bytes: utf8('"\\x"') },
    { name: 'lone-high-surrogate', valid: false, bytes: utf8('"\\ud800"') },
    { name: 'lone-low-surrogate', valid: false, bytes: utf8('"\\udc00"') },
    { name: 'paired-surrogate', valid: true, bytes: utf8('"\\ud83d\\ude00"') },
    { name: 'trailing-value', valid: false, bytes: utf8('null null') },
  ];
}

function canonicalWav(sampleCount = 1): Uint8Array {
  const result = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(result.buffer);
  for (const [offset, text] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const) {
    result.set(new TextEncoder().encode(text), offset);
  }
  view.setUint32(4, result.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, sampleCount * 2, true);
  return result;
}

function authorityBinding(
  artifactKind: LocalWhisperModelAuthorityBinding['artifactKind'] = 'regularFile',
  configurationEpoch = 7n,
  operationNonceValue = 1,
): LocalWhisperModelAuthorityBinding {
  const fill = (length: number, value: number): Uint8Array => Uint8Array.from({ length }, () => value);
  return Object.freeze({
    appOwnershipNonce: fill(16, 2),
    artifactKind,
    artifactContentSha256: fill(32, 5),
    configurationEpoch,
    expectedArtifactBytes: artifactKind === 'regularFile' ? 13n : 0xffff_ffff_ffff_ffffn,
    expectedGuardPid: 101n,
    expectedGuardStartIdentitySha256: fill(32, 7),
    expectedLauncherPid: 100n,
    expectedLauncherStartIdentitySha256: fill(32, 6),
    leaseTokenSha256: fill(32, 3),
    logicalModelSlot: 3,
    modelIdentitySha256: fill(32, 4),
    operationNonce: fill(16, operationNonceValue),
  });
}

function authorityRecords(): readonly [string, LocalWhisperModelAuthorityRecord][] {
  const binding = authorityBinding();
  const directoryBinding = authorityBinding('directory', 0xffff_ffff_ffff_ffffn, 9);
  return [
    ['request', { binding, type: 'request' }],
    ['directory-request-u64-max', { binding: directoryBinding, type: 'request' }],
    ['linux-hop-1', { binding, carrierKind: 1, carrierValue: 0n, hop: 1, type: 'transfer' }],
    [
      'linux-directory-hop-1',
      { binding: directoryBinding, carrierKind: 1, carrierValue: 0n, hop: 1, type: 'transfer' },
    ],
    ['windows-hop-1', { binding, carrierKind: 2, carrierValue: 0x1234n, hop: 1, type: 'transfer' }],
    ['linux-hop-2', { binding, carrierKind: 3, carrierValue: 3n, hop: 2, type: 'transfer' }],
    ['windows-hop-2', { binding, carrierKind: 4, carrierValue: 0x5678n, hop: 2, type: 'transfer' }],
    [
      'windows-hop-2-u64-max',
      { binding: directoryBinding, carrierKind: 4, carrierValue: 0xffff_ffff_ffff_ffffn, hop: 2, type: 'transfer' },
    ],
    [
      'linux-ack',
      {
        binding,
        carrierKind: 3,
        carrierValue: 3n,
        hop: 2,
        type: 'acknowledgment',
        workerPid: 102n,
        workerStartIdentitySha256: Uint8Array.from({ length: 32 }, () => 8),
      },
    ],
    [
      'windows-ack',
      {
        binding,
        carrierKind: 4,
        carrierValue: 0x5678n,
        hop: 2,
        type: 'acknowledgment',
        workerPid: 102n,
        workerStartIdentitySha256: Uint8Array.from({ length: 32 }, () => 8),
      },
    ],
  ];
}

function serializeBigInts(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function buildOutputs(): Promise<void> {
  const control = messages().map(([name, message]) => {
    const encoded = encodeLocalWhisperControlFrame(message);
    return { name, message, ...addBinary('control', name, encoded) };
  });
  const audioChunks = [
    ['first', createLocalWhisperAudioChunk('tx-1', 0, false, Uint8Array.from([1, 2]))],
    ['middle', createLocalWhisperAudioChunk('tx-1', 1, false, Uint8Array.from([3, 4]))],
    ['final', createLocalWhisperAudioChunk('tx-1', 2, true, Uint8Array.from([5, 6]))],
    ['empty-final', createLocalWhisperAudioChunk('empty-1', 0, true, new Uint8Array())],
  ] as const;
  const audio = audioChunks.map(([name, chunk]) => {
    const encoded = encodeLocalWhisperAudioFrame(chunk);
    return {
      name,
      requestId: chunk.requestId,
      sequence: chunk.sequence,
      final: chunk.final,
      bytesHex: Buffer.from(chunk.bytes).toString('hex'),
      ...addBinary('audio', name, encoded),
    };
  });
  const firstAudio = generatedFiles.get('audio/first.bin') ?? new Uint8Array();
  const malformedEntries: readonly [string, Uint8Array][] = [
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
      'negative-device-index',
      controlJson(
        `{"type":"probe","protocolVersion":1,"requestId":"bad","authorityId":"${AUTHORITY_ID}","deviceBinding":{"kind":"gpuIndex","index":-1},"probeChallenge":"${PROBE_CHALLENGE}","registryFingerprint":"${'a'.repeat(64)}"}`,
      ),
    ],
    [
      'fractional-device-index',
      controlJson(
        `{"type":"probe","protocolVersion":1,"requestId":"bad","authorityId":"${AUTHORITY_ID}","deviceBinding":{"kind":"gpuIndex","index":0.5},"probeChallenge":"${PROBE_CHALLENGE}","registryFingerprint":"${'a'.repeat(64)}"}`,
      ),
    ],
    [
      'oversized-device-index',
      controlJson(
        `{"type":"probe","protocolVersion":1,"requestId":"bad","authorityId":"${AUTHORITY_ID}","deviceBinding":{"kind":"gpuIndex","index":256},"probeChallenge":"${PROBE_CHALLENGE}","registryFingerprint":"${'a'.repeat(64)}"}`,
      ),
    ],
    [
      'cpu-gpu-residency-mismatch',
      controlJson(
        JSON.stringify({
          type: 'load',
          protocolVersion: 1,
          requestId: 'bad',
          authorityId: AUTHORITY_ID,
          deviceBinding: CPU_DEVICE_BINDING,
          residency: residency(),
        }),
      ),
    ],
    [
      'trailing-control-byte',
      Uint8Array.from([...encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: 1 }), 0]),
    ],
    ['invalid-audio-version', changed(firstAudio, 5, 2)],
    ['invalid-audio-final-flag', changed(firstAudio, 6, 2)],
    ['empty-audio-request-id', changed(changed(firstAudio, 11, 0), 12, 0)],
    ['nonterminal-empty-audio', frame(0x02, Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 4, 0x74, 0x78, 0x2d, 0x31]))],
  ];
  const malformed = malformedEntries.map(([name, bytes]) => ({ name, ...addBinary('malformed', name, bytes) }));
  const lexical = jsonLimitVectors().map((vector) => ({
    name: vector.name,
    valid: vector.valid,
    ...addBinary('json', vector.name, vector.bytes),
  }));
  const proofRegistry = registry();
  const registryFingerprint = createLocalWhisperRegistryFingerprint(proofRegistry);
  const probeInput = proofInput(PROBE_CHALLENGE, 0n);
  const loadInput = proofInput(LOAD_CHALLENGE, 1_048_576n);
  const registryVariants: readonly [string, LocalWhisperDeviceRegistry][] = [
    ['empty', Object.freeze({ ...proofRegistry, entries: Object.freeze([]) })],
    ['single', Object.freeze({ ...proofRegistry, entries: Object.freeze([proofRegistry.entries[0]]) })],
    ['multiple', proofRegistry],
    [
      'changed-order',
      Object.freeze({ ...proofRegistry, entries: Object.freeze([...proofRegistry.entries].reverse()) }),
    ],
  ];
  const maximumU64 = 0xffff_ffff_ffff_ffffn;
  const boundaryProbeInput = Object.freeze({
    ...probeInput,
    activatedOrdinal: 255,
    configurationEpoch: 0n,
    selectedOrdinal: 255,
    topologyGeneration: maximumU64,
  });
  const boundaryLoadInput = Object.freeze({
    ...loadInput,
    activatedOrdinal: 255,
    configurationEpoch: maximumU64,
    selectedDeviceModelWeightBytes: maximumU64,
    selectedOrdinal: 255,
    topologyGeneration: 0n,
  });
  const proofVectors = {
    registry: proofRegistry,
    registryFingerprint,
    registries: registryVariants.map(([name, input]) => ({
      name,
      input,
      expectedFingerprint: createLocalWhisperRegistryFingerprint(input),
    })),
    probe: { input: probeInput, expectedProof: createLocalWhisperDeviceProof('probe', probeInput) },
    load: { input: loadInput, expectedProof: createLocalWhisperDeviceProof('load', loadInput) },
    boundaries: [
      {
        name: 'probe-u64-boundaries-ordinal-255',
        domain: 'probe',
        input: boundaryProbeInput,
        expectedProof: createLocalWhisperDeviceProof('probe', boundaryProbeInput),
      },
      {
        name: 'load-u64-boundaries-ordinal-255',
        domain: 'load',
        input: boundaryLoadInput,
        expectedProof: createLocalWhisperDeviceProof('load', boundaryLoadInput),
      },
    ],
  };
  const authority = authorityRecords().map(([name, record]) => ({
    name,
    ...addBinary('authority', name, encodeLocalWhisperModelAuthorityRecord(record)),
  }));
  const wavMinimum = canonicalWav();
  const wavInvalidRate = changed(wavMinimum, 24, 0);
  const wav = [
    { name: 'minimum', valid: true, ...addBinary('wav', 'minimum', wavMinimum) },
    { name: 'invalid-rate', valid: false, ...addBinary('wav', 'invalid-rate', wavInvalidRate) },
    { name: 'trailing-byte', valid: false, ...addBinary('wav', 'trailing-byte', Uint8Array.from([...wavMinimum, 0])) },
  ];
  const manifest = {
    schemaVersion: 2,
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    limits: {
      maxControlBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
      maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
      maxWavBytes: LOCAL_WHISPER_WAV_MAX_TOTAL_BYTES,
    },
    control,
    audio,
    malformed,
    streams: [
      { name: 'duplicate-audio-sequence', frameNames: ['first', 'first'] },
      { name: 'audio-after-terminal', frameNames: ['empty-final', 'first'] },
    ],
    lexical,
    proofs: proofVectors,
    authority,
    wav,
  };
  const contents = await format(JSON.stringify(manifest, serializeBigInts), {
    endOfLine: 'lf',
    parser: 'json',
    printWidth: 120,
    tabWidth: 2,
  });
  generatedFiles.set('manifest.json', new TextEncoder().encode(contents));
}

function listFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [relative(OUTPUT_DIRECTORY, path)];
  });
}

function verifyClean(): void {
  const actualFiles = new Set(listFiles(OUTPUT_DIRECTORY));
  for (const [path, expected] of generatedFiles) {
    const absolute = resolve(OUTPUT_DIRECTORY, path);
    if (!actualFiles.delete(path) || !readFileSync(absolute).equals(Buffer.from(expected))) {
      throw new Error(`Generated worker vector differs: ${path}`);
    }
  }
  if (actualFiles.size !== 0) throw new Error(`Unexpected worker vector: ${[...actualFiles].sort()[0]}`);
}

function writeOutputs(): void {
  rmSync(OUTPUT_DIRECTORY, { force: true, recursive: true });
  for (const [path, bytes] of generatedFiles) {
    const absolute = resolve(OUTPUT_DIRECTORY, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes, { mode: 0o600 });
  }
}

async function main(): Promise<void> {
  await buildOutputs();
  if (CHECK_CLEAN) verifyClean();
  else writeOutputs();
  if (!existsSync(OUTPUT_PATH)) throw new Error('Worker vector manifest missing');
}

void main();
