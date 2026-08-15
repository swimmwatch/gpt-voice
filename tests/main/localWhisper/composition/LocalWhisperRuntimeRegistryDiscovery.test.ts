/* eslint-disable max-classes-per-file -- Focused state-owning fakes model storage and process ownership. */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';

import {
  LocalWhisperRuntimeRegistryDiscovery,
  LocalWhisperRuntimeRegistryDiscoveryError,
} from '@main/localWhisper/composition/LocalWhisperRuntimeRegistryDiscovery';
import { LocalWhisperDeviceTopologyAuthority } from '@main/localWhisper/composition/LocalWhisperDeviceTopologyAuthority';
import { LocalWhisperDeviceIdentityRepository } from '@main/localWhisper/deviceIdentity/LocalWhisperDeviceIdentityRepository';
import type { LocalWhisperDeviceIdentityStore } from '@main/localWhisper/deviceIdentity/FileLocalWhisperDeviceIdentityStore';
import { createLocalWhisperRegistryFingerprint } from '@main/localWhisper/supervisor/LocalWhisperDeviceAuthority';
import {
  NativeRuntimeLogForwarder,
  NativeRuntimeLogRelay,
} from '@main/localWhisper/supervisor/NativeRuntimeLogStreamDecoder';
import type {
  LocalWhisperOwnedWorkerProcess,
  LocalWhisperWorkerLaunchAuthority,
  WorkerProcessOwnership,
} from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import { serializeCanonicalNativeRuntimeLogRecord } from '@shared/localWhisper';

const RUNTIME_DIGEST = 'a'.repeat(64);
const PROCESS_INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const MISMATCHED_PROCESS_INSTANCE_ID = '22222222-2222-4222-8222-222222222222';

function authority(backend: 'cpu' | 'cuda' = 'cuda'): LocalWhisperWorkerLaunchAuthority {
  const runtimeLease = {
    released: false,
    release() {
      this.released = true;
      return Promise.resolve();
    },
  };
  return {
    configurationEpoch: 1,
    expectedHandshake: {
      engine: 'whisperCpp',
      runtimeRevision: 'fixture-runtime-v1' as never,
      runtimeBuildDigest: RUNTIME_DIGEST,
      backend,
      capabilities: [],
    },
    launchMode: 'registry',
    runtimeIdentityKey: 'fixture-runtime-identity',
    runtimeLease: runtimeLease as never,
    workerExecutablePath: '/managed/runtime/worker',
    workerFileIdentity: {} as never,
    workerFileSha256: RUNTIME_DIGEST,
    workingDirectoryPath: '/managed/runtime',
    revalidate: () => Promise.resolve(),
  };
}

function document(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    engineId: 'whisperCpp',
    runtimeBuildDigest: RUNTIME_DIGEST,
    backendId: 'cuda',
    entries: [
      { ordinal: 0, type: 'gpu', backendId: 'cuda', nativeIdentity: '0000:01:00.0' },
      { ordinal: 1, type: 'igpu', backendId: 'cuda', nativeIdentity: '0000:02:00.0' },
    ],
    ...overrides,
  });
}

class FixtureOwnership {
  public released = 0;
  public retained = 0;
  public terminated = 0;

  public constructor(
    private readonly outputText: string,
    private readonly exits = true,
    private readonly stderrText = '',
  ) {}

  public get process(): LocalWhisperOwnedWorkerProcess | null {
    return null;
  }

  public launch(): Promise<LocalWhisperOwnedWorkerProcess> {
    const output = new PassThrough();
    const input = new PassThrough();
    const stderr = new PassThrough();
    queueMicrotask(() => {
      output.end(Buffer.from(this.outputText, 'utf8'));
      stderr.end(Buffer.from(this.stderrText, 'utf8'));
    });
    return Promise.resolve({
      nativeRuntimeProcessInstanceIds: [PROCESS_INSTANCE_ID],
      pid: 10,
      processStartIdentity: 'fixture-process',
      input,
      output,
      stderr,
      closeOwnershipControl: () => undefined,
      requestTreeTermination: () => {
        this.terminated += 1;
        return Promise.resolve();
      },
      forceTreeTermination: () => {
        this.terminated += 1;
        return Promise.resolve();
      },
      waitForExit: () => Promise.resolve(this.exits),
    });
  }

  public releaseAfterConfirmedExit(): Promise<void> {
    this.released += 1;
    return Promise.resolve();
  }

  public retainFailedOwnership(): void {
    this.retained += 1;
  }
}

function discovery(
  owner: FixtureOwnership,
  nativeRuntimeLogRelay?: NativeRuntimeLogRelay,
): LocalWhisperRuntimeRegistryDiscovery {
  return new LocalWhisperRuntimeRegistryDiscovery(owner as unknown as WorkerProcessOwnership, nativeRuntimeLogRelay);
}

class MemoryIdentityStore implements LocalWhisperDeviceIdentityStore {
  public value: unknown = null;

  public read(): { readonly status: 'missing' } | { readonly status: 'ok'; readonly value: unknown } {
    return this.value === null ? { status: 'missing' } : { status: 'ok', value: this.value };
  }

  public write(value: unknown): void {
    this.value = structuredClone(value);
  }

  public remove(): boolean {
    const existed = this.value !== null;
    this.value = null;
    return existed;
  }
}

describe('production Local Whisper runtime registry discovery', () => {
  it('accepts one bounded exact-runtime registry and releases process ownership', async () => {
    const owner = new FixtureOwnership(`${document()}\n`);
    const registry = await discovery(owner).discover(authority(), new AbortController().signal);

    assert.equal(registry.backendId, 'cuda');
    assert.equal(registry.entries.length, 2);
    assert.match(createLocalWhisperRegistryFingerprint(registry), /^[a-f0-9]{64}$/u);
    assert.equal(owner.released, 1);
    assert.equal(owner.retained, 0);
  });

  it('observes cancellation that occurs while native launch is still pending', async () => {
    let resolveLaunch!: (process: LocalWhisperOwnedWorkerProcess) => void;
    const launch = new Promise<LocalWhisperOwnedWorkerProcess>((resolve) => {
      resolveLaunch = resolve;
    });
    const output = new PassThrough();
    const stderr = new PassThrough();
    const input = new PassThrough();
    let released = 0;
    let terminated = 0;
    const owner: WorkerProcessOwnership = {
      launch: () => launch,
      recoverBeforeLaunch: () => Promise.resolve(),
      releaseAfterConfirmedExit: () => {
        released += 1;
        return Promise.resolve();
      },
      retainFailedOwnership: () => undefined,
    } as unknown as WorkerProcessOwnership;
    const controller = new AbortController();
    const operation = new LocalWhisperRuntimeRegistryDiscovery(owner).discover(authority(), controller.signal);
    controller.abort();
    output.end(`${document()}\n`);
    stderr.end();
    resolveLaunch({
      closeOwnershipControl: () => undefined,
      forceTreeTermination: () => Promise.resolve(),
      input,
      nativeRuntimeProcessInstanceIds: [PROCESS_INSTANCE_ID],
      output,
      pid: 10,
      processStartIdentity: 'fixture-process',
      requestTreeTermination: () => {
        terminated += 1;
        return Promise.resolve();
      },
      stderr,
      waitForExit: () => Promise.resolve(true),
    });

    await assert.rejects(
      operation,
      (error: unknown) => error instanceof LocalWhisperRuntimeRegistryDiscoveryError && error.code === 'CANCELLED',
    );
    assert.equal(terminated, 1);
    assert.equal(released, 1);
  });

  it('rejects changed identity, noncanonical output, empty GPU registries, and non-registry launch modes', async () => {
    const cases: readonly [string, LocalWhisperWorkerLaunchAuthority][] = [
      [`${document({ runtimeBuildDigest: 'b'.repeat(64) })}\n`, authority()],
      [`${document()}\nextra\n`, authority()],
      [`${document({ entries: [] })}\n`, authority()],
      [`${document()}\n`, { ...authority(), launchMode: 'probe' }],
    ];
    for (const [output, launchAuthority] of cases) {
      await assert.rejects(
        () => discovery(new FixtureOwnership(output)).discover(launchAuthority, new AbortController().signal),
        LocalWhisperRuntimeRegistryDiscoveryError,
      );
    }
  });

  it('retains uncertain process ownership when termination cannot be confirmed', async () => {
    const owner = new FixtureOwnership(`${document()}\n`, false);
    await assert.rejects(
      () => discovery(owner).discover(authority(), new AbortController().signal),
      (error: unknown) => error instanceof LocalWhisperRuntimeRegistryDiscoveryError && error.code === 'CLEANUP_FAILED',
    );
    assert.equal(owner.retained, 1);
    assert.equal(owner.released, 0);
    assert.equal(owner.terminated, 2);
  });

  it('does not mask an uncertain cleanup with cancellation', async () => {
    const owner = new FixtureOwnership(`${document()}\n`, false);
    const controller = new AbortController();
    const operation = discovery(owner).discover(authority(), controller.signal);
    controller.abort();

    await assert.rejects(
      operation,
      (error: unknown) => error instanceof LocalWhisperRuntimeRegistryDiscoveryError && error.code === 'CLEANUP_FAILED',
    );
    assert.equal(owner.retained, 1);
    assert.equal(owner.released, 0);
    assert.equal(owner.terminated, 3);
  });

  it('retains a lease when cancellation intersects a launch failure with owned cleanup still uncertain', async () => {
    let rejectLaunch!: (error: Error) => void;
    const launch = new Promise<LocalWhisperOwnedWorkerProcess>((_resolve, reject) => {
      rejectLaunch = reject;
    });
    let retained = false;
    let retainCalls = 0;
    const owner = {
      launch: () => launch,
      get process(): LocalWhisperOwnedWorkerProcess | null {
        return retained ? ({} as LocalWhisperOwnedWorkerProcess) : null;
      },
      releaseAfterConfirmedExit: () => Promise.resolve(),
      retainFailedOwnership: () => {
        retainCalls += 1;
      },
    } as unknown as WorkerProcessOwnership;
    const launchAuthority = authority();
    const controller = new AbortController();
    const operation = new LocalWhisperRuntimeRegistryDiscovery(owner).discover(launchAuthority, controller.signal);
    controller.abort();
    retained = true;
    rejectLaunch(new Error('private launch cleanup failure'));

    await assert.rejects(
      operation,
      (error: unknown) => error instanceof LocalWhisperRuntimeRegistryDiscoveryError && error.code === 'CLEANUP_FAILED',
    );
    assert.equal(launchAuthority.runtimeLease.released, false);
    assert.equal(retainCalls, 1);
  });

  it('rejects native diagnostics from a different private process instance', async () => {
    const serialized = serializeCanonicalNativeRuntimeLogRecord({
      component: 'whisperWorker',
      event: 'processStarted',
      level: 'info',
      processInstanceId: MISMATCHED_PROCESS_INSTANCE_ID,
      schemaVersion: 1,
      sequence: 1,
    });
    assert.ok(serialized);
    const messages: unknown[][] = [];
    const relay = new NativeRuntimeLogRelay();
    relay.attach(
      new NativeRuntimeLogForwarder({
        logger: {
          debug: (...args: unknown[]) => messages.push(args),
          error: (...args: unknown[]) => messages.push(args),
          info: (...args: unknown[]) => messages.push(args),
          warn: (...args: unknown[]) => messages.push(args),
        },
        now: () => new Date('2026-08-12T00:00:00.000Z'),
      }),
    );
    const owner = new FixtureOwnership(`${document()}\n`, true, `${serialized}\n`);

    const registry = await discovery(owner, relay).discover(authority(), new AbortController().signal);

    assert.equal(registry.backendId, 'cuda');
    assert.deepEqual(messages, []);
  });
});

describe('production Local Whisper device topology authority', () => {
  it('projects stable opaque IDs and increments generation only for a changed exact registry', () => {
    const identities = new LocalWhisperDeviceIdentityRepository(new MemoryIdentityStore(), () =>
      Uint8Array.from({ length: 32 }, (_value, index) => index + 1),
    );
    const topology = new LocalWhisperDeviceTopologyAuthority(identities);
    const registry = {
      engineId: 'whisperCpp',
      runtimeBuildDigest: RUNTIME_DIGEST,
      backendId: 'cuda',
      entries: [{ ordinal: 0, type: 'gpu' as const, backendId: 'cuda', nativeIdentity: '0000:01:00.0' }],
    };

    const first = topology.update(registry);
    const repeated = topology.update(registry);
    const firstDevice = first.devices[0];
    assert.ok(firstDevice);
    assert.equal(first.generation, 1);
    assert.equal(repeated.generation, 1);
    assert.equal(firstDevice.id, repeated.devices[0]?.id);
    assert.doesNotMatch(JSON.stringify(first.devices), /0000:01:00\.0/u);
    assert.equal(topology.resolve(firstDevice.id, first.registryFingerprint)?.ordinal, 0);

    const changed = topology.update({
      ...registry,
      entries: [{ ordinal: 0, type: 'gpu' as const, backendId: 'cuda', nativeIdentity: '0000:02:00.0' }],
    });
    assert.equal(changed.generation, 2);
    assert.notEqual(changed.devices[0]?.id, firstDevice.id);
    assert.equal(topology.resolve(firstDevice.id, first.registryFingerprint), null);
  });
});
