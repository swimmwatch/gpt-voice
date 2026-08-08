import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import {
  MainIpcController,
  TrustedIpcRegistrar,
  type MainIpcControllerDependencies,
  type MainIpcTransport,
} from '@main/ipc';
import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_IPC_CHANNELS,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import { MAIN_INTERACTION_LOCK_IPC_CHANNELS, MainInteractionLock } from '@shared/mainInteractionLock';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface MainIpcControllerTestHook {
  registerFirstLaunchStartupIpc(): void;
  registerMainInteractionLockIpc(): void;
}

class RecordingTransport implements MainIpcTransport {
  public readonly handlers = new Map<string, IpcHandler>();

  public handle(channel: string, listener: IpcHandler): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

class StartupCoordinatorDouble {
  public retryCalls = 0;

  public constructor(protected snapshot: FirstLaunchStartupSnapshot) {}

  public getSnapshot(): FirstLaunchStartupSnapshot {
    return this.snapshot;
  }

  public async retry(): Promise<FirstLaunchStartupSnapshot> {
    this.retryCalls += 1;
    if (this.snapshot.state !== FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed) return this.snapshot;
    this.snapshot = createRunningSnapshot(this.snapshot.generation + 1);
    return this.snapshot;
  }
}

class DeferredStartupCoordinatorDouble extends StartupCoordinatorDouble {
  private readonly deferred = createDeferred<FirstLaunchStartupSnapshot>();

  public override retry(): Promise<FirstLaunchStartupSnapshot> {
    this.retryCalls += 1;
    return this.deferred.promise;
  }

  public resolveRetry(snapshot: FirstLaunchStartupSnapshot): void {
    this.snapshot = snapshot;
    this.deferred.resolve(snapshot);
  }
}

class RejectingStartupCoordinatorDouble extends StartupCoordinatorDouble {
  public override retry(): Promise<FirstLaunchStartupSnapshot> {
    this.retryCalls += 1;
    return Promise.reject(new Error('First-launch startup coordinator is disposed'));
  }
}

function createDeferred<Value>(): { readonly promise: Promise<Value>; readonly resolve: (value: Value) => void } {
  let resolveDeferred: ((value: Value) => void) | null = null;
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve;
  });

  return {
    promise,
    resolve: (value) => resolveDeferred?.(value),
  };
}

function createPendingSnapshot(): FirstLaunchStartupSnapshot {
  return createFirstLaunchStartupSnapshot({
    generation: 0,
    jobs: [
      {
        completedUnits: 0,
        failureCode: null,
        id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Pending,
        totalUnits: 1,
      },
    ],
    retryable: false,
    state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending,
  });
}

function createFailedSnapshot(): FirstLaunchStartupSnapshot {
  return createFirstLaunchStartupSnapshot({
    generation: 1,
    jobs: [
      {
        completedUnits: 0,
        failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
        id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
        totalUnits: 1,
      },
    ],
    retryable: true,
    state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed,
  });
}

function createRunningSnapshot(generation: number): FirstLaunchStartupSnapshot {
  return createFirstLaunchStartupSnapshot({
    generation,
    jobs: [
      {
        completedUnits: 0,
        failureCode: null,
        id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Running,
        totalUnits: 1,
      },
    ],
    retryable: false,
    state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
  });
}

function createEvent(): IpcMainInvokeEvent {
  return {
    sender: {
      getURL: () => 'app://gpt-voice/index.html',
    },
    senderFrame: { url: 'app://gpt-voice/index.html' },
  } as unknown as IpcMainInvokeEvent;
}

function createHarness(
  options: {
    readonly coordinator?: StartupCoordinatorDouble;
    readonly trusted?: boolean;
    readonly snapshot?: FirstLaunchStartupSnapshot;
  } = {},
) {
  const transport = new RecordingTransport();
  const coordinator = options.coordinator ?? new StartupCoordinatorDouble(options.snapshot ?? createPendingSnapshot());
  const mainInteractionLock = new MainInteractionLock();
  const registrar = new TrustedIpcRegistrar(
    transport,
    { error: () => undefined, info: () => undefined, warn: () => undefined },
    {
      isTrustedAppWindow: (_sender: WebContents, _url: string) => options.trusted ?? true,
    } as unknown as MainIpcControllerDependencies['windowManager'],
  );
  const controller = new MainIpcController({
    firstLaunchStartupCoordinator: coordinator,
    mainInteractionLock,
    trustedIpc: registrar,
  } as unknown as MainIpcControllerDependencies);
  (controller as unknown as MainIpcControllerTestHook).registerFirstLaunchStartupIpc();
  (controller as unknown as MainIpcControllerTestHook).registerMainInteractionLockIpc();
  return { coordinator, mainInteractionLock, transport };
}

describe('first-launch startup IPC', () => {
  it('exposes main-interaction lock state only through a trusted zero-argument query', () => {
    const { mainInteractionLock, transport } = createHarness();
    const handler = transport.handlers.get(MAIN_INTERACTION_LOCK_IPC_CHANNELS.query);
    assert.ok(handler);

    assert.equal(handler(createEvent()), false);
    const acquisition = mainInteractionLock.acquire();
    assert.ok(acquisition.lease);
    assert.equal(handler(createEvent()), true);
    assert.throws(() => handler(createEvent(), 'forged'), /Unexpected IPC arguments/u);

    const untrusted = createHarness({ trusted: false }).transport.handlers.get(
      MAIN_INTERACTION_LOCK_IPC_CHANNELS.query,
    );
    assert.ok(untrusted);
    assert.throws(() => untrusted(createEvent()));
  });

  it('returns the current safe snapshot through the trusted zero-argument query', () => {
    const { transport } = createHarness();
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery);
    assert.ok(handler);

    assert.deepEqual(handler(createEvent()), createPendingSnapshot());
    assert.throws(() => handler(createEvent(), 'forged'), /Unexpected IPC arguments/u);
  });

  it('returns a current retry snapshot only for a retryable failed generation', async () => {
    const { coordinator, transport } = createHarness({ snapshot: createFailedSnapshot() });
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(handler);

    const retried = (await handler(createEvent())) as FirstLaunchStartupSnapshot;
    assert.equal(coordinator.retryCalls, 1);
    assert.equal(retried.generation, 2);
    assert.equal(retried.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running);

    const noOp = createHarness();
    const noOpHandler = noOp.transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(noOpHandler);
    const pending = (await noOpHandler(createEvent())) as FirstLaunchStartupSnapshot;
    assert.equal(noOp.coordinator.retryCalls, 1);
    assert.deepEqual(pending, createPendingSnapshot());
  });

  it('keeps the Retry IPC request pending until the coordinator settles', async () => {
    const coordinator = new DeferredStartupCoordinatorDouble(createFailedSnapshot());
    const { transport } = createHarness({ coordinator });
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(handler);

    let settled = false;
    const result = Promise.resolve(handler(createEvent())).then((snapshot) => {
      settled = true;
      return snapshot;
    });
    await Promise.resolve();

    assert.equal(coordinator.retryCalls, 1);
    assert.equal(settled, false);
    const retriedSnapshot = createRunningSnapshot(2);
    coordinator.resolveRetry(retriedSnapshot);
    assert.deepEqual(await result, retriedSnapshot);
  });

  it('propagates a disposed-coordinator Retry rejection through IPC', async () => {
    const { transport } = createHarness({
      coordinator: new RejectingStartupCoordinatorDouble(createFailedSnapshot()),
    });
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(handler);

    await assert.rejects(async () => await handler(createEvent()), /coordinator is disposed/u);
  });

  it('rejects untrusted startup IPC senders before they can query or retry', () => {
    const { transport } = createHarness({ trusted: false });
    const query = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery);
    const retry = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(query);
    assert.ok(retry);

    assert.throws(() => query(createEvent()), /Rejected IPC from untrusted sender/u);
    assert.throws(() => retry(createEvent()), /Rejected IPC from untrusted sender/u);
  });

  it('rejects malformed Retry arguments', async () => {
    const { transport } = createHarness({ snapshot: createFailedSnapshot() });
    const retry = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(retry);

    await assert.rejects(async () => await retry(createEvent(), 'forged'), /Unexpected IPC arguments/u);
  });
});
