/* eslint-disable max-classes-per-file -- The window fake owns one isolated Electron resource fixture. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow, BrowserWindowConstructorOptions, NativeImage, WebContents, WebFrameMain } from 'electron';
import { AboutWindowController } from '@main/aboutWindowController';
import { ProviderSettingsWindowController } from '@main/providerSettingsWindowController';
import { MainInteractionLock } from '@shared/mainInteractionLock';
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
  public enabled = true;
  public focusCount = 0;
  public hideCount = 0;
  public loadUrls: string[] = [];
  public minimized = false;
  public restoreCount = 0;
  public showCount = 0;
  public throwOnDestroyedWebContentsAccess = false;
  public visible = true;
  public readonly sent: Array<readonly unknown[]> = [];
  private readonly webContentsValue: WebContents;
  private readonly listeners = new Map<string, WindowListener[]>();
  private readonly webContentsListeners = new Map<string, WindowListener[]>();
  private frameUrl = '';
  private mainFrameValue: WebFrameMain;
  private webContentsUrl = '';

  public constructor(
    public readonly id: number,
    public readonly options: BrowserWindowConstructorOptions,
  ) {
    this.mainFrameValue = this.createMainFrame();
    const webContents = {
      getURL: () => this.webContentsUrl,
      id,
      isDestroyed: () => this.destroyed,
      on: (event: string, listener: WindowListener) => {
        this.addListener(this.webContentsListeners, event, listener);
        return webContents;
      },
      once: (event: string, listener: WindowListener) => {
        this.addListener(this.webContentsListeners, event, listener);
        return webContents;
      },
      send: (...args: unknown[]) => {
        this.sent.push(args);
      },
      setWindowOpenHandler: () => undefined,
    };
    Object.defineProperty(webContents, 'mainFrame', { get: () => this.mainFrameValue });
    this.webContentsValue = webContents as unknown as WebContents;
  }

  public get webContents(): WebContents {
    if (this.destroyed && this.throwOnDestroyedWebContentsAccess) {
      throw new TypeError('Object has been destroyed');
    }
    return this.webContentsValue;
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
    this.frameUrl = url;
    this.webContentsUrl = url;
    this.loadUrls.push(url);
    return Promise.resolve();
  }

  public replaceMainFrame(url: string): void {
    this.frameUrl = url;
    this.mainFrameValue = this.createMainFrame();
  }

  public setFrameUrl(url: string): void {
    this.frameUrl = url;
  }

  public setWebContentsUrl(url: string): void {
    this.webContentsUrl = url;
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

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

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

  private createMainFrame(): WebFrameMain {
    const frame = {} as WebFrameMain;
    Object.defineProperty(frame, 'url', { get: () => this.frameUrl });
    return frame;
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

class WindowManagerHarness {
  public readonly created: RecordingBrowserWindow[] = [];
  public operationActive = false;
  public readonly mainInteractionLock = new MainInteractionLock(() => this.operationActive);
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
    mainInteractionLock: this.mainInteractionLock,
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
    assert.equal(mainWindow?.options.width, 620);
    assert.equal(mainWindow?.options.height, 292);
    assert.equal(mainWindow?.options.useContentSize, true);
    assert.equal(mainWindow?.options.resizable, false);
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
    harness.created[0]?.sent.splice(0);
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
    harness.created[0]?.sent.splice(0);
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
    const [mainUrl] = mainWindow.loadUrls;
    const [settingsUrl] = settingsWindow.loadUrls;
    if (!mainUrl || !settingsUrl) throw new Error('Expected canonical window URLs');
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

    mainWindow.setFrameUrl(`${mainUrl}#route`);
    assert.equal(harness.manager.isTrustedMainFrame(mainWindow.webContents, mainWindow.webContents.mainFrame), false);
    mainWindow.loadURL(mainUrl);
    mainWindow.setWebContentsUrl(`${mainUrl}?unexpected=true`);
    assert.equal(harness.manager.isTrustedMainFrame(mainWindow.webContents, mainWindow.webContents.mainFrame), false);
    mainWindow.setWebContentsUrl(mainUrl);
    const originalMainFrame = mainWindow.webContents.mainFrame;
    mainWindow.replaceMainFrame(mainUrl);
    assert.equal(harness.manager.isTrustedMainFrame(mainWindow.webContents, originalMainFrame), false);
    assert.equal(harness.manager.isTrustedMainFrame(mainWindow.webContents, mainWindow.webContents.mainFrame), true);

    settingsWindow.setFrameUrl(`${settingsUrl}#route`);
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      false,
    );
    settingsWindow.setFrameUrl(`${settingsUrl}&unexpected=true`);
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      false,
    );
    settingsWindow.setFrameUrl('app://gpt-voice/settings.html?providerId=local-whisper');
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      false,
    );
    settingsWindow.loadURL(settingsUrl);
    settingsWindow.setWebContentsUrl(`${settingsUrl}#stale`);
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      false,
    );
    settingsWindow.setWebContentsUrl(settingsUrl);
    const originalSettingsFrame = settingsWindow.webContents.mainFrame;
    settingsWindow.replaceMainFrame(settingsUrl);
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(settingsWindow.webContents, originalSettingsFrame),
      false,
    );
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(settingsWindow.webContents, {
        url: settingsUrl,
      } as WebFrameMain),
      false,
    );
    settingsWindow.destroyed = true;
    assert.equal(
      harness.manager.isTrustedLocalWhisperSettingsFrame(
        settingsWindow.webContents,
        settingsWindow.webContents.mainFrame,
      ),
      false,
    );
  });

  it('guards only Local Whisper native close requests until renderer confirmation', () => {
    const harness = new WindowManagerHarness();
    assert.deepEqual(harness.manager.showProviderSettingsWindow('local-whisper', 'Local Whisper'), { success: true });
    assert.deepEqual(harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI'), {
      reason: 'locked',
      success: false,
    });
    const localWhisperWindow = harness.created[0];
    assert.ok(localWhisperWindow);

    localWhisperWindow.triggerClose();
    assert.equal(localWhisperWindow.destroyed, false);
    assert.deepEqual(localWhisperWindow.sent, [[PROVIDER_SETTINGS_IPC_CHANNELS.closeRequested]]);

    localWhisperWindow.throwOnDestroyedWebContentsAccess = true;
    assert.doesNotThrow(() => {
      assert.equal(harness.manager.closeProviderSettingsWindow(localWhisperWindow.webContents), true);
    });
    assert.equal(localWhisperWindow.destroyed, true);

    assert.deepEqual(harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI'), { success: true });
    const openAiWindow = harness.created[1];
    assert.ok(openAiWindow);
    openAiWindow.triggerClose();
    assert.equal(openAiWindow.destroyed, true);
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

  it('disables non-owner windows for the settings lease and restores them after close', () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    harness.manager.showHistoryWindow();
    harness.manager.showAboutWindow();

    const mainWindow = harness.created[0];
    const historyWindow = harness.created[1];
    const aboutWindow = harness.created[2];
    assert.ok(mainWindow);
    assert.ok(historyWindow);
    assert.ok(aboutWindow);

    assert.deepEqual(harness.manager.showSettingsWindow(), { success: true });
    const settingsWindow = harness.created[3];
    assert.ok(settingsWindow);
    assert.equal(mainWindow.enabled, false);
    assert.equal(historyWindow.enabled, false);
    assert.equal(aboutWindow.enabled, false);
    assert.equal(settingsWindow.enabled, true);

    harness.manager.closeSettingsWindow();
    assert.equal(mainWindow.enabled, true);
    assert.equal(historyWindow.enabled, true);
    assert.equal(aboutWindow.enabled, true);
  });

  it('refuses settings windows while recording is active', () => {
    const harness = new WindowManagerHarness();
    harness.mainInteractionLock.setRecordingLifecycleState('recording');

    assert.deepEqual(harness.manager.showSettingsWindow(), {
      reason: 'recording-active',
      success: false,
    });
    assert.deepEqual(harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI'), {
      reason: 'recording-active',
      success: false,
    });
    assert.equal(harness.created.length, 0);
  });

  it('refuses settings windows while provider work is active without creating a settings lease', () => {
    const harness = new WindowManagerHarness();
    harness.operationActive = true;

    assert.deepEqual(harness.manager.showSettingsWindow(), {
      reason: 'operation-active',
      success: false,
    });
    assert.deepEqual(harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI'), {
      reason: 'operation-active',
      success: false,
    });
    assert.equal(harness.mainInteractionLock.locked, false);
    assert.equal(harness.created.length, 0);
  });

  it('opens reference windows while provider work is active', () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    harness.operationActive = true;

    harness.manager.showHistoryWindow();
    harness.manager.showAboutWindow();

    assert.equal(harness.created.length, 3);
  });

  it('owns auxiliary windows, trusted-sender checks, and locale broadcasts', async () => {
    const harness = new WindowManagerHarness();
    harness.manager.createMainWindow();
    harness.manager.showSettingsWindow('shortcuts');
    const mainWindow = harness.created[0];
    const settingsWindow = harness.created[1];
    assert.ok(mainWindow);
    assert.ok(settingsWindow);
    assert.equal(mainWindow.enabled, false);
    assert.equal(settingsWindow.enabled, true);
    assert.equal(
      harness.manager.getTrustedSettingsWindow(settingsWindow.webContents, settingsWindow.loadUrls[0] ?? ''),
      settingsWindow as unknown as BrowserWindow,
    );

    harness.manager.showHistoryWindow();
    harness.manager.showAboutWindow();
    harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI');
    assert.equal(harness.created.length, 2);

    harness.manager.closeSettingsWindow();
    assert.equal(mainWindow.enabled, true);
    harness.manager.showHistoryWindow();
    harness.manager.showAboutWindow();
    harness.manager.showProviderSettingsWindow('openai-api', 'OpenAI');

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
    for (const window of harness.created.filter((candidate) => !candidate.destroyed)) {
      assert.deepEqual(window.sent[window.sent.length - 1], ['locale-changed', 'en']);
    }
    assert.deepEqual(chooserWindow.sent, []);
    assert.deepEqual(mainWindow.sent[mainWindow.sent.length - 1], ['locale-changed', 'en']);

    providerWindow?.triggerClose();
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
