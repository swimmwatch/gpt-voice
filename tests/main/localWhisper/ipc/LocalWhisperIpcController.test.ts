import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LocalWhisperCommandAuditPort } from '@main/localWhisper/audit/LocalWhisperCommandAudit';
import { LocalWhisperIpcController } from '@main/localWhisper/ipc/LocalWhisperIpcController';
import { LOCAL_WHISPER_IPC_CHANNELS, type LocalWhisperSettingsCommand } from '@shared/localWhisper';

import {
  CATALOG_REVISION,
  FakeAuthority,
  FakeCoordinator,
  FakePrivilegedPorts,
  FakeTransport,
  MODEL_ARTIFACT_ID,
  MODEL_REVISION,
  NOTICE_ID,
  RUNTIME_ARTIFACT_ID,
  RUNTIME_REVISION,
  artifactId,
  coordinatorSnapshot,
  createSnapshotService,
  fakeEvent,
  revision,
} from './localWhisperIpcTestUtils';

function createHarness(audit: LocalWhisperCommandAuditPort = { record: () => undefined }) {
  const transport = new FakeTransport();
  const authority = new FakeAuthority();
  const coordinator = new FakeCoordinator();
  const privileged = new FakePrivilegedPorts();
  const snapshots = createSnapshotService(coordinator);
  let openSettingsCalls = 0;
  let refreshSettingsCalls = 0;
  const controller = new LocalWhisperIpcController({
    audit,
    transport,
    authority,
    coordinator,
    artifacts: privileged.artifacts,
    managedFolder: privileged.folder,
    references: privileged.references,
    snapshots,
    openSettings: () => {
      openSettingsCalls += 1;
    },
    refreshSettingsFacts: () => {
      refreshSettingsCalls += 1;
      return Promise.resolve();
    },
  });
  controller.register();
  return {
    transport,
    authority,
    coordinator,
    privileged,
    snapshots,
    controller,
    getOpenSettingsCalls: () => openSettingsCalls,
    getRefreshSettingsCalls: () => refreshSettingsCalls,
  };
}

function expected(snapshots: ReturnType<typeof createSnapshotService>) {
  const snapshot = snapshots.snapshot;
  return {
    expectedSnapshotRevision: snapshot.snapshotRevision,
    expectedConfigurationEpoch: snapshot.configurationEpoch,
    expectedInventoryEpoch: snapshot.inventoryEpoch,
  } as const;
}

describe('LocalWhisperIpcController', () => {
  it('starts fail-closed device refresh only for an authorized settings snapshot query', async () => {
    const harness = createHarness();
    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery, fakeEvent('settings'));
    assert.equal(harness.getRefreshSettingsCalls(), 1);
    await assert.rejects(
      async () => await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery, fakeEvent('foreign')),
      /settings IPC sender/u,
    );
    assert.equal(harness.getRefreshSettingsCalls(), 1);
  });

  it('keeps settings and main capabilities non-overlapping and rejects before effects', async () => {
    const harness = createHarness();
    await assert.rejects(
      async () => await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery, fakeEvent('main')),
      /settings IPC sender/u,
    );
    await assert.rejects(
      async () => await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.mainStatusQuery, fakeEvent('settings')),
      /main-status IPC sender/u,
    );
    await assert.rejects(
      async () =>
        await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, fakeEvent('foreign'), {
          kind: 'load',
          ...expected(harness.snapshots),
        }),
      /settings IPC sender/u,
    );
    assert.equal(harness.coordinator.loadCalls, 0);

    const mainStatus = await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.mainStatusQuery, fakeEvent('main'));
    assert.deepEqual(Object.keys(mainStatus as object).sort(), [
      'failure',
      'providerId',
      'runtime',
      'selectedButUnavailable',
      'snapshotRevision',
    ]);
    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings, fakeEvent('main'));
    assert.equal(harness.getOpenSettingsCalls(), 1);
    await assert.rejects(
      async () =>
        await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings, fakeEvent('main'), '/forged-path'),
      /unexpected Local Whisper IPC arguments/u,
    );
    assert.equal(harness.getOpenSettingsCalls(), 1);
  });

  it('atomically replays ordered snapshots and revokes invalidated subscribers', async () => {
    const harness = createHarness();
    const replay = (await harness.transport.invoke(
      LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe,
      fakeEvent('settings'),
    )) as { snapshotRevision: number };
    assert.equal(harness.authority.settings.sent.length, 0);

    harness.coordinator.emit(
      coordinatorSnapshot({
        snapshotRevision: 2,
        epochs: Object.freeze({ provider: 0, configuration: 3, inventory: 3, topology: 0, capability: 0, worker: 0 }),
      }),
    );
    assert.equal(harness.authority.settings.sent.length, 1);
    const update = harness.authority.settings.sent[0]?.value as { snapshotRevision: number };
    assert.ok(update.snapshotRevision > replay.snapshotRevision);

    harness.authority.settings.invalidate();
    harness.coordinator.emit(coordinatorSnapshot({ snapshotRevision: 3 }));
    assert.equal(harness.authority.settings.sent.length, 1);
  });

  it('isolates subscriber send failures from coordinator state publication', async () => {
    const harness = createHarness();
    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe, fakeEvent('settings'));
    harness.authority.settings.throwOnSend = true;

    assert.doesNotThrow(() => harness.coordinator.emit(coordinatorSnapshot({ snapshotRevision: 2 })));
    assert.equal(harness.authority.settings.sendAttempts, 1);
    harness.coordinator.emit(coordinatorSnapshot({ snapshotRevision: 3 }));
    assert.equal(harness.authority.settings.sendAttempts, 1);
  });

  it('delegates each save/reset exactly once while keeping prompt text out of every result', async () => {
    const harness = createHarness();
    const save: LocalWhisperSettingsCommand = {
      kind: 'save',
      candidate: harness.snapshots.snapshot.settings,
      promptMutation: { kind: 'replace', value: 'private prompt' },
      ...expected(harness.snapshots),
    };
    const saveResult = await harness.transport.invoke(
      LOCAL_WHISPER_IPC_CHANNELS.settingsCommand,
      fakeEvent('settings'),
      save,
    );
    assert.equal(harness.coordinator.settingsCalls.length, 1);
    assert.deepEqual(harness.coordinator.settingsCalls[0], {
      kind: 'save',
      candidate: save.candidate,
      promptMutation: save.promptMutation,
      expectedConfigurationEpoch: save.expectedConfigurationEpoch,
      expectedInventoryEpoch: save.expectedInventoryEpoch,
    });
    const serialized = JSON.stringify(saveResult);
    assert.equal(serialized.includes('private prompt'), false);
    assert.equal(serialized.includes('initialPrompt'), false);

    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, fakeEvent('settings'), {
      kind: 'reset',
      ...expected(harness.snapshots),
    });
    assert.equal(harness.coordinator.settingsCalls.length, 2);

    const stale = await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, fakeEvent('settings'), {
      kind: 'reset',
      ...expected(harness.snapshots),
      expectedConfigurationEpoch: 999,
    });
    assert.equal((stale as { success: boolean }).success, false);
    assert.equal(harness.coordinator.settingsCalls.length, 2);
  });

  it('keeps the completed command authoritative when audit delivery fails', async () => {
    let auditedSnapshotRevision: number | null = null;
    const harness = createHarness({
      record: (_command, snapshot) => {
        auditedSnapshotRevision = snapshot.snapshotRevision;
        throw new Error('private audit sink failure');
      },
    });

    const result = (await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, fakeEvent('settings'), {
      kind: 'checkCompatibility',
      ...expected(harness.snapshots),
    })) as { readonly success: boolean; readonly snapshot: { readonly snapshotRevision: number } };

    assert.equal(result.success, true);
    assert.equal(harness.coordinator.checkCalls, 1);
    assert.equal(auditedSnapshotRevision, result.snapshot.snapshotRevision);
  });

  it('rejects prototypes, unknown keys, unsafe numbers, and forged artifact authority', async () => {
    const harness = createHarness();
    const inherited = Object.create({ kind: 'load' }) as Record<string, unknown>;
    Object.assign(inherited, expected(harness.snapshots));
    const malformed = [
      inherited,
      { kind: 'load', ...expected(harness.snapshots), path: '/tmp/model' },
      { kind: 'load', ...expected(harness.snapshots), expectedInventoryEpoch: Number.MAX_SAFE_INTEGER + 1 },
      {
        kind: 'download',
        artifactKind: 'model',
        artifactId: artifactId('forged-model'),
        artifactRevision: MODEL_REVISION,
        ...expected(harness.snapshots),
      },
    ];
    for (const command of malformed) {
      const result = await harness.transport.invoke(
        LOCAL_WHISPER_IPC_CHANNELS.settingsCommand,
        fakeEvent('settings'),
        command,
      );
      assert.equal((result as { success: boolean }).success, false);
    }
    assert.equal(harness.coordinator.loadCalls, 0);
    assert.equal(harness.privileged.artifactCommands.length, 0);

    const duplicateArguments = await harness.transport.invoke(
      LOCAL_WHISPER_IPC_CHANNELS.settingsCommand,
      fakeEvent('settings'),
      { kind: 'load', ...expected(harness.snapshots) },
      { kind: 'unload', ...expected(harness.snapshots) },
    );
    assert.equal((duplicateArguments as { readonly success: boolean }).success, false);
    assert.equal(harness.coordinator.loadCalls, 0);
  });

  it('isolates artifact, load, folder, and catalog-bound reference actions', async () => {
    const harness = createHarness();
    const invoke = (command: LocalWhisperSettingsCommand) =>
      harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, fakeEvent('settings'), command);

    await invoke({ kind: 'checkCompatibility', ...expected(harness.snapshots) });
    await invoke({ kind: 'load', ...expected(harness.snapshots) });
    await invoke({ kind: 'unload', ...expected(harness.snapshots) });
    assert.deepEqual(
      [harness.coordinator.checkCalls, harness.coordinator.loadCalls, harness.coordinator.unloadCalls],
      [1, 1, 1],
    );

    await invoke({
      kind: 'download',
      artifactKind: 'model',
      artifactId: MODEL_ARTIFACT_ID,
      artifactRevision: MODEL_REVISION,
      ...expected(harness.snapshots),
    });
    await invoke({ kind: 'cancelArtifact', operationId: 'operation-id-0001', ...expected(harness.snapshots) });
    assert.deepEqual(
      harness.privileged.artifactCommands.map((command) => command.kind),
      ['download', 'cancelArtifact'],
    );

    const disallowedDownload = await invoke({
      kind: 'download',
      artifactKind: 'runtime',
      artifactId: RUNTIME_ARTIFACT_ID,
      artifactRevision: RUNTIME_REVISION,
      ...expected(harness.snapshots),
    });
    assert.equal((disallowedDownload as { readonly success: boolean }).success, false);
    assert.deepEqual(
      harness.privileged.artifactCommands.map((command) => command.kind),
      ['download', 'cancelArtifact'],
    );

    await invoke({
      kind: 'remove',
      artifactKind: 'runtime',
      artifactId: RUNTIME_ARTIFACT_ID,
      artifactRevision: RUNTIME_REVISION,
      confirmed: true,
      ...expected(harness.snapshots),
    });
    assert.equal(harness.coordinator.removeCalls.length, 1);

    await invoke({ kind: 'openManagedFolder', expectedSnapshotRevision: harness.snapshots.snapshot.snapshotRevision });
    assert.equal(harness.privileged.folderCalls, 1);

    const validReference: LocalWhisperSettingsCommand = {
      kind: 'viewArtifactReference',
      referenceKind: 'viewLicenseNotice',
      artifactKind: 'runtime',
      artifactId: RUNTIME_ARTIFACT_ID,
      artifactRevision: RUNTIME_REVISION,
      referenceId: NOTICE_ID,
      expectedCatalogRevision: CATALOG_REVISION,
      expectedSnapshotRevision: harness.snapshots.snapshot.snapshotRevision,
    };
    await invoke(validReference);
    assert.equal(harness.privileged.referenceCommands.length, 1);

    harness.privileged.throwArtifactError = true;
    const sanitizedFailure = await invoke({
      kind: 'retry',
      artifactKind: 'model',
      artifactId: MODEL_ARTIFACT_ID,
      artifactRevision: MODEL_REVISION,
      ...expected(harness.snapshots),
    });
    assert.equal((sanitizedFailure as { readonly success: boolean }).success, false);
    assert.equal(JSON.stringify(sanitizedFailure).includes('private artifact adapter detail'), false);

    const crossArtifact = { ...validReference, artifactId: MODEL_ARTIFACT_ID };
    const rejected = await invoke(crossArtifact);
    assert.equal((rejected as { success: boolean }).success, false);
    assert.equal(harness.privileged.referenceCommands.length, 1);

    const rejectedReferences = [
      { ...validReference, expectedCatalogRevision: revision('stale-catalog-v0') },
      { ...validReference, referenceId: artifactId('forged-reference') },
      { ...validReference, artifactId: artifactId('unknown-runtime') },
      { ...validReference, referenceKind: 'openProvenanceReference' as const },
    ];
    for (const command of rejectedReferences) {
      const result = await invoke(command);
      assert.equal((result as { readonly success: boolean }).success, false);
    }
    assert.equal(harness.privileged.referenceCommands.length, 1);
  });

  it('removes every route and subscriber on disposal', async () => {
    const harness = createHarness();
    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe, fakeEvent('settings'));
    await harness.transport.invoke(LOCAL_WHISPER_IPC_CHANNELS.mainStatusSubscribe, fakeEvent('main'));
    harness.controller.dispose();
    const eventOnlyChannels = new Set<string>([
      LOCAL_WHISPER_IPC_CHANNELS.settingsChanged,
      LOCAL_WHISPER_IPC_CHANNELS.mainStatusChanged,
    ]);
    assert.deepEqual(
      new Set(harness.transport.removed),
      new Set(Object.values(LOCAL_WHISPER_IPC_CHANNELS).filter((channel) => !eventOnlyChannels.has(channel))),
    );
    harness.coordinator.emit(coordinatorSnapshot({ snapshotRevision: 4 }));
    assert.equal(harness.authority.settings.sent.length, 0);
    assert.equal(harness.authority.main.sent.length, 0);
  });
});
