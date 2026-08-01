import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { test } from 'node:test';

import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
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
import {
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';

type WorkerMode =
  'crash' | 'flood' | 'hang' | 'happy' | 'malformed' | 'out-of-order' | 'oversized' | 'stream-close' | 'unknown-kind';

const WORKER_PATH = resolve('tests/fixtures/local-whisper/worker/conformance-worker.ts');

function revision(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid conformance revision');
  return parsed;
}

function residency(): LocalWhisperResidencyKey {
  const deviceId = toLocalWhisperOpaqueDeviceId('fixture-gpu');
  if (!deviceId) throw new Error('Invalid conformance device');
  return {
    engine: 'whisperCpp',
    runtimePackRevision: revision('runtime-pack-v1'),
    target: 'gpu',
    backend: 'cuda',
    deviceId,
    model: {
      engine: 'whisperCpp',
      logicalModel: 'tiny',
      sourceCheckpointRevision: revision('checkpoint-v1'),
      artifactRevision: revision('artifact-v1'),
      nativeFormat: 'ggml',
      variant: 'full',
    },
    precision: null,
    resolvedCpuThreads: null,
  };
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
    const timer = [...this.timers.entries()].find(([, value]) => value.milliseconds === milliseconds);
    if (!timer) throw new Error(`Missing conformance timer ${milliseconds}`);
    this.timers.delete(timer[0]);
    timer[1].callback();
  }
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

class FixtureWorkerProcess implements LocalWhisperOwnedWorkerProcess {
  public readonly input: Writable;
  public readonly output: Readable;
  public readonly processStartIdentity: string;
  public readonly stderr: Readable;
  private exited = false;

  public constructor(private readonly child: ChildProcess) {
    if (!child.pid || !child.stdin || !child.stdout || !child.stderr) {
      throw new Error('Conformance worker streams unavailable');
    }
    this.input = child.stdin;
    this.output = child.stdout;
    this.stderr = child.stderr;
    this.processStartIdentity = `fixture-${child.pid}`;
    child.once('exit', () => {
      this.exited = true;
    });
  }

  public get pid(): number {
    const pid = this.child.pid;
    if (!pid) throw new Error('Conformance worker PID unavailable');
    return pid;
  }

  public closeOwnershipControl(): void {
    if (!this.exited) this.child.kill('SIGTERM');
  }

  public async requestTreeTermination(): Promise<void> {
    this.closeOwnershipControl();
  }

  public async forceTreeTermination(): Promise<void> {
    if (!this.exited) this.child.kill('SIGKILL');
  }

  public async waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.exited || this.child.exitCode !== null || this.child.signalCode !== null) return true;
    if (timeoutMs <= 0) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | null = null;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.child.off('exit', onExit);
        resolve(value);
      };
      const onExit = (): void => finish(true);
      this.child.once('exit', onExit);
      timer = setTimeout(() => finish(false), timeoutMs);
      if (this.child.exitCode !== null || this.child.signalCode !== null) finish(true);
    });
  }
}

class FixtureProcessOwner implements LocalWhisperWorkerProcessOwner {
  public constructor(private readonly mode: WorkerMode) {}

  public async launch(): Promise<LocalWhisperOwnedWorkerProcess> {
    const child = spawn(process.execPath, ['--import', 'tsx', WORKER_PATH, this.mode], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return new FixtureWorkerProcess(child);
  }

  public async recoverOwnedOrphan(): Promise<boolean> {
    return true;
  }
}

function lease(kind: 'model' | 'runtime', releases: { value: number }): ManagedArtifactLease {
  const artifactId = toLocalWhisperArtifactId(`${kind}-conformance`);
  if (!artifactId) throw new Error('Invalid conformance artifact ID');
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
        mode: kind === 'model' ? 0o400 : 0o700,
        parentFileId: '4',
        sizeBytes: 100,
        type: 'directory',
      },
      purpose: 'load',
    },
    `${kind}-conformance-token`,
    async () => {
      releases.value += 1;
    },
  );
}

function harness(mode: WorkerMode) {
  const clock = new FakeClock();
  const releasedRuntime = { value: 0 };
  const releasedModel = { value: 0 };
  const runtimeLease = lease('runtime', releasedRuntime);
  const modelLease = lease('model', releasedModel);
  const ownership = new WorkerProcessOwnership({
    processOwner: new FixtureProcessOwner(mode),
    randomNonce: () => 'conformance_nonce_1234',
    recordStore: new MemoryRecordStore(),
  });
  let request = 0;
  const supervisor = new LocalWhisperWorkerSupervisor({
    clock,
    createTransport: (streams, callbacks) => new LocalWhisperWorkerTransport(streams, callbacks),
    nextRequestId: () => `conformance-${(request += 1)}`,
    ownership,
  });
  const authority: LocalWhisperWorkerLaunchAuthority = {
    configurationEpoch: 1,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: revision('runtime-pack-v1'),
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: ['cuda-sm-75', 'cuda-sm-86'],
    },
    runtimeIdentityKey: 'conformance-runtime',
    runtimeLease,
    workerExecutablePath: WORKER_PATH,
    workerFileIdentity: {
      deviceOrVolumeId: '1',
      fileId: '5',
      linkCount: 1,
      mode: 0o500,
      parentFileId: '3',
      sizeBytes: 100,
      type: 'regular',
    },
    workerFileSha256: 'a'.repeat(64),
    workingDirectoryPath: resolve('tests/fixtures/local-whisper/worker'),
    revalidate: async () => undefined,
  };
  return { authority, clock, modelLease, releasedModel, releasedRuntime, supervisor };
}

test('standalone conformance worker consumes every checked-in golden vector', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', WORKER_PATH, 'validate-vectors'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('standalone conformance worker completes the canonical lifecycle without inference', async () => {
  const value = harness('happy');
  assert.equal((await value.supervisor.startAndHandshake(value.authority)).success, true);
  assert.equal((await value.supervisor.probe(1)).success, true);
  assert.equal(
    (
      await value.supervisor.load({
        configurationEpoch: 1,
        modelLease: value.modelLease,
        modelPath: '/private/conformance/model.bin',
        residency: residency(),
        revalidate: async () => undefined,
      })
    ).success,
    true,
  );
  assert.equal((await value.supervisor.warmup(1)).success, true);
  const transcription = await value.supervisor.transcribe({
    audio: Uint8Array.from([1, 2, 3, 4]),
    audioDurationMs: 100,
    configurationEpoch: 1,
    settingsEpoch: 1,
    options: {
      language: null,
      initialPrompt: '',
      temperatureHundredths: 0,
      strategy: 'greedy',
      candidateCount: null,
    },
  });
  assert.deepEqual(transcription, {
    success: true,
    state: 'warmed',
    value: 'synthetic conformance transcript',
  });
  assert.equal((await value.supervisor.unload(1)).success, true);
  assert.equal(value.releasedRuntime.value, 1);
  assert.equal(value.releasedModel.value, 1);
});

test('standalone conformance worker bounds malformed, oversized, unknown, flood, crash, and closure modes', async () => {
  for (const mode of ['malformed', 'oversized', 'unknown-kind', 'flood', 'crash', 'stream-close'] as const) {
    const value = harness(mode);
    const result = await value.supervisor.startAndHandshake(value.authority);
    assert.equal(result.success, false, mode);
    if (!result.success) {
      assert.ok(
        result.error.code === 'WORKER_PROTOCOL_VIOLATION' || result.error.code === 'WORKER_CRASHED',
        `${mode}: ${result.error.code}`,
      );
    }
    assert.equal(value.releasedRuntime.value, 1, mode);
  }
});

test('standalone conformance worker exposes deterministic out-of-order and hang scenarios', async () => {
  const outOfOrder = harness('out-of-order');
  assert.equal((await outOfOrder.supervisor.startAndHandshake(outOfOrder.authority)).success, true);
  const probe = await outOfOrder.supervisor.probe(1);
  assert.equal(probe.success, false);
  if (!probe.success) assert.equal(probe.error.code, 'WORKER_PROTOCOL_VIOLATION');

  const hang = harness('hang');
  const handshake = hang.supervisor.startAndHandshake(hang.authority);
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  hang.clock.fire(10_000);
  const timedOut = await handshake;
  assert.equal(timedOut.success, false);
  if (!timedOut.success) assert.equal(timedOut.error.code, 'OPERATION_TIMEOUT');
  assert.equal(hang.releasedRuntime.value, 1);
});
