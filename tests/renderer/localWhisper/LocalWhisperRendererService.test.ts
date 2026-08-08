import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LocalWhisperRendererService,
  type LocalWhisperMainResidencyState,
} from '@renderer/localWhisper/LocalWhisperRendererService';
import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperMainResidencyCommand,
  type LocalWhisperMainResidencyCommandResult,
  type LocalWhisperProviderSelectionResult,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperSettingsCommand,
} from '@shared/localWhisper';
import {
  FakeCoordinator,
  coordinatorSnapshot,
  createSnapshotService,
} from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

function currentMainFailure(service: LocalWhisperRendererService): LocalWhisperMainResidencyState['failure'] {
  return service.mainResidencyState.failure;
}

describe('LocalWhisperRendererService', () => {
  it('reconciles replay/event races by revision and emits one complete save command', async () => {
    const coordinator = new FakeCoordinator();
    const snapshots = createSnapshotService(coordinator);
    const oldSnapshot = snapshots.snapshot;
    coordinator.emit(
      coordinatorSnapshot({
        snapshotRevision: 2,
        epochs: Object.freeze({ provider: 0, configuration: 4, inventory: 5, topology: 0, capability: 0, worker: 0 }),
      }),
    );
    const newSnapshot = snapshots.snapshot;
    let settingsEvent: ((snapshot: LocalWhisperRendererSnapshot) => void) | null = null;
    let mainEvent: ((snapshot: LocalWhisperMainStatusSnapshot) => void) | null = null;
    const commands: LocalWhisperSettingsCommand[] = [];
    let settingsUnsubscribeCalls = 0;
    let mainUnsubscribeCalls = 0;
    const api = {
      getLocalWhisperSettingsSnapshot: () => Promise.resolve(newSnapshot),
      subscribeLocalWhisperSettings: async () => {
        settingsEvent?.(newSnapshot);
        return oldSnapshot;
      },
      unsubscribeLocalWhisperSettings: () => {
        settingsUnsubscribeCalls += 1;
        return Promise.resolve({ success: true as const });
      },
      onLocalWhisperSettingsSnapshot: (listener: (snapshot: LocalWhisperRendererSnapshot) => void) => {
        settingsEvent = listener;
        return () => {
          settingsEvent = null;
        };
      },
      runLocalWhisperSettingsCommand: (command: LocalWhisperSettingsCommand) => {
        commands.push(command);
        return Promise.resolve({ success: true as const, command: command.kind, snapshot: newSnapshot });
      },
      subscribeLocalWhisperMainStatus: () => Promise.resolve(snapshots.mainStatus),
      unsubscribeLocalWhisperMainStatus: () => {
        mainUnsubscribeCalls += 1;
        return Promise.resolve({ success: true as const });
      },
      onLocalWhisperMainStatus: (listener: (snapshot: LocalWhisperMainStatusSnapshot) => void) => {
        mainEvent = listener;
        return () => {
          mainEvent = null;
        };
      },
      runLocalWhisperMainResidencyCommand: (command: LocalWhisperMainResidencyCommand) =>
        Promise.resolve({
          success: true as const,
          command: command.kind,
          snapshot: snapshots.mainStatus,
          failure: null,
        }),
      setActiveProvider: (providerId: string): Promise<LocalWhisperProviderSelectionResult> =>
        Promise.resolve({ success: true, committedProviderId: providerId, readinessRevision: 1 }),
    };
    const service = new LocalWhisperRendererService(api, 'chatgpt');
    assert.equal((await service.startSettings()).snapshotRevision, newSnapshot.snapshotRevision);
    (settingsEvent as ((snapshot: LocalWhisperRendererSnapshot) => void) | null)?.(oldSnapshot);
    assert.equal(service.currentSettingsSnapshot?.snapshotRevision, newSnapshot.snapshotRevision);

    await service.save(newSnapshot.settings, { kind: 'replace', value: 'private draft' });
    assert.equal(commands.length, 1);
    assert.deepEqual(commands[0], {
      kind: 'save',
      candidate: newSnapshot.settings,
      promptMutation: { kind: 'replace', value: 'private draft' },
      expectedSnapshotRevision: newSnapshot.snapshotRevision,
      expectedConfigurationEpoch: newSnapshot.configurationEpoch,
      expectedInventoryEpoch: newSnapshot.inventoryEpoch,
    });

    await service.startMainStatus();
    assert.ok(mainEvent);
    await service.dispose();
    assert.equal(settingsUnsubscribeCalls, 1);
    assert.equal(mainUnsubscribeCalls, 1);
    snapshots.dispose();
  });

  it('keeps committed provider unchanged on failure and updates only from main success', async () => {
    const coordinator = new FakeCoordinator();
    const snapshots = createSnapshotService(coordinator);
    const selections: LocalWhisperProviderSelectionResult[] = [
      {
        success: false,
        committedProviderId: 'chatgpt',
        readinessRevision: 2,
        error: createLocalWhisperRendererSafeFailure('OPERATION_CONFLICT'),
      },
      { success: true, committedProviderId: 'local-whisper', readinessRevision: 3 },
    ];
    const api = {
      getLocalWhisperSettingsSnapshot: () => Promise.resolve(snapshots.snapshot),
      subscribeLocalWhisperSettings: () => Promise.resolve(snapshots.snapshot),
      unsubscribeLocalWhisperSettings: () => Promise.resolve({ success: true as const }),
      onLocalWhisperSettingsSnapshot: () => () => undefined,
      runLocalWhisperSettingsCommand: (command: LocalWhisperSettingsCommand) =>
        Promise.resolve({ success: true as const, command: command.kind, snapshot: snapshots.snapshot }),
      subscribeLocalWhisperMainStatus: () => Promise.resolve(snapshots.mainStatus),
      unsubscribeLocalWhisperMainStatus: () => Promise.resolve({ success: true as const }),
      onLocalWhisperMainStatus: () => () => undefined,
      runLocalWhisperMainResidencyCommand: (command: LocalWhisperMainResidencyCommand) =>
        Promise.resolve({
          success: true as const,
          command: command.kind,
          snapshot: snapshots.mainStatus,
          failure: null,
        }),
      setActiveProvider: () => Promise.resolve(selections.shift()!),
    };
    const service = new LocalWhisperRendererService(api, 'chatgpt');

    const failed = await service.selectProvider('local-whisper');
    assert.equal(failed.success, false);
    assert.equal(service.committedProviderId, 'chatgpt');
    const succeeded = await service.selectProvider('local-whisper');
    assert.equal(succeeded.success, true);
    assert.equal(service.committedProviderId, 'local-whisper');
    snapshots.dispose();
  });

  it('settles one main command without letting stale results overwrite subscriptions or leak transport errors', async () => {
    const coordinator = new FakeCoordinator();
    const snapshots = createSnapshotService(coordinator);
    const initial = snapshots.mainStatus;
    let mainEvent: ((snapshot: LocalWhisperMainStatusSnapshot) => void) | null = null;
    let invokeCalls = 0;
    let runCommand = (_command: LocalWhisperMainResidencyCommand): Promise<LocalWhisperMainResidencyCommandResult> => {
      throw new Error('Command behavior was not initialized');
    };
    const api = {
      getLocalWhisperSettingsSnapshot: () => Promise.resolve(snapshots.snapshot),
      subscribeLocalWhisperSettings: () => Promise.resolve(snapshots.snapshot),
      unsubscribeLocalWhisperSettings: () => Promise.resolve({ success: true as const }),
      onLocalWhisperSettingsSnapshot: () => () => undefined,
      runLocalWhisperSettingsCommand: (command: LocalWhisperSettingsCommand) =>
        Promise.resolve({ success: true as const, command: command.kind, snapshot: snapshots.snapshot }),
      subscribeLocalWhisperMainStatus: () => Promise.resolve(initial),
      unsubscribeLocalWhisperMainStatus: () => Promise.resolve({ success: true as const }),
      onLocalWhisperMainStatus: (listener: (snapshot: LocalWhisperMainStatusSnapshot) => void) => {
        mainEvent = listener;
        return () => {
          mainEvent = null;
        };
      },
      runLocalWhisperMainResidencyCommand: (command: LocalWhisperMainResidencyCommand) => {
        invokeCalls += 1;
        return runCommand(command);
      },
      setActiveProvider: (providerId: string): Promise<LocalWhisperProviderSelectionResult> =>
        Promise.resolve({ success: true, committedProviderId: providerId, readinessRevision: 1 }),
    };
    const service = new LocalWhisperRendererService(api, 'local-whisper');
    await service.startMainStatus();

    let resolveFirst = (_result: LocalWhisperMainResidencyCommandResult): void => {
      throw new Error('Command resolver was not initialized');
    };
    runCommand = () =>
      new Promise<LocalWhisperMainResidencyCommandResult>((resolve) => {
        resolveFirst = resolve;
      });
    const first = service.runMainResidency('unload');
    assert.equal(service.mainResidencyState.pendingAction, 'unload');
    assert.equal(await service.runMainResidency('load'), null);
    assert.equal(invokeCalls, 1);

    const newer = Object.freeze({ ...initial, snapshotRevision: initial.snapshotRevision + 2 });
    (mainEvent as ((snapshot: LocalWhisperMainStatusSnapshot) => void) | null)?.(newer);
    resolveFirst({
      success: true,
      command: 'unload',
      snapshot: Object.freeze({ ...initial, snapshotRevision: initial.snapshotRevision + 1 }),
      failure: null,
    });
    await first;
    assert.equal(service.currentMainSnapshot?.snapshotRevision, newer.snapshotRevision);
    assert.equal(service.mainResidencyState.pendingAction, null);
    assert.equal(service.mainResidencyState.failure, null);
    assert.equal(service.mainResidencyState.failureSequence, 0);

    runCommand = (command) =>
      Promise.resolve({
        success: false,
        command: command.kind,
        snapshot: newer,
        failure: createLocalWhisperRendererSafeFailure('OPERATION_CONFLICT'),
      });
    await service.runMainResidency('load');
    const commandFailure = currentMainFailure(service);
    assert.ok(commandFailure);
    assert.equal(commandFailure.kind, 'command');
    assert.equal(service.mainResidencyState.failureSequence, 1);

    const newest = Object.freeze({ ...newer, snapshotRevision: newer.snapshotRevision + 1 });
    (mainEvent as ((snapshot: LocalWhisperMainStatusSnapshot) => void) | null)?.(newest);
    assert.equal(service.mainResidencyState.failure, null);

    runCommand = () => Promise.reject(new Error('private preload transport detail'));
    assert.equal(await service.runMainResidency('load'), null);
    assert.deepEqual(currentMainFailure(service), { kind: 'transport' });
    assert.equal(service.mainResidencyState.failureSequence, 2);
    assert.equal(invokeCalls, 3);
    await service.dispose();
    snapshots.dispose();
  });
});
