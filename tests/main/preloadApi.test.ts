import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { IpcRendererEvent } from 'electron';
import { createElectronApi, type ElectronApiIpcRenderer } from '@main/preloadApi';
import {
  INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE,
  TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS,
  type TranslationProviderConnectionState,
} from '@shared/translationProvider';
import {
  FIRST_LAUNCH_STARTUP_IPC_CHANNELS,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import { LOCAL_WHISPER_IPC_CHANNELS, type LocalWhisperSettingsCommand } from '@shared/localWhisper';
import { MAIN_INTERACTION_LOCK_IPC_CHANNELS } from '@shared/mainInteractionLock';
import { SETTINGS_PRESENTATION_IPC_CHANNELS } from '@shared/settingsPresentation';
import { TEXT_ACTION_ACTIVITY_IPC_CHANNELS } from '@shared/textActionStatus';
import { PROVIDER_HOME_ACTION_IPC_CHANNELS } from '@shared/providerHomeAction';
import { PROVIDER_SETTINGS_IPC_CHANNELS } from '@shared/voiceProvider';
import { VOICE_RECORDING_IPC_CHANNELS } from '@shared/recordingLifecycle';
import { FakeCoordinator, createSnapshotService } from './localWhisper/ipc/localWhisperIpcTestUtils';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

type IpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

class RecordingIpcRenderer implements ElectronApiIpcRenderer {
  public readonly invocations: { args: unknown[]; channel: string }[] = [];
  private readonly listeners = new Map<string, Set<IpcListener>>();
  private readonly responses = new Map<string, unknown>();

  public emit(channel: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(channel) ?? []) {
      listener({} as IpcRendererEvent, ...args);
    }
  }

  public invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result> {
    this.invocations.push({ args, channel });
    return Promise.resolve(this.responses.get(channel) as Result);
  }

  public on(channel: string, listener: IpcListener): void {
    const listeners = this.listeners.get(channel) ?? new Set<IpcListener>();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
  }

  public removeListener(channel: string, listener: IpcListener): void {
    this.listeners.get(channel)?.delete(listener);
  }

  public respond(channel: string, value: unknown): void {
    this.responses.set(channel, value);
  }
}

describe('preload API factory', () => {
  it('decodes recording-start results and drops malformed rejection events', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond(VOICE_RECORDING_IPC_CHANNELS.requestStart, {
      accepted: false,
      reason: 'provider-not-connected',
    });
    const api = createElectronApi(renderer);
    const rejections: string[] = [];
    const unsubscribe = api.onRecordingStartRejected((reason) => rejections.push(reason));

    assert.deepEqual(await api.requestRecordingStart(), { accepted: false, reason: 'provider-not-connected' });
    renderer.emit(VOICE_RECORDING_IPC_CHANNELS.startRejected, 'provider-not-connected');
    renderer.emit(VOICE_RECORDING_IPC_CHANNELS.startRejected, 'forged-reason');
    unsubscribe();
    renderer.emit(VOICE_RECORDING_IPC_CHANNELS.startRejected, 'provider-not-connected');

    assert.deepEqual(rejections, ['provider-not-connected']);
    assert.deepEqual(renderer.invocations, [{ args: [], channel: VOICE_RECORDING_IPC_CHANNELS.requestStart }]);

    renderer.respond(VOICE_RECORDING_IPC_CHANNELS.requestStart, { accepted: true, reason: 'forged-reason' });
    await assert.rejects(api.requestRecordingStart(), /Invalid recording start result/u);
  });

  it('exposes only decoded bounded provider-home action commands and state events', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond(PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotQuery, {
      activeAction: null,
      activeActionCancellable: false,
      settings: { prettifyEnabled: true, prettifyQuickEnabled: true, translateEnabled: true },
    });
    renderer.respond(PROVIDER_HOME_ACTION_IPC_CHANNELS.command, { accepted: true });
    const api = createElectronApi(renderer);
    const states: string[] = [];
    const unsubscribe = api.onProviderHomeActionStateChanged((state) => states.push(String(state.activeAction)));

    assert.equal((await api.getProviderHomeActionState()).activeAction, null);
    assert.deepEqual(await api.runProviderHomeAction({ action: 'start', provider: 'prettify' }), { accepted: true });
    renderer.emit(PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotChanged, {
      activeAction: 'translation',
      activeActionCancellable: true,
      settings: { prettifyEnabled: true, prettifyQuickEnabled: true, translateEnabled: true },
    });
    renderer.emit(PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotChanged, { activeAction: 'translation' });
    unsubscribe();

    assert.deepEqual(states, ['translation']);
    assert.deepEqual(renderer.invocations.slice(-2), [
      { args: [], channel: PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotQuery },
      { args: [{ action: 'start', provider: 'prettify' }], channel: PROVIDER_HOME_ACTION_IPC_CHANNELS.command },
    ]);
    await assert.rejects(api.runProviderHomeAction({ action: 'start', provider: 'voice' } as never));
  });

  it('routes typed invocations through an injected renderer without Electron globals', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond('get-active-provider', null);
    renderer.respond('set-active-provider', {
      success: true,
      committedProviderId: 'claude-web',
      readinessRevision: 1,
    });
    const api = createElectronApi(renderer);

    assert.equal(await api.getActiveProvider(), null);
    await api.setActiveProvider('claude-web');
    await api.setHotkey('prettifyQuick', 'Ctrl+F12');
    await api.translateText('private-source-canary', 'ru');

    assert.deepEqual(renderer.invocations, [
      { args: [], channel: 'get-active-provider' },
      { args: ['claude-web'], channel: 'set-active-provider' },
      { args: ['prettifyQuick', 'Ctrl+F12'], channel: 'set-hotkey' },
      { args: ['private-source-canary', 'ru'], channel: 'translate-text' },
    ]);
  });

  it('decodes Local Whisper queries/results and drops malformed renderer events', async () => {
    const renderer = new RecordingIpcRenderer();
    const snapshots = createSnapshotService(new FakeCoordinator());
    const snapshot = snapshots.snapshot;
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery, snapshot);
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe, snapshot);
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.settingsUnsubscribe, { success: true });
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, {
      success: true,
      command: 'load',
      snapshot,
    });
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainStatusQuery, snapshots.mainStatus);
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainStatusSubscribe, snapshots.mainStatus);
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainStatusUnsubscribe, { success: true });
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainResidencyCommand, {
      success: true,
      command: 'unload',
      snapshot: snapshots.mainStatus,
      failure: null,
    });
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings, { success: true });
    const api = createElectronApi(renderer);
    const events: number[] = [];
    const unsubscribe = api.onLocalWhisperSettingsSnapshot((value) => events.push(value.snapshotRevision));

    assert.equal((await api.getLocalWhisperSettingsSnapshot()).snapshotRevision, snapshot.snapshotRevision);
    const command: LocalWhisperSettingsCommand = {
      kind: 'load',
      expectedSnapshotRevision: snapshot.snapshotRevision,
      expectedConfigurationEpoch: snapshot.configurationEpoch,
      expectedInventoryEpoch: snapshot.inventoryEpoch,
    };
    assert.equal((await api.runLocalWhisperSettingsCommand(command)).success, true);
    assert.deepEqual(await api.unsubscribeLocalWhisperSettings(), { success: true });
    assert.deepEqual(await api.unsubscribeLocalWhisperMainStatus(), { success: true });
    assert.equal(
      (
        await api.runLocalWhisperMainResidencyCommand({
          kind: 'unload',
          expectedSnapshotRevision: snapshots.mainStatus.snapshotRevision,
        })
      ).success,
      true,
    );
    assert.deepEqual(await api.openLocalWhisperSettings(), { success: true });
    renderer.emit(LOCAL_WHISPER_IPC_CHANNELS.settingsChanged, snapshot);
    renderer.emit(LOCAL_WHISPER_IPC_CHANNELS.settingsChanged, { ...snapshot, path: '/private/model' });
    unsubscribe();
    assert.deepEqual(events, [snapshot.snapshotRevision]);

    await assert.rejects(
      api.runLocalWhisperSettingsCommand({ ...command, path: '/forged' } as LocalWhisperSettingsCommand),
      /Invalid Local Whisper settings command/u,
    );
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings, { success: true, path: '/private' });
    await assert.rejects(api.openLocalWhisperSettings(), /Invalid Local Whisper open-settings response/u);
    renderer.respond(LOCAL_WHISPER_IPC_CHANNELS.mainResidencyCommand, {
      success: true,
      command: 'load',
      snapshot: snapshots.mainStatus,
      failure: null,
      stderr: 'private',
    });
    await assert.rejects(
      api.runLocalWhisperMainResidencyCommand({
        kind: 'load',
        expectedSnapshotRevision: snapshots.mainStatus.snapshotRevision,
      }),
      /Invalid Local Whisper main command response/u,
    );
    snapshots.dispose();
  });

  it('owns event listeners and unsubscribe state per factory input', () => {
    const firstRenderer = new RecordingIpcRenderer();
    const secondRenderer = new RecordingIpcRenderer();
    const firstApi = createElectronApi(firstRenderer);
    const secondApi = createElectronApi(secondRenderer);
    const firstEvents: boolean[] = [];
    const secondEvents: boolean[] = [];

    const unsubscribe = firstApi.onToggleRecording((recording) => firstEvents.push(recording));
    secondApi.onToggleRecording((recording) => secondEvents.push(recording));
    firstRenderer.emit('toggle-recording', 1);
    secondRenderer.emit('toggle-recording', 0);
    unsubscribe();
    firstRenderer.emit('toggle-recording', true);

    assert.deepEqual(firstEvents, [true]);
    assert.deepEqual(secondEvents, [false]);
  });

  it('owns the payload-free provider settings close-request subscription', () => {
    const renderer = new RecordingIpcRenderer();
    const api = createElectronApi(renderer);
    let requests = 0;
    const unsubscribe = api.onProviderSettingsCloseRequested(() => {
      requests += 1;
    });

    renderer.emit(PROVIDER_SETTINGS_IPC_CHANNELS.closeRequested);
    unsubscribe();
    renderer.emit(PROVIDER_SETTINGS_IPC_CHANNELS.closeRequested);

    assert.equal(requests, 1);
  });

  it('decodes main-interaction lock state and cleans up its direct event listener', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond(MAIN_INTERACTION_LOCK_IPC_CHANNELS.query, true);
    const api = createElectronApi(renderer);
    const events: boolean[] = [];
    const unsubscribe = api.onMainInteractionLockChanged((locked) => events.push(locked));

    assert.equal(await api.getMainInteractionLocked(), true);
    renderer.emit(MAIN_INTERACTION_LOCK_IPC_CHANNELS.changed, true);
    renderer.emit(MAIN_INTERACTION_LOCK_IPC_CHANNELS.changed, 'forged');
    unsubscribe();
    renderer.emit(MAIN_INTERACTION_LOCK_IPC_CHANNELS.changed, false);

    assert.deepEqual(events, [true]);
    assert.deepEqual(renderer.invocations.slice(-1), [{ args: [], channel: MAIN_INTERACTION_LOCK_IPC_CHANNELS.query }]);

    renderer.respond(MAIN_INTERACTION_LOCK_IPC_CHANNELS.query, 'forged');
    assert.equal(await api.getMainInteractionLocked(), false);
  });

  it('decodes settings presentation state and exposes only the focus request', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond(SETTINGS_PRESENTATION_IPC_CHANNELS.query, 'opening');
    renderer.respond(SETTINGS_PRESENTATION_IPC_CHANNELS.focus, true);
    const api = createElectronApi(renderer);
    const states: string[] = [];
    const unsubscribe = api.onSettingsPresentationChanged((state) => states.push(state));

    assert.equal(await api.getSettingsPresentation(), 'opening');
    assert.equal(await api.focusSettingsWindow(), true);
    renderer.emit(SETTINGS_PRESENTATION_IPC_CHANNELS.changed, 'open');
    renderer.emit(SETTINGS_PRESENTATION_IPC_CHANNELS.changed, 'forged');
    unsubscribe();
    renderer.emit(SETTINGS_PRESENTATION_IPC_CHANNELS.changed, 'idle');

    assert.deepEqual(states, ['open']);
    assert.deepEqual(renderer.invocations.slice(-2), [
      { args: [], channel: SETTINGS_PRESENTATION_IPC_CHANNELS.query },
      { args: [], channel: SETTINGS_PRESENTATION_IPC_CHANNELS.focus },
    ]);

    renderer.respond(SETTINGS_PRESENTATION_IPC_CHANNELS.query, 'forged');
    renderer.respond(SETTINGS_PRESENTATION_IPC_CHANNELS.focus, 'forged');
    assert.equal(await api.getSettingsPresentation(), 'idle');
    assert.equal(await api.focusSettingsWindow(), false);
  });

  it('decodes selected-text activity and ignores malformed activity events', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.query, false);
    const api = createElectronApi(renderer);
    const activity: boolean[] = [];
    const unsubscribe = api.onTextActionActivityChanged((active) => activity.push(active));

    assert.equal(await api.getTextActionActivity(), false);
    renderer.emit(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.changed, true);
    renderer.emit(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.changed, 'forged');
    unsubscribe();
    renderer.emit(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.changed, false);

    assert.deepEqual(activity, [true]);
    assert.deepEqual(renderer.invocations.slice(-1), [{ args: [], channel: TEXT_ACTION_ACTIVITY_IPC_CHANNELS.query }]);

    renderer.respond(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.query, 'forged');
    assert.equal(await api.getTextActionActivity(), true);
  });

  it('sanitizes Translation connection queries and ignores malformed events', async () => {
    const renderer = new RecordingIpcRenderer();
    const api = createElectronApi(renderer);
    const events: TranslationProviderConnectionState[] = [];
    renderer.respond(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.get, {
      detail: 'navigation-failed',
      message: 'private-message-canary',
      providerId: 'google',
      status: 'not-connected',
      targetLanguage: 'en',
    });
    const unsubscribe = api.onTranslationProviderConnectionChanged((state) => events.push(state));

    assert.equal(await api.getTranslationProviderConnection(), INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE);
    renderer.emit(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed, {
      detail: 'ready',
      providerId: 'google',
      status: 'connected',
      targetLanguage: 'en',
    });
    renderer.emit(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed, {
      detail: 'navigation-failed',
      providerId: 'google',
      stack: 'private-stack-canary',
      status: 'not-connected',
      targetLanguage: 'en',
    });
    unsubscribe();
    renderer.emit(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed, {
      detail: 'ready',
      providerId: 'bing',
      status: 'connected',
      targetLanguage: 'en',
    });

    assert.deepEqual(events, [
      {
        detail: 'ready',
        providerId: 'google',
        status: 'connected',
        targetLanguage: 'en',
      },
    ]);
  });

  it('decodes safe first-launch startup snapshots and drops malformed events', async () => {
    const renderer = new RecordingIpcRenderer();
    const snapshot = createFirstLaunchStartupSnapshot({
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
    renderer.respond(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery, snapshot);
    renderer.respond(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry, snapshot);
    const api = createElectronApi(renderer);
    const events: number[] = [];
    const unsubscribe = api.onFirstLaunchStartupSnapshot((value) => events.push(value.generation));

    assert.deepEqual(await api.getFirstLaunchStartupSnapshot(), snapshot);
    assert.deepEqual(await api.retryFirstLaunchStartup(), snapshot);
    renderer.emit(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.changed, snapshot);
    renderer.emit(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.changed, {
      ...snapshot,
      privateInstallerPath: '/private/cache/chrome',
    });
    unsubscribe();
    renderer.emit(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.changed, snapshot);

    assert.deepEqual(events, [0]);
    assert.deepEqual(renderer.invocations.slice(-2), [
      { args: [], channel: FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery },
      { args: [], channel: FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry },
    ]);

    renderer.respond(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery, {
      privateInstallerPath: '/private/cache/chrome',
    });
    await assert.rejects(api.getFirstLaunchStartupSnapshot(), /Invalid first-launch startup snapshot/u);
  });

  it('exposes exactly one factory result through the preload bridge', () => {
    const preload = readFileSync(path.join(PROJECT_ROOT, 'src/main/preload.ts'), 'utf8');
    const factory = readFileSync(path.join(PROJECT_ROOT, 'src/main/preloadApi.ts'), 'utf8');

    assert.equal((preload.match(/contextBridge\.exposeInMainWorld/gu) ?? []).length, 1);
    assert.match(preload, /contextBridge\.exposeInMainWorld\('electronAPI', createElectronApi\(ipcRenderer\)\)/u);
    assert.doesNotMatch(preload, /ipcRenderer\.invoke|ipcRenderer\.on/u);
    assert.match(factory, /export function createElectronApi/u);
    assert.doesNotMatch(preload, /prettifyProfileChooser|prettify-profile-chooser/u);
    assert.doesNotMatch(factory, /prettifyProfileChooser|prettify-profile-chooser/u);
    assert.doesNotMatch(factory, /contextBridge|exposeInMainWorld/u);
  });
});
