/* eslint-disable max-classes-per-file -- The window fake owns one isolated Electron resource fixture. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow, BrowserWindowConstructorOptions, NativeImage, WebContents } from 'electron';
import { AboutWindowController } from '@main/aboutWindowController';
import { ProviderSettingsWindowController } from '@main/providerSettingsWindowController';
import { WindowManager } from '@main/window';

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
    this.webContents = {
      getURL: () => this.url,
      id,
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

  it('owns auxiliary windows, trusted-sender checks, and locale broadcasts', () => {
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
    assert.equal(
      harness.manager.isTrustedAppWindow(providerWindow?.webContents, providerWindow?.loadUrls[0] ?? ''),
      true,
    );
    assert.equal(harness.manager.isTrustedAppWindow(providerWindow?.webContents, 'https://attacker.example/'), false);
    assert.equal(
      harness.manager.isTrustedSettingsWindow(settingsWindow?.webContents, settingsWindow?.loadUrls[0] ?? ''),
      true,
    );
    assert.equal(
      harness.manager.isTrustedSettingsWindow(mainWindow?.webContents, mainWindow?.loadUrls[0] ?? ''),
      false,
    );
    assert.equal(
      harness.manager.isTrustedSettingsWindow(settingsWindow?.webContents, 'app://gpt-voice/settings.html'),
      false,
    );

    harness.manager.broadcastLocaleChanged('en');
    for (const window of harness.created) {
      assert.deepEqual(window.sent[window.sent.length - 1], ['locale-changed', 'en']);
    }
    assert.equal(mainWindow?.sent.length, 1);

    harness.manager.closeSettingsWindow();
    harness.manager.showSettingsWindow('audit-log');
    const replacementSettingsWindow = harness.created[5];
    assert.equal(
      harness.manager.isTrustedSettingsWindow(settingsWindow?.webContents, settingsWindow?.loadUrls[0] ?? ''),
      false,
    );
    assert.equal(
      harness.manager.isTrustedSettingsWindow(
        replacementSettingsWindow?.webContents,
        replacementSettingsWindow?.loadUrls[0] ?? '',
      ),
      true,
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
