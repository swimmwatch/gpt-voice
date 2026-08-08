/* eslint-disable max-classes-per-file -- The window fake owns one isolated Electron resource fixture. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow, BrowserWindowConstructorOptions, NativeImage, WebContents, WebFrameMain } from 'electron';
import { AboutWindowController } from '@main/aboutWindowController';
import { ProviderSettingsWindowController } from '@main/providerSettingsWindowController';
import { WindowManager } from '@main/window';
import { TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS } from '@shared/translationProvider';
import { PROVIDER_SETTINGS_IPC_CHANNELS } from '@shared/voiceProvider';
import {
  FIRST_LAUNCH_STARTUP_IPC_CHANNELS,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';

type WindowListener = (...args: unknown[]) => void;

class RecordingBrowserWindow {
  public closeCount = 0;
  public destroyed = false;
  public focusCount = 0;
  public hideCount = 0;
  public loadUrls: string[] = [];
  public minimized = false;
  public restoreCount = 0;
  public showCount = 0;
  public visible = true;
  public readonly sent: Array<readonly unknown[]> = [];
  public readonly webContents: WebContents;
  private readonly listeners = new Map<string, WindowListener[]>();
  private readonly webContentsListeners = new Map<string, WindowListener[]>();
  private url = '';

  public constructor(
    public readonly id: number,
    public readonly options: BrowserWindowConstructorOptions,
  ) {
    const mainFrame = {} as WebFrameMain;
    Object.defineProperty(mainFrame, 'url', { get: () => this.url });
    this.webContents = {
      get mainFrame() {
        return mainFrame;
      },
      getURL: () => this.url,
      id,
      isDestroyed: () => this.destroyed,
      on: (event: string, listener: WindowListener) => {
        this.addListener(this.webContentsListeners, event, listener);
        return this.webContents;
      },
      once: (event: string, listener: WindowListener) => {
        this.addListener(this.webContentsListeners, event, listener);
        return this.webContents;
      },
      send: (...args: unknown[]) => {
        this.sent.push(args);
      },
      setWindowOpenHandler: () => undefined,
    } as unknown as WebContents;
  }

  public close(): void {
    this.closeCount += 1;
    let prevented = false;
    this.emit('close', {
      preventDefault: () => {
        prevented = true;
      },
    });
    if (prevented) return;
    this.destroyed = true;
    this.emit('closed');
  }

  public focus(): void {
    this.focusCount += 1;
  }

  public hide(): void {
    this.hideCount += 1;
    this.visible = false;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public isMinimized(): boolean {
    return this.minimized;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public loadURL(url: string): Promise<void> {
    this.url = url;
    this.loadUrls.push(url);
    return Promise.resolve();
  }

  public on(event: string, listener: WindowListener): this {
    this.addListener(this.listeners, event, listener);
    return this;
  }

  public once(event: string, listener: WindowListener): this {
    this.addListener(this.listeners, event, listener);
    return this;
  }

  public restore(): void {
    this.minimized = false;
    this.restoreCount += 1;
  }

  public setIcon(): void {}

  public setMenuBarVisibility(): void {}

  public show(): void {
    this.showCount += 1;
    this.visible = true;
  }

  public triggerClose(): void {
    this.close();
  }

  private addListener(listeners: Map<string, WindowListener[]>, event: string, listener: WindowListener): void {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

class WindowManagerHarness {
  public readonly created: RecordingBrowserWindow[] = [];
  public readonly manager = new WindowManager({
    createAboutWindowController: (createWindow) => new AboutWindowController(createWindow),
    createBrowserWindow: (options) => {
      const window = new RecordingBrowserWindow(this.created.length + 1, options);
      this.created.push(window);
      return window as unknown as BrowserWindow;
    },
    getAppIcon: () =>
      ({
        getSize: () => ({ height: 512, width: 512 }),
        isEmpty: () => false,
      }) as unknown as NativeImage,
    getAppIconPath: () => '/assets/icon.png',
    getAppUrl: (pathname = 'index.html') => `app://gpt-voice/${pathname}`,
    logger: { debug: () => undefined, warn: () => undefined },
    openExternal: async () => undefined,
    platform: 'linux',
    preloadPath: '/dist/preload.js',
    providerSettingsWindowController: new ProviderSettingsWindowController<BrowserWindow>(),
  });
}

describe('WindowManager', () => {
  it('owns secure main-window creation and close-to-tray state', () => {
    const harness = new WindowManagerHarness();

    harness.manager.createMainWindow();
    harness.manager.createMainWindow();

    assert.equal(harness.created.length, 1);
    const mainWindow = harness.created[0];
    assert.equal(mainWindow?.loadUrls[0], 'app://gpt-voice/index.html');
    assert.deepEqual(mainWindow?.options.webPreferences, {
      contextIsolation: true,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      preload: '/dist/preload.js',
      sandbox: true,
      webviewTag: false,
    });

    mainWindow?.triggerClose();
    assert.equal(mainWindow?.hideCount, 1);
    assert.equal(mainWindow?.destroyed, false);
  });

  it('publishes only the closed Translation connection state to the main window', () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    const state = {
      detail: 'navigation-failed',
      providerId: 'google',
      status: 'not-connected',
      targetLanguage: 'en',
    } as const;

    harness.manager.publishTranslationProviderConnectionState(state);

    assert.deepEqual(harness.created[0]?.sent, [[TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed, state]]);
  });

  it('publishes only valid startup snapshots and tolerates missing or destroyed main windows', () => {
    const harness = new WindowManagerHarness();
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

    harness.manager.publishFirstLaunchStartupSnapshot(snapshot);
    harness.manager.createMainWindow();
    harness.manager.publishFirstLaunchStartupSnapshot({ ...snapshot, privateInstallerPath: '/private/cache/chrome' });
    harness.manager.publishFirstLaunchStartupSnapshot(snapshot);
    assert.deepEqual(harness.created[0]?.sent, [[FIRST_LAUNCH_STARTUP_IPC_CHANNELS.changed, snapshot]]);

    const mainWindow = harness.created[0];
    assert.ok(mainWindow);
    mainWindow.destroyed = true;
    harness.manager.publishFirstLaunchStartupSnapshot(snapshot);
    assert.equal(mainWindow.sent.length, 1);
  });

  it('authorizes only exact live main and Local Whisper settings frames', () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    harness.manager.showProviderSettingsWindow('local-whisper', 'Local Whisper');
    const mainWindow = harness.created[0];
    const settingsWindow = harness.created[1];
    assert.ok(mainWindow && settingsWindow);
    assert.equal(settingsWindow.options.width, 912);
    assert.equal(settingsWindow.options.height, 820);

    assert.equal(harness.manager.isTrustedMainFrame(mainWindow.webContents, mainWindow.webContents.mainFrame), true);
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      true,
    );
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(settingsWindow.webContents, {
        url: settingsWindow.loadUrls[0],
      } as WebFrameMain),
      false,
    );
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(mainWindow.webContents, mainWindow.webContents.mainFrame),
      false,
    );
  });

  it('guards only Local Whisper native close requests until renderer confirmation', () => {
    const harness = new WindowManagerHarness();
    harness.manager.showProviderSettingsWindow('local-whisper', 'Local Whisper');
    harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI');
    const localWhisperWindow = harness.created[0];
    const openAiWindow = harness.created[1];
    assert.ok(localWhisperWindow && openAiWindow);

    localWhisperWindow.triggerClose();
    assert.equal(localWhisperWindow.destroyed, false);
    assert.deepEqual(localWhisperWindow.sent, [[PROVIDER_SETTINGS_IPC_CHANNELS.closeRequested]]);

    openAiWindow.triggerClose();
    assert.equal(openAiWindow.destroyed, true);
    assert.deepEqual(openAiWindow.sent, []);

    assert.equal(harness.manager.closeProviderSettingsWindow(localWhisperWindow.webContents), true);
    assert.equal(localWhisperWindow.destroyed, true);
  });

  it('bypasses the Local Whisper close guard during application disposal', () => {
    const harness = new WindowManagerHarness();
    harness.manager.showProviderSettingsWindow('local-whisper', 'Local Whisper');
    const localWhisperWindow = harness.created[0];
    assert.ok(localWhisperWindow);

    harness.manager.dispose();

    assert.equal(localWhisperWindow.destroyed, true);
    assert.deepEqual(localWhisperWindow.sent, []);
  });

  it('owns auxiliary windows, trusted-sender checks, and locale broadcasts', async () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    harness.manager.showSettingsWindow('shortcuts');
    harness.manager.showHistoryWindow();
    harness.manager.showAboutWindow();
    harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI');

    const mainWindow = harness.created[0];
    const settingsWindow = harness.created[1];
    const providerWindow = harness.created[4];
    assert.equal(harness.created.length, 5);
    assert.match(providerWindow?.loadUrls[0] ?? '', /providerId=openai-api/u);
    assert.equal(providerWindow?.options.width, 560);
    assert.equal(providerWindow?.options.height, 680);
    assert.equal(
      harness.manager.isTrustedAppWindow(providerWindow?.webContents, providerWindow?.loadUrls[0] ?? ''),
      true,
    );
    assert.equal(harness.manager.isTrustedAppWindow(providerWindow?.webContents, 'https://attacker.example/'), false);
    assert.equal(
      harness.manager.getTrustedSettingsWindow(settingsWindow?.webContents, settingsWindow?.loadUrls[0] ?? ''),
      settingsWindow as unknown as BrowserWindow,
    );
    assert.equal(
      harness.manager.getTrustedSettingsWindow(mainWindow?.webContents, mainWindow?.loadUrls[0] ?? ''),
      null,
    );
    assert.equal(
      harness.manager.getTrustedSettingsWindow(settingsWindow?.webContents, 'app://gpt-voice/settings.html'),
      null,
    );
    const chooserWindow = new RecordingBrowserWindow(99, {});
    await chooserWindow.loadURL('app://gpt-voice/prettify-profile-chooser.html');
    assert.equal(
      harness.manager.isTrustedAppWindow(chooserWindow.webContents, 'app://gpt-voice/prettify-profile-chooser.html'),
      false,
    );

    harness.manager.broadcastLocaleChanged('en');
    for (const window of harness.created) {
      assert.deepEqual(window.sent[window.sent.length - 1], ['locale-changed', 'en']);
    }
    assert.deepEqual(chooserWindow.sent, []);
    assert.equal(mainWindow?.sent.length, 1);

    harness.manager.closeSettingsWindow();
    harness.manager.showSettingsWindow('audit-log');
    const replacementSettingsWindow = harness.created[5];
    assert.equal(
      harness.manager.getTrustedSettingsWindow(settingsWindow?.webContents, settingsWindow?.loadUrls[0] ?? ''),
      null,
    );
    assert.equal(
      harness.manager.getTrustedSettingsWindow(
        replacementSettingsWindow?.webContents,
        replacementSettingsWindow?.loadUrls[0] ?? '',
      ),
      replacementSettingsWindow as unknown as BrowserWindow,
    );
  });

  it('keeps state isolated and disposes every owned window idempotently', () => {
    const first = new WindowManagerHarness();
    const second = new WindowManagerHarness();
    first.manager.createMainWindow();
    first.manager.showAboutWindow();
    second.manager.createMainWindow();

    first.manager.dispose();
    first.manager.dispose();

    assert.equal(
      first.created.every((window) => window.destroyed),
      true,
    );
    assert.equal(
      first.created.every((window) => window.closeCount === 1),
      true,
    );
    assert.equal(second.created[0]?.destroyed, false);
    assert.equal(first.manager.getMainWindow(), null);
  });
});
