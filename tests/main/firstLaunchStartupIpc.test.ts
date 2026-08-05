import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { MainIpcController, TrustedIpcRegistrar, type MainIpcControllerDependencies, type MainIpcTransport } from '@main/ipc';
import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_IPC_CHANNELS,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface MainIpcControllerTestHook {
  registerFirstLaunchStartupIpc(): void;
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

  public constructor(private snapshot: FirstLaunchStartupSnapshot) {}

  public getSnapshot(): FirstLaunchStartupSnapshot {
    return this.snapshot;
  }

  public async retry(): Promise<FirstLaunchStartupSnapshot> {
    this.retryCalls += 1;
    if (this.snapshot.state !== FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed) return this.snapshot;
    this.snapshot = createFirstLaunchStartupSnapshot({
      generation: this.snapshot.generation + 1,
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
    return this.snapshot;
  }
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

function createEvent(): IpcMainInvokeEvent {
  return {
    sender: {
      getURL: () => 'app://gpt-voice/index.html',
    },
    senderFrame: { url: 'app://gpt-voice/index.html' },
  } as unknown as IpcMainInvokeEvent;
}

function createHarness(options: { readonly trusted?: boolean; readonly snapshot?: FirstLaunchStartupSnapshot } = {}) {
  const transport = new RecordingTransport();
  const coordinator = new StartupCoordinatorDouble(options.snapshot ?? createPendingSnapshot());
  const registrar = new TrustedIpcRegistrar(
    transport,
    { error: () => undefined, info: () => undefined, warn: () => undefined },
    {
      isTrustedAppWindow: (_sender: WebContents, _url: string) => options.trusted ?? true,
    } as unknown as MainIpcControllerDependencies['windowManager'],
  );
  const controller = new MainIpcController({
    firstLaunchStartupCoordinator: coordinator,
    trustedIpc: registrar,
  } as unknown as MainIpcControllerDependencies);
  (controller as unknown as MainIpcControllerTestHook).registerFirstLaunchStartupIpc();
  return { coordinator, transport };
}

describe('first-launch startup IPC', () => {
  it('returns the current safe snapshot through the trusted zero-argument query', () => {
    const { transport } = createHarness();
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery);
    assert.ok(handler);

    assert.deepEqual(handler(createEvent()), createPendingSnapshot());
    assert.throws(() => handler(createEvent(), 'forged'), /Unexpected IPC arguments/u);
  });

  it('returns a current retry snapshot only for a retryable failed generation', () => {
    const { coordinator, transport } = createHarness({ snapshot: createFailedSnapshot() });
    const handler = transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(handler);

    const retried = handler(createEvent()) as FirstLaunchStartupSnapshot;
    assert.equal(coordinator.retryCalls, 1);
    assert.equal(retried.generation, 2);
    assert.equal(retried.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running);

    const noOp = createHarness();
    const noOpHandler = noOp.transport.handlers.get(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
    assert.ok(noOpHandler);
    const pending = noOpHandler(createEvent()) as FirstLaunchStartupSnapshot;
    assert.equal(noOp.coordinator.retryCalls, 1);
    assert.deepEqual(pending, createPendingSnapshot());
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
});
