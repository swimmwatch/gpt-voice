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
import { LOCAL_WHISPER_IPC_CHANNELS, type LocalWhisperSettingsCommand } from '@shared/localWhisper';
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
  it('routes typed invocations through an injected renderer without Electron globals', async () => {
    const renderer = new RecordingIpcRenderer();
    renderer.respond('get-active-provider', 'chatgpt');
    renderer.respond('set-active-provider', {
      success: true,
      committedProviderId: 'claude-web',
      readinessRevision: 1,
    });
    const api = createElectronApi(renderer);

    assert.equal(await api.getActiveProvider(), 'chatgpt');
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
