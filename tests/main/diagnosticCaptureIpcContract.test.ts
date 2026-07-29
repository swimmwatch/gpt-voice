/* eslint-disable max-classes-per-file -- transport, trust policy, and preload fakes form one IPC boundary fixture. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { BrowserWindow, IpcMainInvokeEvent, IpcRendererEvent, WebContents } from 'electron';
import { TrustedIpcRegistrar, type MainIpcLogger, type MainIpcTransport } from '@main/ipc';
import { createElectronApi, type ElectronApiIpcRenderer } from '@main/preloadApi';
import type { WindowManager } from '@main/window';
import {
  DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS,
  DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS,
} from '@shared/diagnosticCaptureSettings';

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

  public isTrustedAppWindow(webContents: WebContents, senderUrl: string): boolean {
    return this.trustedSenders.some((sender) => sender.id === webContents.id && sender.url === senderUrl);
  }

  public getTrustedSettingsWindow(webContents: WebContents, senderUrl: string): BrowserWindow | null {
    return webContents.id === this.liveSettings.id && senderUrl === this.liveSettings.url
      ? this.liveSettingsWindow
      : null;
  }
}

class DiagnosticCaptureIpcHarness {
  public readonly calls: unknown[][] = [];
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
    for (const channel of Object.values(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS)) {
      this.registrar.handleSettingsWindow(channel, (_event, _settingsWindow, ...args) => {
        this.calls.push([channel, ...args]);
        return { success: true };
      });
    }
  }
}

class RecordingPreloadIpcRenderer implements ElectronApiIpcRenderer {
  public readonly invocations: Array<{ readonly args: readonly unknown[]; readonly channel: string }> = [];

  public invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result> {
    this.invocations.push({ args, channel });
    return Promise.resolve(
      (channel === DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.get
        ? DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS
        : { success: true }) as Result,
    );
  }

  public on(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}

  public removeListener(_channel: string, _listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void {}
}

describe('diagnostic capture IPC contract', () => {
  it('registers all three channels through the Settings-window-only boundary', () => {
    const ipcSource = readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');

    assert.match(ipcSource, /handleSettingsWindow\([\s\S]{0,120}DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS\.get/u);
    assert.match(ipcSource, /handleSettingsWindow\([\s\S]{0,120}DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS\.set/u);
    assert.match(ipcSource, /handleSettingsWindow\([\s\S]{0,120}DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS\.clear/u);
    assert.doesNotMatch(ipcSource, /trustedIpc\.handle\(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS\.(?:get|set|clear)/u);
  });

  it('accepts only the exact live Settings window, frame, and loaded URL', async () => {
    const harness = new DiagnosticCaptureIpcHarness();
    const channel = DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.get;

    assert.deepEqual(await harness.transport.invoke(channel, harness.trustPolicy.liveSettings, SETTINGS_URL), {
      success: true,
    });
    assert.deepEqual(harness.calls, [[channel]]);

    for (const sender of harness.trustPolicy.trustedSenders.filter(
      (candidate) => candidate.id !== harness.trustPolicy.liveSettings.id,
    )) {
      await assert.rejects(
        harness.transport.invoke(channel, sender, sender.url),
        /Rejected Settings-only IPC sender/u,
        sender.name,
      );
    }

    await assert.rejects(
      harness.transport.invoke(channel, harness.trustPolicy.liveSettings, 'app://gpt-voice/index.html'),
      /Rejected IPC from untrusted sender/u,
    );
    await assert.rejects(
      harness.transport.invoke(
        channel,
        { ...harness.trustPolicy.liveSettings, url: 'app://gpt-voice/settings.html?stale=1' },
        null,
      ),
      /Rejected IPC from untrusted sender/u,
    );
    assert.equal(harness.calls.length, 1);
  });

  it('maps the functional preload API to the exact channels and request shapes', async () => {
    const renderer = new RecordingPreloadIpcRenderer();
    const api = createElectronApi(renderer);
    const mutation = {
      confirmedPurgeCategories: ['translation'] as const,
      settings: {
        capturePrettifyDiagnostics: true,
        captureTranslationDiagnostics: false,
      },
    };
    const clear = { confirmed: true, target: 'all' } as const;

    assert.deepEqual(await api.getDiagnosticCaptureSettings(), DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS);
    await api.setDiagnosticCaptureSettings(mutation);
    await api.clearDiagnosticCapture(clear);

    assert.deepEqual(renderer.invocations, [
      { args: [], channel: DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.get },
      { args: [mutation], channel: DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.set },
      { args: [clear], channel: DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.clear },
    ]);
  });

  it('keeps the shared methods type-identical in preload and renderer declarations', () => {
    const preload = readFileSync(path.join(PROJECT_ROOT, 'src/main/preloadApi.ts'), 'utf8');
    const rendererTypes = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/types.d.ts'), 'utf8');

    for (const method of ['getDiagnosticCaptureSettings', 'setDiagnosticCaptureSettings', 'clearDiagnosticCapture']) {
      assert.equal(preload.includes(`${method}:`), true);
      assert.equal(rendererTypes.includes(`${method}:`), true);
    }
    assert.doesNotMatch(`${preload}\n${rendererTypes}`, /affectedRows|databasePath|sourceText|resultText/u);
  });
});
