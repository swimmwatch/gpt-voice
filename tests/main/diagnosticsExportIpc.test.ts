/* eslint-disable max-classes-per-file -- transport, trust policy, and preload fakes form one IPC boundary fixture. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import type { BrowserWindow, IpcMainInvokeEvent, IpcRendererEvent, WebContents } from 'electron';

import { TrustedIpcRegistrar, type MainIpcLogger, type MainIpcTransport } from '@main/ipc';
import { createElectronApi, type ElectronApiIpcRenderer } from '@main/preloadApi';
import type { WindowManager } from '@main/window';
import { DIAGNOSTICS_EXPORT_IPC_CHANNEL, type DiagnosticsExportResult } from '@shared/diagnosticsArchive';

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
    const webContents = {
      getURL: () => sender.url,
      id: sender.id,
    } as unknown as WebContents;
    const event = {
      sender: webContents,
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
  public readonly trustedSenders: readonly SenderFixture[] = [
    { id: 1, name: 'main', url: 'app://gpt-voice/index.html' },
    { id: 2, name: 'about', url: 'app://gpt-voice/about.html' },
    { id: 3, name: 'history', url: 'app://gpt-voice/history.html' },
    { id: 4, name: 'provider-settings', url: 'app://gpt-voice/provider-settings.html?providerId=chatgpt' },
    { id: 5, name: 'stale-settings', url: SETTINGS_URL },
    this.liveSettings,
  ];

  public getTrustedSettingsWindow(webContents: WebContents, senderUrl: string): BrowserWindow | null {
    return webContents.id === this.liveSettings.id && senderUrl === this.liveSettings.url
      ? this.liveSettingsWindow
      : null;
  }

  public isTrustedAppWindow(webContents: WebContents, senderUrl: string): boolean {
    return this.trustedSenders.some((sender) => sender.id === webContents.id && sender.url === senderUrl);
  }
}

class DiagnosticsExportIpcHarness {
  public readonly calls: Array<{ readonly args: readonly unknown[]; readonly window: BrowserWindow }> = [];
  public readonly transport = new RecordingMainIpcTransport();
  public readonly trustPolicy = new ExactSettingsWindowTrustPolicy();
  public readonly warnings: unknown[][] = [];
  public readonly registrar: TrustedIpcRegistrar;

  public constructor() {
    const logger: MainIpcLogger = {
      error: () => undefined,
      info: () => undefined,
      warn: (...args) => this.warnings.push(args),
    };
    this.registrar = new TrustedIpcRegistrar(this.transport, logger, this.trustPolicy as unknown as WindowManager);
    this.registrar.handleSettingsWindow(DIAGNOSTICS_EXPORT_IPC_CHANNEL, (_event, settingsWindow, ...args) => {
      this.calls.push({ args, window: settingsWindow });
      return { status: 'saved' };
    });
  }
}

class RecordingPreloadIpcRenderer implements ElectronApiIpcRenderer {
  public readonly invocations: Array<{ readonly args: readonly unknown[]; readonly channel: string }> = [];

  public invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result> {
    this.invocations.push({ args, channel });
    return Promise.resolve({ status: 'cancelled' } as DiagnosticsExportResult as Result);
  }

  public on(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}

  public removeListener(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}
}

describe('diagnostics export IPC contract', () => {
  it('registers the export through the Settings-window-only boundary', () => {
    const ipcSource = readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');

    assert.match(
      ipcSource,
      /handleSettingsWindow\(DIAGNOSTICS_EXPORT_IPC_CHANNEL,[\s\S]{0,180}diagnosticsExport\.export/u,
    );
    assert.doesNotMatch(ipcSource, /trustedIpc\.handle\(DIAGNOSTICS_EXPORT_IPC_CHANNEL/u);
    assert.doesNotMatch(ipcSource, /handleAboutWindow/u);
  });

  it('accepts only the exact live Settings window, frame, ID, and loaded URL', async () => {
    const harness = new DiagnosticsExportIpcHarness();

    assert.deepEqual(
      await harness.transport.invoke(DIAGNOSTICS_EXPORT_IPC_CHANNEL, harness.trustPolicy.liveSettings, SETTINGS_URL),
      { status: 'saved' },
    );
    assert.deepEqual(harness.calls, [{ args: [], window: harness.trustPolicy.liveSettingsWindow }]);

    for (const sender of harness.trustPolicy.trustedSenders.filter(
      (candidate) => candidate.id !== harness.trustPolicy.liveSettings.id,
    )) {
      await assert.rejects(
        harness.transport.invoke(DIAGNOSTICS_EXPORT_IPC_CHANNEL, sender, sender.url),
        /Rejected Settings-only IPC sender/u,
        sender.name,
      );
    }

    await assert.rejects(
      harness.transport.invoke(
        DIAGNOSTICS_EXPORT_IPC_CHANNEL,
        harness.trustPolicy.liveSettings,
        'app://gpt-voice/index.html?private-path=/home/alice',
      ),
      /Rejected IPC from untrusted sender/u,
    );
    await assert.rejects(
      harness.transport.invoke(DIAGNOSTICS_EXPORT_IPC_CHANNEL, { ...harness.trustPolicy.liveSettings, id: 77 }, null),
      /Rejected IPC from untrusted sender/u,
    );
    assert.equal(harness.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(harness.warnings), /private-path|home|alice|app:\/\/|settings\.html/u);
  });

  it('maps the functional preload API to one no-argument invoke with a path-free result', async () => {
    const renderer = new RecordingPreloadIpcRenderer();
    const api = createElectronApi(renderer);

    assert.deepEqual(await api.exportDiagnostics(), { status: 'cancelled' });
    assert.deepEqual(renderer.invocations, [{ args: [], channel: DIAGNOSTICS_EXPORT_IPC_CHANNEL }]);
  });

  it('keeps preload and renderer declarations additive and path-free', () => {
    const preload = readFileSync(path.join(PROJECT_ROOT, 'src/main/preloadApi.ts'), 'utf8');
    const rendererTypes = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/types.d.ts'), 'utf8');
    const shared = readFileSync(path.join(PROJECT_ROOT, 'src/shared/diagnosticsArchive.ts'), 'utf8');

    assert.equal(preload.includes('exportDiagnostics:'), true);
    assert.equal(rendererTypes.includes('exportDiagnostics:'), true);
    assert.doesNotMatch(
      `${preload}\n${rendererTypes}\n${shared}`,
      /DiagnosticsExportResult[\s\S]{0,160}(?:path|filename|error|stack)/iu,
    );
  });
});
