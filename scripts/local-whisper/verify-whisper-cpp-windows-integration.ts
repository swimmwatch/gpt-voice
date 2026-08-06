import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';

import {
  ManagedArtifactLease,
  type ManagedArtifactIdentitySnapshot,
} from '@main/localWhisper/filesystem/ManagedArtifactLease';
import { WindowsJobObjectOwner } from '@main/localWhisper/supervisor/WindowsJobObjectOwner';
import type {
  LocalWhisperOwnedWorkerProcess,
  LocalWhisperWorkerLaunchAuthority,
} from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId, type LocalWhisperRevisionId } from '@shared/localWhisper';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const TASK_INPUT_ROOT = path.resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'windows-readiness', 'inputs');
const MODEL_PATH = path.resolve(TASK_INPUT_ROOT, 'ggml-base.bin');
const MODEL_SIZE_BYTES = 147_951_465;
const MODEL_SHA256 = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe';
const MODEL_COMMIT = '5359861c739e955e79d9a303bcbc70fb988958b1';
const CPU_PROFILE = 'windows-x64-cpu-msvc-19.39-v1';
const CUDA_PROFILE = 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1';
const CONFIGURATION_EPOCH = 24;
const TOPOLOGY_GENERATION = 1n;
const MAX_REGISTRY_BYTES = 64 * 1024;
const FRAME_TIMEOUT_MS = 180_000;

interface RuntimeManifest {
  readonly backend: 'cpu' | 'cuda';
  readonly executable: string;
  readonly profileId: string;
  readonly runtimeBuildDigest: string;
  readonly runtimeRevision: string;
}

interface RuntimeRegistryEntry {
  readonly backendId: string;
  readonly nativeIdentity: string;
  readonly ordinal: number;
  readonly type: 'gpu' | 'igpu';
}

interface RuntimeRegistry {
  readonly backendId: string;
  readonly engineId: string;
  readonly entries: readonly RuntimeRegistryEntry[];
  readonly runtimeBuildDigest: string;
  readonly schemaVersion: number;
}

function revision(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid Windows integration revision');
  return parsed;
}

async function sha256File(filePath: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

function parseIdentity(value: string): ManagedArtifactIdentitySnapshot {
  const [deviceOrVolumeId, fileId, linkCount, mode, parentFileId, sizeBytes, type] = value.trim().split('\t');
  const identity = {
    deviceOrVolumeId,
    fileId,
    linkCount: Number(linkCount),
    mode: Number(mode),
    parentFileId,
    sizeBytes: Number(sizeBytes),
    type,
  };
  if (
    !identity.deviceOrVolumeId ||
    !identity.fileId ||
    !identity.parentFileId ||
    !Number.isSafeInteger(identity.linkCount) ||
    !Number.isSafeInteger(identity.mode) ||
    !Number.isSafeInteger(identity.sizeBytes) ||
    (identity.type !== 'directory' && identity.type !== 'regular')
  ) {
    throw new Error('Invalid Windows integration identity');
  }
  return identity as ManagedArtifactIdentitySnapshot;
}

function identityProbe(arguments_: readonly string[]): string {
  const executable = path.resolve(
    WORKSPACE_ROOT,
    '.cache',
    'local-whisper',
    'launcher',
    'fixtures',
    'local-whisper-launcher-identity-fixture.exe',
  );
  const result = spawnSync(executable, arguments_, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Windows integration identity probe failed');
  return result.stdout.trim();
}

function runtimeIdentities(
  directory: string,
  worker: string,
): {
  readonly directory: ManagedArtifactIdentitySnapshot;
  readonly worker: ManagedArtifactIdentitySnapshot;
} {
  const values = identityProbe(['--paths', directory, worker]).split(/\r?\n/u);
  if (values.length !== 2) throw new Error('Windows integration runtime identity count changed');
  return { directory: parseIdentity(values[0] ?? ''), worker: parseIdentity(values[1] ?? '') };
}

function modelIdentity(): ManagedArtifactIdentitySnapshot {
  return parseIdentity(identityProbe(['--model', MODEL_PATH]));
}

function artifactId(value: string) {
  const parsed = toLocalWhisperArtifactId(value);
  if (!parsed) throw new Error('Invalid Windows integration artifact ID');
  return parsed;
}

function lease(
  kind: 'model' | 'runtime',
  identity: ManagedArtifactIdentitySnapshot,
  token: string,
): ManagedArtifactLease {
  return new ManagedArtifactLease(
    {
      artifactId: artifactId(`windows-readiness-${kind}`),
      artifactKind: kind,
      canonicalName: `${kind}-${kind === 'model' ? MODEL_SHA256 : 'a'.repeat(64)}`,
      catalogDigest: 'b'.repeat(64),
      identity,
      purpose: 'load',
    },
    token,
    () => Promise.resolve(),
  );
}

function processOwner(): WindowsJobObjectOwner {
  const launcher = path.resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'launcher', 'local-whisper-launcher.exe');
  return new WindowsJobObjectOwner({
    environment: process.env,
    getProcessStartIdentity: (pid) => Promise.resolve(identityProbe(['--process', String(pid)])),
    launcherExecutablePath: launcher,
    launcherExecutableSha256: readFileSha256(launcher),
    modelGuardExecutablePath: path.resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'fs-guard', 'fs-guard.exe'),
  });
}

function readFileSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function deviceAuthority(operationNonce: Buffer): Uint8Array {
  assert.equal(operationNonce.byteLength, 16);
  const record = Buffer.alloc(40);
  Buffer.from('LWDA1\0\0\0', 'binary').copy(record);
  operationNonce.copy(record, 8);
  record.writeBigUInt64BE(BigInt(CONFIGURATION_EPOCH), 24);
  record.writeBigUInt64BE(TOPOLOGY_GENERATION, 32);
  return record;
}

function controlFrame(message: object): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const frame = Buffer.alloc(5 + body.byteLength);
  frame.writeUInt32BE(body.byteLength, 0);
  frame[4] = 1;
  body.copy(frame, 5);
  return frame;
}

function canonicalSilence(sampleCount = 16_000): Buffer {
  const wav = Buffer.alloc(44 + sampleCount * 2);
  for (const [offset, value] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const) {
    wav.write(value, offset, 'ascii');
  }
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

function audioFrame(requestId: string, wav: Buffer): Buffer {
  const request = Buffer.from(requestId, 'utf8');
  const body = Buffer.alloc(8 + request.byteLength + wav.byteLength);
  body[0] = 1;
  body[1] = 1;
  body.writeUInt32BE(0, 2);
  body.writeUInt16BE(request.byteLength, 6);
  request.copy(body, 8);
  wav.copy(body, 8 + request.byteLength);
  const frame = Buffer.alloc(5 + body.byteLength);
  frame.writeUInt32BE(body.byteLength, 0);
  frame[4] = 2;
  body.copy(frame, 5);
  return frame;
}

function write(stream: Writable, bytes: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.write(bytes, (error) => (error ? reject(new Error('Windows integration write failed')) : resolve()));
  });
}

class BoundedReader {
  readonly #iterator;
  #buffer = Buffer.alloc(0);

  public constructor(stream: Readable) {
    this.#iterator = stream[Symbol.asyncIterator]();
  }

  public async exact(size: number): Promise<Buffer> {
    while (this.#buffer.byteLength < size) {
      const next = await this.#iterator.next();
      if (next.done) throw new Error('Windows integration worker output ended');
      this.#buffer = Buffer.concat([this.#buffer, Buffer.from(next.value as Uint8Array)]);
      if (this.#buffer.byteLength > 2 * 1024 * 1024) throw new Error('Windows integration output exceeded');
    }
    const value = this.#buffer.subarray(0, size);
    this.#buffer = this.#buffer.subarray(size);
    return value;
  }
}

async function withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), FRAME_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class WorkerClient {
  readonly #reader: BoundedReader;

  public constructor(private readonly process: LocalWhisperOwnedWorkerProcess) {
    this.#reader = new BoundedReader(process.output);
    process.stderr.resume();
  }

  public async send(message: object): Promise<void> {
    await write(this.process.input, controlFrame(message));
  }

  public async sendAudio(requestId: string, wav: Buffer): Promise<void> {
    await write(this.process.input, audioFrame(requestId, wav));
  }

  public async receive(): Promise<Record<string, unknown>> {
    return await withTimeout(
      (async () => {
        const header = await this.#reader.exact(5);
        const length = header.readUInt32BE(0);
        if (header[4] !== 1 || length === 0 || length > 1024 * 1024) {
          throw new Error('Windows integration control frame invalid');
        }
        const value: unknown = JSON.parse((await this.#reader.exact(length)).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Windows integration control payload invalid');
        }
        return value as Record<string, unknown>;
      })(),
      'Windows integration worker response',
    );
  }
}

async function disposeOwned(process: LocalWhisperOwnedWorkerProcess | null): Promise<void> {
  if (!process || (await process.waitForExit(0))) return;
  process.closeOwnershipControl();
  await process.forceTreeTermination();
  if (!(await process.waitForExit(10_000))) throw new Error('Windows integration process cleanup failed');
}

function baseAuthority(
  manifest: RuntimeManifest,
  worker: string,
  identities: ReturnType<typeof runtimeIdentities>,
  runtimeLease: ManagedArtifactLease,
  launchMode: 'fullLoad' | 'probe' | 'registry',
): LocalWhisperWorkerLaunchAuthority {
  const workerSha256 = readFileSha256(worker);
  return {
    configurationEpoch: CONFIGURATION_EPOCH,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: revision(manifest.runtimeRevision),
      runtimeBuildDigest: manifest.runtimeBuildDigest,
      backend: manifest.backend,
      capabilities: [],
    },
    launchMode,
    runtimeIdentityKey: `windows-readiness-${manifest.backend}`,
    runtimeLease,
    workerExecutablePath: worker,
    workerFileIdentity: identities.worker,
    workerFileSha256: workerSha256,
    workingDirectoryPath: path.dirname(worker),
    revalidate: async () => {
      assert.deepEqual(runtimeIdentities(path.dirname(worker), worker), identities);
      assert.equal(readFileSha256(worker), workerSha256);
    },
  };
}

async function readRegistry(
  manifest: RuntimeManifest,
  worker: string,
  identities: ReturnType<typeof runtimeIdentities>,
  runtimeLease: ManagedArtifactLease,
): Promise<RuntimeRegistry> {
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner().launch(
      baseAuthority(manifest, worker, identities, runtimeLease, 'registry'),
      'windows_readiness_registry_24',
    );
    owned.stderr.resume();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of owned.output) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.byteLength;
      if (size > MAX_REGISTRY_BYTES) throw new Error('Windows integration registry exceeded');
      chunks.push(bytes);
    }
    if (!(await owned.waitForExit(10_000))) throw new Error('Windows integration registry did not exit');
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Windows integration registry invalid');
    }
    const registry = parsed as RuntimeRegistry;
    assert.equal(registry.schemaVersion, 1);
    assert.equal(registry.engineId, 'whisperCpp');
    assert.equal(registry.backendId, manifest.backend);
    assert.equal(registry.runtimeBuildDigest, manifest.runtimeBuildDigest);
    return registry;
  } finally {
    await disposeOwned(owned);
  }
}

class CanonicalDigest {
  readonly #chunks: Buffer[];

  public constructor(domain: string) {
    this.#chunks = [Buffer.from(domain, 'binary')];
  }

  public raw(value: Uint8Array): this {
    this.#chunks.push(Buffer.from(value));
    return this;
  }

  public u16(value: number): this {
    const encoded = Buffer.alloc(2);
    encoded.writeUInt16BE(value);
    return this.raw(encoded);
  }

  public field(value: string): this {
    const encoded = Buffer.from(value, 'utf8');
    return this.u16(encoded.byteLength).raw(encoded);
  }

  public finish(): string {
    const digest = createHash('sha256');
    for (const chunk of this.#chunks) digest.update(chunk);
    return digest.digest('hex');
  }
}

function registryFingerprint(runtimeBuildDigest: string, nativeIdentity: string): string {
  return new CanonicalDigest('LWREG1\0')
    .field('whisperCpp')
    .raw(Buffer.from(runtimeBuildDigest, 'hex'))
    .field('cuda')
    .u16(1)
    .u16(0)
    .raw(Buffer.of(1))
    .field('cuda')
    .field(nativeIdentity)
    .finish();
}

function canonicalCudaIdentity(value: string): string {
  const identity = value.trim().toLowerCase();
  if (!/^[a-f0-9]{8}:[a-f0-9]{2}:[a-f0-9]{2}\.[0-7]$/u.test(identity) || !identity.startsWith('0000')) {
    throw new Error('Windows integration CUDA identity invalid');
  }
  return identity.slice(4);
}

function safeStageFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN';
  if (
    /^Local Whisper [A-Za-z ]+(?:: [A-Z][A-Z0-9_]{0,63})?$/u.test(error.message) ||
    /^Windows (?:cpu|cuda) load failed with [A-Z][A-Z0-9_]{0,63}$/u.test(error.message) ||
    /^Windows integration (?:registry|worker) [A-Za-z ]+$/u.test(error.message)
  ) {
    return error.message;
  }
  return error.name;
}

function verifyRtx5090(registry: RuntimeRegistry): string {
  const result = spawnSync(
    'nvidia-smi.exe',
    ['--query-gpu=index,name,pci.bus_id,compute_cap,driver_version', '--format=csv,noheader,nounits'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (result.status !== 0) throw new Error('Windows integration NVIDIA probe failed');
  const rows = result.stdout.trim().split(/\r?\n/u);
  assert.equal(rows.length, 1, 'Windows Task 24 requires exactly one visible RTX 5090');
  const [index, name, busId, computeCapability, driver] = (rows[0] ?? '').split(',').map((value) => value.trim());
  assert.equal(index, '0');
  assert.equal(name, 'NVIDIA GeForce RTX 5090');
  assert.equal(computeCapability, '12.0');
  const driverParts = driver.split('.').map(Number);
  assert.equal(driverParts.every(Number.isInteger), true);
  assert.equal(driverParts[0] > 570 || (driverParts[0] === 570 && (driverParts[1] ?? 0) >= 65), true);
  assert.equal(registry.entries.length, 1);
  const entry = registry.entries[0];
  assert.ok(entry);
  assert.equal(entry.ordinal, 0);
  assert.equal(entry.type, 'gpu');
  assert.equal(entry.backendId, 'cuda');
  assert.equal(entry.nativeIdentity, canonicalCudaIdentity(busId));
  return entry.nativeIdentity;
}

async function verifyProbe(
  manifest: RuntimeManifest,
  worker: string,
  identities: ReturnType<typeof runtimeIdentities>,
  runtimeLease: ManagedArtifactLease,
  nativeIdentity: string | null,
): Promise<string | null> {
  const operationNonce = Buffer.alloc(16, 0x24);
  const authority = baseAuthority(manifest, worker, identities, runtimeLease, 'probe');
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner().launch(authority, 'windows_readiness_probe_24');
    const client = new WorkerClient(owned);
    if (manifest.backend === 'cuda') await write(owned.input, deviceAuthority(operationNonce));
    await client.send({ type: 'hello', protocolVersion: 1 });
    const hello = await client.receive();
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, manifest.backend);
    assert.equal(hello.runtimeBuildDigest, manifest.runtimeBuildDigest);
    const request: Record<string, unknown> = {
      type: 'probe',
      protocolVersion: 1,
      requestId: `probe-windows-${manifest.backend}-24`,
      authorityId: operationNonce.toString('base64url'),
      deviceBinding: manifest.backend === 'cpu' ? { kind: 'cpu' } : { kind: 'gpuIndex', index: 0 },
    };
    let fingerprint: string | null = null;
    if (manifest.backend === 'cuda') {
      assert.ok(nativeIdentity);
      fingerprint = registryFingerprint(manifest.runtimeBuildDigest, nativeIdentity);
      request.probeChallenge = Buffer.alloc(32, 0x25).toString('base64url');
      request.registryFingerprint = fingerprint;
    }
    await client.send(request);
    const probed = await client.receive();
    assert.equal(probed.type, 'probed');
    if (manifest.backend === 'cuda') {
      assert.equal(probed.actualNativeIdentity, nativeIdentity);
      assert.equal(probed.primaryExecutionNativeIdentity, nativeIdentity);
      assert.equal(probed.registryFingerprint, fingerprint);
      assert.match(String(probed.probeProof), /^[a-f0-9]{64}$/u);
    } else {
      for (const field of [
        'actualNativeIdentity',
        'primaryExecutionNativeIdentity',
        'registryFingerprint',
        'probeProof',
      ]) {
        assert.equal(Object.prototype.hasOwnProperty.call(probed, field), false);
      }
    }
    owned.input.end();
    assert.equal(await owned.waitForExit(30_000), true);
    return fingerprint;
  } finally {
    await disposeOwned(owned);
  }
}

async function verifyLoad(
  manifest: RuntimeManifest,
  worker: string,
  identities: ReturnType<typeof runtimeIdentities>,
  runtimeLease: ManagedArtifactLease,
  nativeIdentity: string | null,
  fingerprint: string | null,
): Promise<void> {
  const operationNonce = Buffer.from('24242424242424242424242424242424', 'hex');
  const modelLeaseToken = `windows-readiness-model-${manifest.backend}`;
  const modelFileIdentity = modelIdentity();
  const modelLease = lease('model', modelFileIdentity, modelLeaseToken);
  const authority: LocalWhisperWorkerLaunchAuthority = {
    ...baseAuthority(manifest, worker, identities, runtimeLease, 'fullLoad'),
    ...(manifest.backend === 'cuda' ? { workerInputBootstrap: deviceAuthority(operationNonce) } : {}),
    modelGuardAuthority: {
      modelFileIdentity,
      modelFilePath: MODEL_PATH,
      modelFileSha256: MODEL_SHA256,
      modelFileSizeBytes: MODEL_SIZE_BYTES,
      modelIdentityKey: 'windows-readiness-base-full',
      modelLease,
      modelLeaseTokenDigest: createHash('sha256').update(modelLeaseToken, 'utf8').digest('hex'),
      operationNonce,
      revalidate: async () => {
        assert.deepEqual(modelIdentity(), modelFileIdentity);
        assert.equal(await sha256File(MODEL_PATH), MODEL_SHA256);
      },
    },
  };
  let owned: LocalWhisperOwnedWorkerProcess | null = null;
  try {
    owned = await processOwner().launch(authority, `windows_readiness_load_${manifest.backend}_24`);
    const client = new WorkerClient(owned);
    await client.send({ type: 'hello', protocolVersion: 1 });
    const hello = await client.receive();
    assert.equal(hello.type, 'helloAck');
    assert.equal(hello.backend, manifest.backend);
    const authorityId = operationNonce.toString('base64url');
    const model = {
      engine: 'whisperCpp',
      logicalModel: 'base',
      sourceCheckpointRevision: MODEL_COMMIT,
      artifactRevision: 'whisper-cpp-base-full-v1',
      nativeFormat: 'ggml',
      variant: 'full',
    };
    const residency = {
      engine: 'whisperCpp',
      runtimePackRevision: manifest.runtimeRevision,
      target: manifest.backend === 'cpu' ? 'cpu' : 'gpu',
      backend: manifest.backend,
      deviceId: manifest.backend === 'cpu' ? null : 'windows-readiness-rtx-5090',
      model,
      resolvedCpuThreads: manifest.backend === 'cpu' ? 2 : null,
    };
    const load: Record<string, unknown> = {
      type: 'load',
      protocolVersion: 1,
      requestId: `load-windows-${manifest.backend}-24`,
      authorityId,
      deviceBinding: manifest.backend === 'cpu' ? { kind: 'cpu' } : { kind: 'gpuIndex', index: 0 },
      residency,
    };
    if (manifest.backend === 'cuda') {
      assert.ok(nativeIdentity && fingerprint);
      load.loadChallenge = Buffer.alloc(32, 0x26).toString('base64url');
      load.registryFingerprint = fingerprint;
    }
    await client.send(load);
    const loaded = await client.receive();
    const loadedFailureCode = typeof loaded.code === 'string' ? loaded.code : 'unknown';
    assert.equal(loaded.type, 'loaded', `Windows ${manifest.backend} load failed with ${loadedFailureCode}`);
    assert.equal(loaded.modelSha256, MODEL_SHA256);
    assert.equal(loaded.effectiveBackend, manifest.backend);
    assert.equal(loaded.primaryStateOwnership, 'worker');
    if (manifest.backend === 'cuda') {
      assert.equal(loaded.actualNativeIdentity, nativeIdentity);
      assert.equal(loaded.primaryExecutionNativeIdentity, nativeIdentity);
      assert.equal(loaded.registryFingerprint, fingerprint);
      assert.ok(
        Number.isSafeInteger(loaded.selectedDeviceModelWeightBytes) &&
          Number(loaded.selectedDeviceModelWeightBytes) > 0,
      );
      assert.match(String(loaded.loadProof), /^[a-f0-9]{64}$/u);
    }
    await client.send({ type: 'warmup', protocolVersion: 1, requestId: `warm-windows-${manifest.backend}-24` });
    assert.equal((await client.receive()).type, 'warmed');
    const wav = canonicalSilence();
    const transcriptionId = `transcribe-windows-${manifest.backend}-24`;
    await client.send({
      type: 'transcribe',
      protocolVersion: 1,
      requestId: transcriptionId,
      settingsEpoch: CONFIGURATION_EPOCH,
      audioByteLength: wav.byteLength,
      options: {
        language: 'en',
        initialPrompt: '',
        temperatureHundredths: 0,
        strategy: 'greedy',
        candidateCount: null,
      },
    });
    await client.sendAudio(transcriptionId, wav);
    const transcript = await client.receive();
    assert.equal(transcript.type, 'transcript');
    assert.equal(typeof transcript.text, 'string');
    await client.send({ type: 'unload', protocolVersion: 1, requestId: `unload-windows-${manifest.backend}-24` });
    assert.equal((await client.receive()).type, 'unloaded');
    await client.send({ type: 'shutdown', protocolVersion: 1, requestId: `shutdown-windows-${manifest.backend}-24` });
    assert.equal((await client.receive()).type, 'shutdownAck');
    owned.input.end();
    assert.equal(await owned.waitForExit(60_000), true);
  } finally {
    await disposeOwned(owned);
    await modelLease.release();
  }
}

async function main(): Promise<void> {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Windows integration requires native Windows x64');
  }
  const backend = process.argv.find((argument) => argument.startsWith('--backend='))?.slice('--backend='.length);
  if (backend !== 'cpu' && backend !== 'cuda') throw new Error('Expected --backend=cpu or --backend=cuda');
  const profile = backend === 'cpu' ? CPU_PROFILE : CUDA_PROFILE;
  const packRoot = path.resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'whisper-cpp', 'stage', profile);
  const manifest = JSON.parse(readFileSync(path.resolve(packRoot, 'runtime-manifest.json'), 'utf8')) as RuntimeManifest;
  assert.equal(manifest.profileId, profile);
  assert.equal(manifest.backend, backend);
  const worker = path.resolve(packRoot, ...manifest.executable.split('/'));
  for (const required of [MODEL_PATH, worker]) {
    if (!existsSync(required)) throw new Error('Windows integration input missing');
  }
  assert.equal(await sha256File(MODEL_PATH), MODEL_SHA256);
  const identities = runtimeIdentities(path.dirname(worker), worker);
  const runtimeLease = lease('runtime', identities.directory, `windows-readiness-runtime-${backend}`);
  try {
    const registry = await readRegistry(manifest, worker, identities, runtimeLease).catch((error: unknown) => {
      throw new Error(`Windows ${backend} registry stage failed:${safeStageFailure(error)}`);
    });
    const nativeIdentity = backend === 'cuda' ? verifyRtx5090(registry) : null;
    if (backend === 'cpu') assert.deepEqual(registry.entries, []);
    const fingerprint = await verifyProbe(manifest, worker, identities, runtimeLease, nativeIdentity).catch(
      (error: unknown) => {
        throw new Error(`Windows ${backend} probe stage failed:${safeStageFailure(error)}`);
      },
    );
    await verifyLoad(manifest, worker, identities, runtimeLease, nativeIdentity, fingerprint).catch(
      (error: unknown) => {
        throw new Error(`Windows ${backend} load stage failed:${safeStageFailure(error)}`);
      },
    );
  } finally {
    await runtimeLease.release();
  }
  process.stdout.write(`Local Whisper Windows ${backend} launcher integration verified\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Windows Whisper.cpp integration failed'}\n`);
  process.exitCode = 1;
});
