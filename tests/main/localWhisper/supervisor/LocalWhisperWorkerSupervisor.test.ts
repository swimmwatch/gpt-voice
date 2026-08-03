/* eslint-disable max-classes-per-file -- the fixture doubles model distinct clock, record, process, and ownership lifecycles. */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import {
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  encodeLocalWhisperControlFrame,
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperRevisionId,
  type LocalWhisperWorkerClientMessage,
  type LocalWhisperWorkerDeviceBinding,
} from '@shared/localWhisper';
import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import { LocalWhisperFrameCodec } from '@main/localWhisper/supervisor/LocalWhisperFrameCodec';
import { getLocalWhisperTranscriptionTimeoutMs } from '@main/localWhisper/supervisor/LocalWhisperSupervisorConstants';
import {
  LocalWhisperWorkerSupervisor,
  type LocalWhisperSupervisorClock,
} from '@main/localWhisper/supervisor/LocalWhisperWorkerSupervisor';
import { LocalWhisperWorkerTransport } from '@main/localWhisper/supervisor/LocalWhisperWorkerTransport';
import {
  WorkerProcessOwnership,
  type LocalWhisperOwnedWorkerProcess,
  type LocalWhisperWorkerLaunchAuthority,
  type LocalWhisperWorkerOwnershipRecord,
  type LocalWhisperWorkerOwnershipRecordStore,
  type LocalWhisperWorkerProcessOwner,
} from '@main/localWhisper/supervisor/WorkerProcessOwnership';

type WorkerMode =
  | 'bindingMismatch'
  | 'cancel'
  | 'cleanupFailure'
  | 'handshakeMismatch'
  | 'hangHandshake'
  | 'hangLoad'
  | 'hangProbe'
  | 'hangTranscription'
  | 'hangUnload'
  | 'hangWarmup'
  | 'happy'
  | 'loadBindingMismatch'
  | 'nativeObjectOrder'
  | 'outOfOrder';

const GPU_DEVICE_BINDING = Object.freeze({ kind: 'gpuIndex', index: 0 }) satisfies LocalWhisperWorkerDeviceBinding;
const AUTHORITY_ID = 'AAECAwQFBgcICQoLDA0ODw';
const PROBE_CHALLENGE = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';
const LOAD_CHALLENGE = 'QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8';
const REGISTRY_FINGERPRINT = 'e'.repeat(64);

function bindingAuthority(
  revalidateDeviceBinding: () => Promise<LocalWhisperWorkerDeviceBinding | null> = async () => GPU_DEVICE_BINDING,
) {
  return {
    authorityId: AUTHORITY_ID,
    deviceBinding: GPU_DEVICE_BINDING,
    loadChallenge: LOAD_CHALLENGE,
    probeChallenge: PROBE_CHALLENGE,
    registryFingerprint: REGISTRY_FINGERPRINT,
    revalidateDeviceBinding,
    validateEvidence: async () => true,
  } as const;
}

function probeRequest(
  configurationEpoch: number,
  revalidateDeviceBinding?: () => Promise<LocalWhisperWorkerDeviceBinding | null>,
) {
  return { configurationEpoch, ...bindingAuthority(revalidateDeviceBinding) } as const;
}

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid fixture revision');
  return result;
}

function selectedResidency(): LocalWhisperResidencyKey {
  const deviceId = toLocalWhisperOpaqueDeviceId('fixture-gpu');
  if (!deviceId) throw new Error('Invalid fixture device');
  return {
    engine: 'whisperCpp',
    runtimePackRevision: revision('runtime-v1'),
    target: 'gpu',
    backend: 'cuda',
    deviceId,
    model: {
      engine: 'whisperCpp',
      logicalModel: 'tiny',
      sourceCheckpointRevision: revision('checkpoint-v1'),
      artifactRevision: revision('model-v1'),
      nativeFormat: 'ggml',
      variant: 'full',
    },
    resolvedCpuThreads: null,
  };
}

function nativeOrderedResidency(value: LocalWhisperResidencyKey): LocalWhisperResidencyKey {
  return {
    backend: value.backend,
    deviceId: value.deviceId,
    engine: value.engine,
    model: {
      artifactRevision: value.model.artifactRevision,
      engine: value.model.engine,
      logicalModel: value.model.logicalModel,
      nativeFormat: value.model.nativeFormat,
      sourceCheckpointRevision: value.model.sourceCheckpointRevision,
      variant: value.model.variant,
    },
    resolvedCpuThreads: value.resolvedCpuThreads,
    runtimePackRevision: value.runtimePackRevision,
    target: value.target,
  };
}

function canonicalWav(durationMs: number): Uint8Array {
  const sampleCount = Math.max(1, Math.round(durationMs * 16));
  const result = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(result.buffer);
  for (const [offset, value] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const) {
    result.set(new TextEncoder().encode(value), offset);
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

class FakeClock implements LocalWhisperSupervisorClock {
  private nextHandle = 1;
  private readonly timers = new Map<number, { callback: () => void; milliseconds: number }>();

  public clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') this.timers.delete(handle);
  }

  public setTimeout(callback: () => void, milliseconds: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.timers.set(handle, { callback, milliseconds });
    return handle;
  }

  public fire(milliseconds: number): void {
    const timer = [...this.timers.entries()].find(([, candidate]) => candidate.milliseconds === milliseconds);
    if (!timer) throw new Error(`Missing fixture timer ${milliseconds}`);
    this.timers.delete(timer[0]);
    timer[1].callback();
  }

  public has(milliseconds: number): boolean {
    return [...this.timers.values()].some((candidate) => candidate.milliseconds === milliseconds);
  }
}

async function fireTimer(clock: FakeClock, milliseconds: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (clock.has(milliseconds)) {
      clock.fire(milliseconds);
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`Missing fixture timer ${milliseconds}`);
}

class MemoryRecordStore implements LocalWhisperWorkerOwnershipRecordStore {
  public record: LocalWhisperWorkerOwnershipRecord | null = null;

  public async read(): Promise<
    { readonly kind: 'missing' } | { readonly kind: 'valid'; readonly record: LocalWhisperWorkerOwnershipRecord }
  > {
    return this.record ? { kind: 'valid', record: this.record } : { kind: 'missing' };
  }

  public async write(record: LocalWhisperWorkerOwnershipRecord): Promise<void> {
    this.record = record;
  }

  public async remove(record: LocalWhisperWorkerOwnershipRecord): Promise<void> {
    assert.deepEqual(this.record, record);
    this.record = null;
  }
}

class ScriptedWorkerProcess implements LocalWhisperOwnedWorkerProcess {
  public readonly pid = 4242;
  public readonly processStartIdentity = 'fixture-process-start';
  public readonly input = new PassThrough();
  public readonly output = new PassThrough();
  public readonly stderr = new PassThrough();
  private readonly codec = new LocalWhisperFrameCodec();
  private exited = false;
  public readonly waitTimeouts: number[] = [];

  public constructor(private readonly mode: WorkerMode) {
    this.input.on('data', (chunk: Buffer) => this.onInput(chunk));
  }

  public closeOwnershipControl(): void {
    if (this.mode !== 'cleanupFailure') this.exited = true;
  }

  public async requestTreeTermination(): Promise<void> {
    if (this.mode !== 'cleanupFailure') this.exited = true;
  }

  public async forceTreeTermination(): Promise<void> {
    if (this.mode !== 'cleanupFailure') this.exited = true;
  }

  public async waitForExit(timeoutMs: number): Promise<boolean> {
    this.waitTimeouts.push(timeoutMs);
    return this.exited;
  }

  private onInput(chunk: Buffer): void {
    for (const frame of this.codec.push(chunk)) {
      if (frame.kind === 'audio') {
        if (frame.chunk.final && this.mode === 'happy') {
          this.respond({
            type: 'transcript',
            protocolVersion: 1,
            requestId: frame.chunk.requestId,
            text: 'fixture transcript',
          });
        }
        continue;
      }
      this.onMessage(frame.message as LocalWhisperWorkerClientMessage);
    }
  }

  private onMessage(message: LocalWhisperWorkerClientMessage): void {
    switch (message.type) {
      case 'hello':
        if (this.mode === 'hangHandshake') break;
        this.respond({
          type: 'helloAck',
          protocolVersion: 1,
          engine: 'whisperCpp',
          runtimeRevision: revision(this.mode === 'handshakeMismatch' ? 'wrong-v1' : 'runtime-v1'),
          runtimeBuildDigest: 'a'.repeat(64),
          backend: 'cuda',
          capabilities: ['cuda-sm-86'],
          maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
          maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
        });
        break;
      case 'probe':
        if (this.mode === 'hangProbe') break;
        if (this.mode === 'outOfOrder') {
          this.respond({ type: 'warmed', protocolVersion: 1, requestId: message.requestId });
          break;
        }
        if (!('registryFingerprint' in message)) throw new Error('Expected GPU probe fixture');
        this.respond({
          type: 'probed',
          protocolVersion: 1,
          requestId: message.requestId,
          activatedOrdinal: this.mode === 'bindingMismatch' ? 1 : message.deviceBinding.index,
          actualNativeIdentity: '0000:01:00.0',
          authorityId: message.authorityId,
          deviceBinding: this.mode === 'bindingMismatch' ? { kind: 'gpuIndex', index: 1 } : message.deviceBinding,
          primaryExecutionNativeIdentity: '0000:01:00.0',
          probeProof: 'c'.repeat(64),
          registryFingerprint: message.registryFingerprint,
        });
        break;
      case 'load': {
        if (this.mode === 'hangLoad') break;
        if (!('registryFingerprint' in message)) throw new Error('Expected GPU load fixture');
        const residency =
          this.mode === 'nativeObjectOrder' ? nativeOrderedResidency(message.residency) : message.residency;
        this.respond({
          type: 'loaded',
          protocolVersion: 1,
          requestId: message.requestId,
          activatedOrdinal: this.mode === 'loadBindingMismatch' ? 1 : message.deviceBinding.index,
          actualNativeIdentity: '0000:01:00.0',
          authorityId: message.authorityId,
          deviceBinding: this.mode === 'loadBindingMismatch' ? { kind: 'gpuIndex', index: 1 } : message.deviceBinding,
          effectiveBackend: residency.backend,
          loadProof: 'd'.repeat(64),
          model: residency.model,
          modelSha256: 'b'.repeat(64),
          primaryExecutionNativeIdentity: '0000:01:00.0',
          primaryStateOwnership: 'worker',
          registryFingerprint: message.registryFingerprint,
          residency,
          selectedDeviceModelWeightBytes: 1_048_576,
        });
        break;
      }
      case 'warmup':
        if (this.mode === 'hangWarmup') break;
        this.respond({ type: 'warmed', protocolVersion: 1, requestId: message.requestId });
        break;
      case 'cancel':
        this.respond({
          type: 'cancelled',
          protocolVersion: 1,
          requestId: message.requestId,
          targetRequestId: message.targetRequestId,
        });
        break;
      case 'unload':
        if (this.mode === 'hangUnload') break;
        this.respond({ type: 'unloaded', protocolVersion: 1, requestId: message.requestId });
        break;
      case 'shutdown':
        this.respond({ type: 'shutdownAck', protocolVersion: 1, requestId: message.requestId });
        if (this.mode !== 'cleanupFailure') this.exited = true;
        break;
      case 'transcribe':
        break;
    }
  }

  private respond(message: Parameters<typeof encodeLocalWhisperControlFrame>[0]): void {
    this.output.write(encodeLocalWhisperControlFrame(message));
  }
}

class ScriptedProcessOwner implements LocalWhisperWorkerProcessOwner {
  public process: ScriptedWorkerProcess | null = null;

  public constructor(private readonly mode: WorkerMode) {}

  public async launch(): Promise<LocalWhisperOwnedWorkerProcess> {
    this.process = new ScriptedWorkerProcess(this.mode);
    return this.process;
  }

  public async recoverOwnedOrphan(): Promise<boolean> {
    this.process = null;
    return true;
  }
}

function lease(kind: 'model' | 'runtime', released: { value: number }): ManagedArtifactLease {
  const artifactId = toLocalWhisperArtifactId(`${kind}-fixture`);
  if (!artifactId) throw new Error('Invalid fixture artifact');
  return new ManagedArtifactLease(
    {
      artifactId,
      artifactKind: kind,
      canonicalName: `${kind}-${'a'.repeat(64)}`,
      catalogDigest: 'b'.repeat(64),
      identity: {
        deviceOrVolumeId: '1',
        fileId: kind === 'model' ? '2' : '3',
        linkCount: 1,
        mode: 0o500,
        parentFileId: '4',
        sizeBytes: 100,
        type: 'directory',
      },
      purpose: 'load',
    },
    `${kind}-token`,
    async () => {
      released.value += 1;
    },
  );
}

function harness(mode: WorkerMode): {
  readonly clock: FakeClock;
  readonly modelLease: ManagedArtifactLease;
  readonly recordStore: MemoryRecordStore;
  readonly releasedModel: { value: number };
  readonly releasedRuntime: { value: number };
  readonly processOwner: ScriptedProcessOwner;
  readonly supervisor: LocalWhisperWorkerSupervisor;
  readonly authority: LocalWhisperWorkerLaunchAuthority;
} {
  const clock = new FakeClock();
  const releasedRuntime = { value: 0 };
  const releasedModel = { value: 0 };
  const runtimeLease = lease('runtime', releasedRuntime);
  const modelLease = lease('model', releasedModel);
  const recordStore = new MemoryRecordStore();
  const processOwner = new ScriptedProcessOwner(mode);
  const ownership = new WorkerProcessOwnership({
    processOwner,
    randomNonce: () => 'fixture_nonce_1234',
    recordStore,
  });
  let requestNumber = 0;
  const supervisor = new LocalWhisperWorkerSupervisor({
    clock,
    createTransport: (streams, callbacks) => new LocalWhisperWorkerTransport(streams, callbacks),
    nextRequestId: () => {
      requestNumber += 1;
      return `request-${requestNumber}`;
    },
    ownership,
  });
  const authority: LocalWhisperWorkerLaunchAuthority = {
    configurationEpoch: 7,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: revision('runtime-v1'),
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: ['cuda-sm-86'],
    },
    launchMode: 'probe',
    runtimeIdentityKey: 'fixture-runtime-identity',
    runtimeLease,
    workerExecutablePath: '/private/runtime/worker',
    workerFileIdentity: {
      deviceOrVolumeId: '1',
      fileId: '5',
      linkCount: 1,
      mode: 0o500,
      parentFileId: '3',
      sizeBytes: 100,
      type: 'regular',
    },
    workerFileSha256: 'b'.repeat(64),
    workingDirectoryPath: '/private/runtime',
    revalidate: async () => undefined,
  };
  return {
    authority,
    clock,
    modelLease,
    processOwner,
    recordStore,
    releasedModel,
    releasedRuntime,
    supervisor,
  };
}

async function readyHarness(mode: WorkerMode): Promise<ReturnType<typeof harness>> {
  const value = harness(mode);
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  assert.equal((await value.supervisor.probe(probeRequest(7))).success, true);
  assert.equal(
    (
      await value.supervisor.load({
        ...bindingAuthority(),
        configurationEpoch: 7,
        modelLease: value.modelLease,
        residency: selectedResidency(),
        revalidate: async () => undefined,
      })
    ).success,
    true,
  );
  assert.equal((await value.supervisor.warmup(7)).success, true);
  return value;
}

test('supervisor enforces handshake, probe, load, warm-up, transcription, unload, and cleanup', async () => {
  const value = await readyHarness('happy');
  assert.equal(value.recordStore.record?.runtimeBuildDigest, 'a'.repeat(64));
  const transcription = await value.supervisor.transcribe({
    audio: canonicalWav(100),
    configurationEpoch: 7,
    settingsEpoch: 4,
    options: {
      language: null,
      initialPrompt: '',
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: null,
    },
  });
  assert.deepEqual(transcription, { success: true, state: 'warmed', value: 'fixture transcript' });
  assert.equal((await value.supervisor.unload(7)).success, true);
  assert.equal(value.supervisor.state, 'idle');
  assert.equal(value.releasedRuntime.value, 1);
  assert.equal(value.releasedModel.value, 1);
  assert.equal(value.recordStore.record, null);
});

test('fresh full-load worker loads without upgrading a probe process', async () => {
  const value = harness('happy');
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  const loaded = await value.supervisor.load({
    ...bindingAuthority(),
    configurationEpoch: 7,
    modelLease: value.modelLease,
    residency: selectedResidency(),
    revalidate: async () => undefined,
  });
  assert.equal(loaded.success, true);
  assert.equal((await value.supervisor.shutdown()).success, true);
  assert.equal(value.releasedModel.value, 1);
  assert.equal(value.releasedRuntime.value, 1);
});

test('supervisor accepts native key ordering for identical residency evidence', async () => {
  const value = harness('nativeObjectOrder');
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  const loaded = await value.supervisor.load({
    ...bindingAuthority(),
    configurationEpoch: 7,
    modelLease: value.modelLease,
    residency: selectedResidency(),
    revalidate: async () => undefined,
  });
  assert.equal(loaded.success, true);
  assert.equal((await value.supervisor.shutdown()).success, true);
});

test('supervisor revalidates the private binding before and after probe and load', async () => {
  const value = harness('happy');
  let probeChecks = 0;
  let loadChecks = 0;
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  assert.equal(
    (
      await value.supervisor.probe(
        probeRequest(7, async () => {
          probeChecks += 1;
          return GPU_DEVICE_BINDING;
        }),
      )
    ).success,
    true,
  );
  assert.equal(probeChecks, 2);
  assert.equal(
    (
      await value.supervisor.load({
        ...bindingAuthority(async () => {
          loadChecks += 1;
          return GPU_DEVICE_BINDING;
        }),
        configurationEpoch: 7,
        modelLease: value.modelLease,
        residency: selectedResidency(),
        revalidate: async () => undefined,
      })
    ).success,
    true,
  );
  assert.equal(loadChecks, 2);
  assert.equal((await value.supervisor.forceCleanup()).success, true);
});

test('supervisor cleans up changed or disappeared binding authority and rejects peer mismatch', async () => {
  const disappeared = harness('happy');
  let probeChecks = 0;
  assert.equal((await disappeared.supervisor.startAndHandshake(disappeared.authority)).success, true);
  const disappearedResult = await disappeared.supervisor.probe(
    probeRequest(7, async () => {
      probeChecks += 1;
      return probeChecks === 1 ? GPU_DEVICE_BINDING : null;
    }),
  );
  assert.equal(disappearedResult.success, false);
  if (!disappearedResult.success) assert.equal(disappearedResult.error.code, 'DEVICE_NOT_FOUND');
  assert.equal(disappeared.releasedRuntime.value, 1);

  const changed = harness('happy');
  assert.equal((await changed.supervisor.startAndHandshake(changed.authority)).success, true);
  assert.equal((await changed.supervisor.probe(probeRequest(7))).success, true);
  let loadChecks = 0;
  const changedResult = await changed.supervisor.load({
    ...bindingAuthority(async () => {
      loadChecks += 1;
      return loadChecks === 1 ? GPU_DEVICE_BINDING : { kind: 'gpuIndex', index: 1 };
    }),
    configurationEpoch: 7,
    modelLease: changed.modelLease,
    residency: selectedResidency(),
    revalidate: async () => undefined,
  });
  assert.equal(changedResult.success, false);
  if (!changedResult.success) assert.equal(changedResult.error.code, 'DEVICE_NOT_FOUND');
  assert.equal(changed.releasedRuntime.value, 1);
  assert.equal(changed.releasedModel.value, 1);

  for (const mode of ['bindingMismatch', 'loadBindingMismatch'] as const) {
    const peer = harness(mode);
    assert.equal((await peer.supervisor.startAndHandshake(peer.authority)).success, true);
    const peerResult =
      mode === 'bindingMismatch'
        ? await peer.supervisor.probe(probeRequest(7))
        : await (async () => {
            assert.equal((await peer.supervisor.probe(probeRequest(7))).success, true);
            return peer.supervisor.load({
              ...bindingAuthority(),
              configurationEpoch: 7,
              modelLease: peer.modelLease,
              residency: selectedResidency(),
              revalidate: async () => undefined,
            });
          })();
    assert.equal(peerResult.success, false, mode);
    if (!peerResult.success) assert.equal(peerResult.error.code, 'WORKER_PROTOCOL_VIOLATION', mode);
    assert.equal(peer.releasedRuntime.value, 1, mode);
  }
});

test('supervisor rejects handshake mismatch and out-of-order stage result then proves cleanup', async () => {
  const mismatch = harness('handshakeMismatch');
  const mismatchResult = await mismatch.supervisor.startAndHandshake(mismatch.authority);
  assert.equal(mismatchResult.success, false);
  if (!mismatchResult.success) assert.equal(mismatchResult.error.code, 'WORKER_PROTOCOL_MISMATCH');
  assert.equal(mismatch.releasedRuntime.value, 1);

  const outOfOrder = harness('outOfOrder');
  assert.equal((await outOfOrder.supervisor.startAndHandshake(outOfOrder.authority)).success, true);
  const probe = await outOfOrder.supervisor.probe(probeRequest(7));
  assert.equal(probe.success, false);
  if (!probe.success) assert.equal(probe.error.code, 'WORKER_PROTOCOL_VIOLATION');
  assert.equal(outOfOrder.recordStore.record, null);
});

test('supervisor attributes probe timeout exactly and never falls back', async () => {
  const value = harness('hangProbe');
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  const probe = value.supervisor.probe(probeRequest(7));
  await fireTimer(value.clock, 30_000);
  const result = await probe;
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'OPERATION_TIMEOUT');
    assert.equal(result.error.stage, 'backendInitialization');
  }
  assert.equal(value.supervisor.state, 'idle');
});

test('supervisor enforces exact handshake, load, warm-up, inference, and unload deadlines', async () => {
  const handshake = harness('hangHandshake');
  const handshakeResult = handshake.supervisor.startAndHandshake(handshake.authority);
  await Promise.resolve();
  await fireTimer(handshake.clock, 10_000);
  const handshakeFailure = await handshakeResult;
  assert.equal(handshakeFailure.success, false);
  if (!handshakeFailure.success) {
    assert.equal(handshakeFailure.error.code, 'OPERATION_TIMEOUT');
    assert.equal(handshakeFailure.error.stage, 'workerStart');
  }

  const load = harness('hangLoad');
  assert.equal((await load.supervisor.startAndHandshake(load.authority)).success, true);
  assert.equal((await load.supervisor.probe(probeRequest(7))).success, true);
  const loadResult = load.supervisor.load({
    ...bindingAuthority(),
    configurationEpoch: 7,
    modelLease: load.modelLease,
    residency: selectedResidency(),
    revalidate: async () => undefined,
  });
  await Promise.resolve();
  await fireTimer(load.clock, 5 * 60_000);
  const loadFailure = await loadResult;
  assert.equal(loadFailure.success, false);
  if (!loadFailure.success) {
    assert.equal(loadFailure.error.code, 'OPERATION_TIMEOUT');
    assert.equal(loadFailure.error.stage, 'modelLoad');
  }

  const warmup = harness('hangWarmup');
  assert.equal((await warmup.supervisor.startAndHandshake(warmup.authority)).success, true);
  assert.equal((await warmup.supervisor.probe(probeRequest(7))).success, true);
  assert.equal(
    (
      await warmup.supervisor.load({
        ...bindingAuthority(),
        configurationEpoch: 7,
        modelLease: warmup.modelLease,
        residency: selectedResidency(),
        revalidate: async () => undefined,
      })
    ).success,
    true,
  );
  const warmupResult = warmup.supervisor.warmup(7);
  await Promise.resolve();
  await fireTimer(warmup.clock, 2 * 60_000);
  const warmupFailure = await warmupResult;
  assert.equal(warmupFailure.success, false);
  if (!warmupFailure.success) assert.equal(warmupFailure.error.stage, 'warmup');

  const transcription = await readyHarness('hangTranscription');
  const transcriptionResult = transcription.supervisor.transcribe({
    audio: canonicalWav(13_000),
    configurationEpoch: 7,
    settingsEpoch: 4,
    options: {
      language: null,
      initialPrompt: '',
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: null,
    },
  });
  await Promise.resolve();
  await fireTimer(transcription.clock, 130_000);
  const transcriptionFailure = await transcriptionResult;
  assert.equal(transcriptionFailure.success, false);
  if (!transcriptionFailure.success) assert.equal(transcriptionFailure.error.stage, 'transcription');

  const unload = await readyHarness('hangUnload');
  const unloadResult = unload.supervisor.unload(7);
  await Promise.resolve();
  await fireTimer(unload.clock, 15_000);
  const unloadFailure = await unloadResult;
  assert.equal(unloadFailure.success, false);
  if (!unloadFailure.success) assert.equal(unloadFailure.error.stage, 'cleanup');
});

test('transcription deadline is duration-derived with exact floor and cap', () => {
  assert.equal(getLocalWhisperTranscriptionTimeoutMs(0), 120_000);
  assert.equal(getLocalWhisperTranscriptionTimeoutMs(12_000), 120_000);
  assert.equal(getLocalWhisperTranscriptionTimeoutMs(13_000), 130_000);
  assert.equal(getLocalWhisperTranscriptionTimeoutMs(0.0625), 120_000);
  assert.equal(getLocalWhisperTranscriptionTimeoutMs(60 * 60_000), 30 * 60_000);
  assert.throws(() => getLocalWhisperTranscriptionTimeoutMs(-1), /Invalid/u);
});

test('confirmed cancellation discards partial output and may retain warmed worker', async () => {
  const value = await readyHarness('cancel');
  const transcription = value.supervisor.transcribe({
    audio: canonicalWav(100),
    configurationEpoch: 7,
    settingsEpoch: 4,
    options: {
      language: null,
      initialPrompt: '',
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: null,
    },
  });
  await Promise.resolve();
  const cancelled = await value.supervisor.cancel();
  const result = await transcription;
  assert.equal(cancelled.success, true);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, 'CANCELLED');
  assert.equal(value.supervisor.state, 'warmed');
  assert.equal((await value.supervisor.forceCleanup()).success, true);
});

test('unconfirmed cleanup retains ownership and returns CLEANUP_FAILED', async () => {
  const value = harness('cleanupFailure');
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  const result = await value.supervisor.forceCleanup();
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, 'CLEANUP_FAILED');
  assert.equal(value.supervisor.state, 'cleanupFailed');
  assert.notEqual(value.recordStore.record, null);
  assert.equal(value.releasedRuntime.value, 0);
  assert.deepEqual(value.processOwner.process?.waitTimeouts, [0, 5_000, 5_000]);
});
