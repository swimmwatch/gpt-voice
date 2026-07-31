import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { IpcRendererEvent } from 'electron';
import {
  createPrettifyProfileChooserApi,
  type PrettifyProfileChooserIpcRenderer,
} from '@main/prettifyProfileChooserPreloadApi';
import {
  PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS,
  type PrettifyProfileChooserOperationToken,
} from '@shared/prettifyProfileChooser';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TOKEN = '00000000-0000-4000-8000-000000000009' as PrettifyProfileChooserOperationToken;
type IpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

class RecordingIpcRenderer implements PrettifyProfileChooserIpcRenderer {
  public readonly invocations: Array<{ readonly args: readonly unknown[]; readonly channel: string }> = [];
  private readonly listeners = new Map<string, Set<IpcListener>>();
  private readonly responses = new Map<string, unknown>();

  public emit(channel: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(channel) ?? []) listener({} as IpcRendererEvent, ...args);
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

describe('Prettify profile chooser preload API', () => {
  it('exposes only the exact minimal chooser capability surface and namespaced invocations', async () => {
    const renderer = new RecordingIpcRenderer();
    const api = createPrettifyProfileChooserApi(renderer);
    renderer.respond(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale, 'en');
    renderer.respond(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getTranslations, { chooser: 'Choose' });
    renderer.respond(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load, { token: TOKEN });

    assert.deepEqual(Object.keys(api).sort(), [
      'apply',
      'cancel',
      'getLocale',
      'getTranslations',
      'loadPayload',
      'manageProfiles',
      'onLocaleChanged',
      'ready',
    ]);
    await api.loadPayload();
    await api.ready(TOKEN);
    await api.apply(TOKEN, 'prompt-ready');
    await api.cancel(TOKEN);
    await api.manageProfiles(TOKEN);
    assert.equal(await api.getLocale(), 'en');
    assert.deepEqual(await api.getTranslations(), { chooser: 'Choose' });

    assert.deepEqual(renderer.invocations, [
      { args: [], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load },
      { args: [TOKEN], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.ready },
      { args: [TOKEN, 'prompt-ready'], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply },
      { args: [TOKEN], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.cancel },
      { args: [TOKEN], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.manageProfiles },
      { args: [], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale },
      { args: [], channel: PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getTranslations },
    ]);
  });

  it('validates chooser locale events and removes the exact listener on unsubscribe', () => {
    const renderer = new RecordingIpcRenderer();
    const api = createPrettifyProfileChooserApi(renderer);
    const locales: string[] = [];
    const unsubscribe = api.onLocaleChanged((locale) => locales.push(locale));

    renderer.emit(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, 'ru');
    renderer.emit(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, 'not-a-locale');
    renderer.emit('locale-changed', 'en');
    unsubscribe();
    renderer.emit(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, 'en');

    assert.deepEqual(locales, ['ru']);
  });

  it('bridges exactly the isolated factory and never imports the general preload API', () => {
    const preload = readFileSync(path.join(PROJECT_ROOT, 'src/main/prettifyProfileChooserPreload.ts'), 'utf8');
    const factory = readFileSync(path.join(PROJECT_ROOT, 'src/main/prettifyProfileChooserPreloadApi.ts'), 'utf8');

    assert.equal((preload.match(/contextBridge\.exposeInMainWorld/gu) ?? []).length, 1);
    assert.match(
      preload,
      /contextBridge\.exposeInMainWorld\('electronAPI', createPrettifyProfileChooserApi\(ipcRenderer\)\)/u,
    );
    assert.doesNotMatch(preload, /createElectronApi|preloadApi/u);
    assert.doesNotMatch(factory, /get-platform|provider|clipboard|filesystem|settings-window/u);
    assert.doesNotMatch(factory, /contextBridge|exposeInMainWorld/u);
  });
});
