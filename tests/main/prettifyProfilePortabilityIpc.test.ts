/* eslint-disable max-classes-per-file -- isolated IPC trust fixtures keep sender identity explicit. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { BrowserWindow, IpcMainInvokeEvent, IpcRendererEvent, WebContents } from 'electron';

import { TrustedIpcRegistrar, type MainIpcLogger, type MainIpcTransport } from '@main/ipc';
import { createElectronApi, type ElectronApiIpcRenderer } from '@main/preloadApi';
import type { WindowManager } from '@main/window';
import {
  PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS,
  type PrettifyProfileExportRequest,
  type PrettifyProfileImportApplyRequest,
  type PrettifyProfileImportRequest,
} from '@shared/prettifyProfilePortability';
import {
  normalizePrettifyProfileCatalog,
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
} from '@shared/prettifyProfiles';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SETTINGS_URL = 'app://gpt-voice/settings.html';

interface SenderFixture {
  readonly id: number;
  readonly name: string;
  readonly url: string;
}

class RecordingMainIpcTransport implements MainIpcTransport {
  private readonly handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();

  public handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  public async invoke(
    channel: string,
    sender: SenderFixture,
    senderFrameUrl: string | null,
    ...args: unknown[]
  ): Promise<unknown> {
    const listener = this.handlers.get(channel);
    assert.ok(listener);
    const event = {
      sender: {
        getURL: () => sender.url,
        id: sender.id,
      } as unknown as WebContents,
      senderFrame: senderFrameUrl === null ? null : { url: senderFrameUrl },
    } as unknown as IpcMainInvokeEvent;
    return listener(event, ...args);
  }
}

class ExactSettingsWindowTrustPolicy {
  public readonly liveSettings: SenderFixture = {
    id: 6,
    name: 'settings',
    url: SETTINGS_URL,
  };
  public readonly liveSettingsWindow = {
    isDestroyed: () => false,
    webContents: {
      getURL: () => SETTINGS_URL,
      id: this.liveSettings.id,
    },
  } as unknown as BrowserWindow;
  public readonly otherSenders: readonly SenderFixture[] = [
    { id: 1, name: 'main', url: 'app://gpt-voice/index.html' },
    { id: 2, name: 'chooser', url: 'app://gpt-voice/prettify-profile-chooser.html' },
    { id: 3, name: 'history', url: 'app://gpt-voice/history.html' },
    { id: 4, name: 'about', url: 'app://gpt-voice/about.html' },
    { id: 5, name: 'stale-settings', url: SETTINGS_URL },
  ];

  public getTrustedSettingsWindow(webContents: WebContents, senderFrameUrl: string): BrowserWindow | null {
    return webContents.id === this.liveSettings.id && senderFrameUrl === SETTINGS_URL ? this.liveSettingsWindow : null;
  }

  public isTrustedAppWindow(webContents: WebContents): boolean {
    return webContents.id === this.liveSettings.id || this.otherSenders.some(({ id }) => id === webContents.id);
  }
}

class RecordingPreloadIpcRenderer implements ElectronApiIpcRenderer {
  public readonly invocations: Array<{ readonly args: readonly unknown[]; readonly channel: string }> = [];

  public invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result> {
    this.invocations.push({ args, channel });
    return Promise.resolve({ status: 'cancelled' } as Result);
  }

  public on(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}

  public removeListener(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}
}

function createDraft() {
  return normalizePrettifyProfileCatalog({
    chooserOrder: PRETTIFY_BUILT_IN_PROFILE_IDS,
    customProfiles: [],
    defaultProfileId: 'prompt-ready',
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

describe('Prettify profile portability IPC contract', () => {
  it('registers all three channels only through the Settings-window boundary', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');
    for (const pattern of [
      /handleSettingsWindow\([\s\S]{0,100}PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.export/u,
      /handleSettingsWindow\([\s\S]{0,100}PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.import/u,
      /handleSettingsWindow\([\s\S]{0,100}PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.applyImport/u,
    ]) {
      assert.match(source, pattern);
    }
    for (const pattern of [
      /trustedIpc\.handle\(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.export/u,
      /trustedIpc\.handle\(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.import/u,
      /trustedIpc\.handle\(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS\.applyImport/u,
    ]) {
      assert.doesNotMatch(source, pattern);
    }
  });

  it('accepts only the exact live Settings WebContents, frame, ID, and URL', async () => {
    const transport = new RecordingMainIpcTransport();
    const trustPolicy = new ExactSettingsWindowTrustPolicy();
    const warnings: unknown[][] = [];
    const logger: MainIpcLogger = {
      error: () => undefined,
      info: () => undefined,
      warn: (...args) => warnings.push(args),
    };
    const registrar = new TrustedIpcRegistrar(transport, logger, trustPolicy as unknown as WindowManager);
    const calls: Array<{ readonly args: readonly unknown[]; readonly window: BrowserWindow }> = [];
    for (const channel of Object.values(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS)) {
      registrar.handleSettingsWindow(channel, (_event, window, ...args) => {
        calls.push({ args, window });
        return { status: 'cancelled' };
      });
    }

    for (const channel of Object.values(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS)) {
      assert.deepEqual(await transport.invoke(channel, trustPolicy.liveSettings, SETTINGS_URL, { synthetic: true }), {
        status: 'cancelled',
      });
    }
    assert.equal(calls.length, 3);
    assert.equal(
      calls.every(({ window }) => window === trustPolicy.liveSettingsWindow),
      true,
    );

    for (const sender of trustPolicy.otherSenders) {
      await assert.rejects(
        transport.invoke(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.import, sender, sender.url, {
          privatePath: '/home/alice',
        }),
        /Settings-only IPC sender/u,
      );
    }
    await assert.rejects(
      transport.invoke(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.export, trustPolicy.liveSettings, null, {}),
      /Settings-only IPC sender/u,
    );
    await assert.rejects(
      transport.invoke(
        PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.applyImport,
        trustPolicy.liveSettings,
        'app://gpt-voice/index.html?private=/home/alice',
        {},
      ),
      /Settings-only IPC sender/u,
    );
    assert.equal(calls.length, 3);
    assert.doesNotMatch(JSON.stringify(warnings), /alice|private|app:\/\/|settings\.html/u);
  });

  it('exposes only typed request DTOs through the common preload API', async () => {
    const renderer = new RecordingPreloadIpcRenderer();
    const api = createElectronApi(renderer);
    const draft = createDraft();
    const exportRequest: PrettifyProfileExportRequest = {
      confirmedPlaintext: true,
      draft,
      profileIds: [],
    };
    const importRequest: PrettifyProfileImportRequest = { draft };
    const applyRequest: PrettifyProfileImportApplyRequest = {
      decisions: [],
      draft,
      profiles: [],
    };

    await api.exportPrettifyProfiles(exportRequest);
    await api.importPrettifyProfiles(importRequest);
    await api.applyPrettifyProfileImport(applyRequest);

    assert.deepEqual(renderer.invocations, [
      {
        args: [exportRequest],
        channel: PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.export,
      },
      {
        args: [importRequest],
        channel: PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.import,
      },
      {
        args: [applyRequest],
        channel: PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.applyImport,
      },
    ]);
  });

  it('keeps renderer contracts path-free and does not expand the isolated chooser preload', () => {
    const shared = readFileSync(path.join(PROJECT_ROOT, 'src/shared/prettifyProfilePortability.ts'), 'utf8');
    const preload = readFileSync(path.join(PROJECT_ROOT, 'src/main/prettifyProfileChooserPreload.ts'), 'utf8');
    assert.doesNotMatch(
      shared,
      /interface PrettifyProfile(?:Export|Import)[\s\S]{0,240}(?:filePath|filename|stack|rawJson)/u,
    );
    assert.doesNotMatch(preload, /profilePortability|exportPrettifyProfiles|importPrettifyProfiles/u);
  });

  it('wires bounded reads, private atomic writes, and the one process allocator in the composition root', () => {
    const main = readFileSync(path.join(PROJECT_ROOT, 'src/main/main.ts'), 'utf8');
    const composition = readFileSync(path.join(PROJECT_ROOT, 'src/main/di/mainProcessCompositionRoot.ts'), 'utf8');

    assert.match(main, /Buffer\.allocUnsafe\(maxBytes \+ 1\)/u);
    assert.match(main, /if \(byteLength > maxBytes\)/u);
    assert.match(main, /writeFileAtomically:[\s\S]{0,300}mode !== 0o600[\s\S]{0,300}writeTextFileAtomically/u);
    assert.match(
      composition,
      /new PrettifyProfilePortabilityService\([\s\S]{0,300}configStore\.allocatePrettifyCustomProfileId/u,
    );
    assert.doesNotMatch(composition, /PrettifyProfilePortabilityService[\s\S]{0,300}randomUUID/u);
  });
});
