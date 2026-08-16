import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

export const approvedMediumModel = Object.freeze({
  path: '/home/dmitry-vasiliev/.cache/openwhispr/whisper-models/ggml-medium.bin',
  sizeBytes: 1_533_763_059,
  sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  license: 'MIT',
  origin: 'ggerganov/whisper.cpp@5359861c739e955e79d9a303bcbc70fb988958b1',
});

const WORKER_REGISTRY_MAX_BYTES = 64 * 1024;

/** Captures and validates one bounded runtime-native registry document. */
export function captureWorkerRegistry(binary, expected) {
  const result = spawnSync(binary, ['--registry'], {
    cwd: '/',
    encoding: 'utf8',
    env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    maxBuffer: WORKER_REGISTRY_MAX_BYTES + 1,
    shell: false,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  // ggml emits backend discovery diagnostics on stderr for GPU runtimes. The
  // production registry path discards that private channel and accepts only
  // the exact bounded stdout document; keep CPU registry execution quiet.
  if (expected.backendId === 'cpu') assert.equal(result.stderr, '');
  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= WORKER_REGISTRY_MAX_BYTES);
  assert.match(result.stdout, /^[^\r\n]+\n$/u);
  const registry = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(registry).sort(), [
    'backendId',
    'engineId',
    'entries',
    'runtimeBuildDigest',
    'schemaVersion',
  ]);
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.engineId, 'whisperCpp');
  assert.equal(registry.backendId, expected.backendId);
  assert.equal(registry.runtimeBuildDigest, expected.runtimeBuildDigest);
  assert.match(registry.runtimeBuildDigest, /^[a-f0-9]{64}$/u);
  assert.ok(Array.isArray(registry.entries) && registry.entries.length <= 64);
  for (const [index, entry] of registry.entries.entries()) {
    assert.deepEqual(Object.keys(entry).sort(), ['backendId', 'nativeIdentity', 'ordinal', 'type']);
    assert.equal(entry.ordinal, index);
    assert.ok(entry.type === 'gpu' || entry.type === 'igpu');
    assert.equal(entry.backendId, expected.backendId);
    assert.equal(typeof entry.nativeIdentity, 'string');
    assert.ok(entry.nativeIdentity.length > 0 && entry.nativeIdentity.length <= 1_024);
    assert.equal(
      [...entry.nativeIdentity].some((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
      }),
      false,
    );
  }
  return registry;
}

export function sha256File(path) {
  const descriptor = openSync(path, 'r');
  const digest = createHash('sha256');
  const buffer = Buffer.alloc(64 * 1024);
  try {
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) return digest.digest('hex');
      digest.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(descriptor);
  }
}

/** Creates one state-owning exact reader for a worker output stream. */
function createBufferedReader(stream) {
  const iterator = stream[Symbol.asyncIterator]();
  let buffered = Buffer.alloc(0);
  return {
    async exact(size) {
      while (buffered.length < size) {
        const next = await iterator.next();
        if (next.done) throw new Error('Worker output ended early');
        buffered = Buffer.concat([buffered, next.value]);
      }
      const value = buffered.subarray(0, size);
      buffered = buffered.subarray(size);
      return value;
    },
  };
}

/** Owns one native integration worker and its framed private channels. */
export class WhisperCppWorkerProcess {
  constructor(child) {
    this.child = child;
    this.reader = createBufferedReader(child.stdout);
    this.exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  }

  static probe(binary, deviceAuthority = null) {
    const worker = new WhisperCppWorkerProcess(spawn(binary, ['--probe'], { stdio: ['pipe', 'pipe', 'ignore'] }));
    if (deviceAuthority !== null) worker.write(deviceAuthority);
    return worker;
  }

  static load(binary, deviceAuthority = null) {
    const worker = new WhisperCppWorkerProcess(spawn(binary, ['--load'], { stdio: ['pipe', 'pipe', 'ignore'] }));
    if (deviceAuthority !== null) worker.write(deviceAuthority);
    return worker;
  }

  write(bytes) {
    this.child.stdin.write(bytes);
  }

  sendControl(message) {
    this.write(controlFrame(message));
  }

  sendAudio(requestId, wav) {
    this.write(audioFrame(requestId, wav));
  }

  async readControl() {
    const header = await this.reader.exact(5);
    assert.equal(header[4], 1);
    const body = await this.reader.exact(header.readUInt32BE(0));
    return JSON.parse(body.toString('utf8'));
  }

  /** @deprecated Retained only for authenticated-loader rollback/reference tests. */
  async readModelAuthorityAcknowledgment(binding) {
    const acknowledgment = await this.reader.exact(284);
    assert.equal(acknowledgment.subarray(0, 8).toString('binary'), 'LWAA1\0\0\0');
    assert.deepEqual(acknowledgment.subarray(8, 234), binding);
    assert.equal(acknowledgment[234], 2);
    assert.equal(acknowledgment[235], 3);
    assert.equal(acknowledgment.readBigUInt64BE(236), 3n);
    assert.equal(acknowledgment.readBigUInt64BE(244), BigInt(this.child.pid));
  }

  closeInput() {
    this.child.stdin.end();
  }

  async waitForExit() {
    return await this.exit;
  }

  terminate() {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }
}

export function controlFrame(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 0);
  frame[4] = 1;
  body.copy(frame, 5);
  return frame;
}

export function audioFrame(requestId, wav) {
  const request = Buffer.from(requestId, 'utf8');
  const body = Buffer.alloc(8 + request.length + wav.length);
  body[0] = 1;
  body[1] = 1;
  body.writeUInt32BE(0, 2);
  body.writeUInt16BE(request.length, 6);
  request.copy(body, 8);
  wav.copy(body, 8 + request.length);
  const frame = Buffer.alloc(5 + body.length);
  frame.writeUInt32BE(body.length, 0);
  frame[4] = 2;
  body.copy(frame, 5);
  return frame;
}

export function modelBindingBytes(operationNonce, model = approvedMediumModel) {
  assert.equal(operationNonce.length, 16);
  const binding = Buffer.alloc(226);
  let offset = 0;
  operationNonce.copy(binding, offset);
  offset += 16;
  binding.fill(2, offset, offset + 16);
  offset += 16;
  binding.writeBigUInt64BE(7n, offset);
  offset += 8;
  binding.fill(3, offset, offset + 32);
  offset += 32;
  binding.fill(4, offset, offset + 32);
  offset += 32;
  binding.writeBigUInt64BE(BigInt(model.sizeBytes), offset);
  offset += 8;
  Buffer.from(model.sha256, 'hex').copy(binding, offset);
  offset += 32;
  binding[offset++] = 1;
  binding[offset++] = 3;
  binding.writeBigUInt64BE(BigInt(process.pid), offset);
  offset += 8;
  binding.writeBigUInt64BE(BigInt(process.pid), offset);
  offset += 8;
  binding.fill(6, offset, offset + 32);
  offset += 32;
  binding.fill(7, offset, offset + 32);
  assert.equal(offset + 32, binding.length);
  return binding;
}

export function modelTransferBytes(binding) {
  assert.equal(binding.length, 226);
  const transfer = Buffer.alloc(244);
  Buffer.from('LWAT1\0\0\0', 'binary').copy(transfer, 0);
  binding.copy(transfer, 8);
  transfer[234] = 2;
  transfer[235] = 3;
  transfer.writeBigUInt64BE(3n, 236);
  return transfer;
}

export function deviceAuthorityBytes(authorityIdBytes, configurationEpoch, topologyGeneration) {
  assert.equal(authorityIdBytes.length, 16);
  const record = Buffer.alloc(40);
  Buffer.from('LWDA1\0\0\0', 'binary').copy(record, 0);
  authorityIdBytes.copy(record, 8);
  record.writeBigUInt64BE(configurationEpoch, 24);
  record.writeBigUInt64BE(topologyGeneration, 32);
  return record;
}

export function canonicalSilence(sampleCount = 16_000) {
  const wav = Buffer.alloc(44 + sampleCount * 2);
  for (const [offset, value] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ])
    wav.write(value, offset, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.writeUInt32LE(sampleCount * 2, 40);
  return wav;
}

export function mediumModelIdentity() {
  return {
    engine: 'whisperCpp',
    logicalModel: 'medium',
    sourceCheckpointRevision: 'whisper-cpp-medium-fixture-5359861',
    artifactRevision: 'ggml-medium-bin-approved-task10',
    nativeFormat: 'ggml',
    variant: 'full',
  };
}

export function transcriptionOptions() {
  return {
    language: 'en',
    initialPrompt: '',
    temperatureHundredths: 0,
    strategy: 'greedy',
    candidateCount: null,
  };
}
