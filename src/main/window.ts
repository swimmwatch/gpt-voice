import type { BrowserWindow, BrowserWindowConstructorOptions, NativeImage, WebContents } from 'electron';
import { AboutWindowController } from './aboutWindowController';
import { ProviderSettingsWindowController } from './providerSettingsWindowController';
import type { AppLocaleId } from '@shared/appLocale';
import type { AppSettingsSectionId } from '@shared/appSettings';

const MAIN_WINDOW_CONTENT_WIDTH = 520;
const MAIN_WINDOW_CONTENT_HEIGHT = 420;
const INITIAL_WINDOW_BACKGROUND_COLOR = '#181a1b';
const APP_PROTOCOL = 'app:';
const APP_HOST = 'gpt-voice';

export interface WindowManagerLogger {
  debug(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface WindowManagerDependencies {
  readonly createAboutWindowController: (createWindow: () => BrowserWindow) => AboutWindowController<BrowserWindow>;
  readonly createBrowserWindow: (options: BrowserWindowConstructorOptions) => BrowserWindow;
  readonly getAppIcon: () => NativeImage;
  readonly getAppIconPath: () => string;
  readonly getAppUrl: (pathname?: string) => string;
  readonly logger: WindowManagerLogger;
  readonly openExternal: (url: string) => Promise<void>;
  readonly platform: NodeJS.Platform;
  readonly preloadPath: string;
  readonly providerSettingsWindowController: ProviderSettingsWindowController<BrowserWindow>;
}

export interface BackgroundBrowserStatus {
  readonly authExpired?: boolean;
  readonly error?: string;
  readonly providerId?: string;
  readonly ready: boolean;
}

/** Owns every renderer window and the trust boundary around their web contents. */
export class WindowManager {
  private readonly aboutWindowController: AboutWindowController<BrowserWindow>;
  private historyWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;
  private readonly providerSettingsWindowController: ProviderSettingsWindowController<BrowserWindow>;
  private quitting = false;
  private settingsCloseConfirmed = false;
  private settingsWindow: BrowserWindow | null = null;

  public constructor(private readonly dependencies: WindowManagerDependencies) {
    this.aboutWindowController = dependencies.createAboutWindowController(this.createAboutWindow);
    this.providerSettingsWindowController = dependencies.providerSettingsWindowController;
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow;
  }

  public getHistoryWindow(): BrowserWindow | null {
    return this.historyWindow;
  }

  public setQuitting(value: boolean): void {
    this.quitting = value;
  }

  public publishBackgroundStatus(status: BackgroundBrowserStatus, fallbackProviderId: string): void {
    const providerId = status.providerId || fallbackProviderId;
    if (status.ready) {
      this.mainWindow?.webContents.send('bg-browser-ready', providerId);
    } else if (status.error) {
      this.mainWindow?.webContents.send('bg-browser-error', providerId, status.error, Boolean(status.authExpired));
    }
  }

  public publishProviderSettingsChanged(settings: unknown, source: Pick<WebContents, 'id'>): void {
    if (!this.mainWindow || this.mainWindow.webContents.id === source.id) return;
    this.mainWindow.webContents.send('provider-settings-changed', settings);
  }

  public publishPrettifySettingsChanged(settings: unknown): void {
    this.mainWindow?.webContents.send('prettify-settings-changed', settings);
    this.settingsWindow?.webContents.send('prettify-settings-changed', settings);
  }

  public broadcastLocaleChanged(locale: AppLocaleId): void {
    for (const window of new Set(this.getAllWindows())) {
      if (window && !window.isDestroyed()) {
        window.webContents.send('locale-changed', locale);
      }
    }
  }

  public isTrustedAppWindow(webContents: WebContents, senderUrl: string): boolean {
    return this.getAllWindows().some((window) => {
      return window?.webContents.id === webContents.id && senderUrl === window.webContents.getURL();
    });
  }

  public isTrustedSettingsWindow(webContents: WebContents, senderUrl: string): boolean {
    const settingsWindow = this.settingsWindow;
    return Boolean(
      settingsWindow &&
      !settingsWindow.isDestroyed() &&
      settingsWindow.webContents.id === webContents.id &&
      senderUrl === settingsWindow.webContents.getURL(),
    );
  }

  public createMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) return;

    const appIcon = this.dependencies.getAppIcon();
    const appIconPath = this.dependencies.getAppIconPath();
    if (appIcon.isEmpty()) {
      this.dependencies.logger.warn('App icon could not be loaded:', appIconPath);
    } else {
      this.dependencies.logger.debug('App icon loaded:', appIconPath, appIcon.getSize());
    }

    const window = this.dependencies.createBrowserWindow({
      width: MAIN_WINDOW_CONTENT_WIDTH,
      height: MAIN_WINDOW_CONTENT_HEIGHT,
      useContentSize: true,
      autoHideMenuBar: true,
      backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
      fullscreenable: false,
      maximizable: false,
      resizable: false,
      show: true,
      webPreferences: this.createWebPreferences(),
      icon: appIconPath,
    });
    this.mainWindow = window;

    const applyWindowIcon = (): void => {
      if (this.mainWindow !== window || window.isDestroyed() || this.dependencies.platform === 'darwin') return;
      window.setIcon(appIconPath);
      if (!appIcon.isEmpty()) window.setIcon(appIcon);
    };

    applyWindowIcon();
    window.once('ready-to-show', applyWindowIcon);
    window.webContents.once('did-finish-load', applyWindowIcon);
    window.setMenuBarVisibility(false);
    void window.loadURL(this.dependencies.getAppUrl());
    this.applyNavigationGuards(window);

    window.on('closed', () => {
      if (this.mainWindow === window) this.mainWindow = null;
    });
    window.on('close', (event) => {
      if (this.mainWindow === window && !this.quitting) {
        event.preventDefault();
        window.hide();
      }
    });
  }

  public showMainWindow(): void {
    const window = this.mainWindow;
    if (!window || window.isDestroyed()) {
      this.createMainWindow();
      return;
    }
    this.showAndFocus(window);
  }

  public showSettingsWindow(section?: AppSettingsSectionId): void {
    const existing = this.settingsWindow;
    if (existing && !existing.isDestroyed()) {
      this.showAndFocus(existing);
      if (section) existing.webContents.send('app-settings-section-requested', section);
      return;
    }

    const window = this.dependencies.createBrowserWindow({
      width: 760,
      height: 720,
      minWidth: 440,
      minHeight: 520,
      autoHideMenuBar: true,
      backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
      show: true,
      title: 'Settings',
      webPreferences: this.createWebPreferences(),
      icon: this.dependencies.getAppIconPath(),
    });
    this.settingsWindow = window;
    window.setMenuBarVisibility(false);
    this.applyNavigationGuards(window);
    const settingsUrl = new URL(this.dependencies.getAppUrl('settings.html'));
    if (section) settingsUrl.searchParams.set('section', section);
    void window.loadURL(settingsUrl.toString());

    window.on('close', (event) => {
      if (this.quitting || this.settingsCloseConfirmed) return;
      event.preventDefault();
      window.webContents.send('app-settings-close-requested');
    });
    window.on('closed', () => {
      if (this.settingsWindow === window) this.settingsWindow = null;
      this.settingsCloseConfirmed = false;
    });
  }

  public closeSettingsWindow(): void {
    const window = this.settingsWindow;
    if (!window || window.isDestroyed()) return;
    this.settingsCloseConfirmed = true;
    window.close();
  }

  public showHistoryWindow(): void {
    const existing = this.historyWindow;
    if (existing && !existing.isDestroyed()) {
      this.showAndFocus(existing);
      return;
    }

    const window = this.dependencies.createBrowserWindow({
      width: 760,
      height: 720,
      minWidth: 520,
      minHeight: 420,
      autoHideMenuBar: true,
      backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
      show: true,
      title: 'History',
      webPreferences: this.createWebPreferences(),
      icon: this.dependencies.getAppIconPath(),
    });
    this.historyWindow = window;
    window.setMenuBarVisibility(false);
    this.applyNavigationGuards(window);
    void window.loadURL(this.dependencies.getAppUrl('history.html'));
    window.on('closed', () => {
      if (this.historyWindow === window) this.historyWindow = null;
    });
  }

  public showAboutWindow(): void {
    this.aboutWindowController.show();
  }

  public closeAboutWindow(): void {
    this.aboutWindowController.close();
  }

  public showProviderSettingsWindow(providerId: string, title: string): void {
    this.providerSettingsWindowController.show(providerId, () => {
      const providerSettingsUrl = new URL(this.dependencies.getAppUrl('provider-settings.html'));
      providerSettingsUrl.searchParams.set('providerId', providerId);
      const window = this.dependencies.createBrowserWindow({
        width: 560,
        height: 680,
        minWidth: 440,
        minHeight: 520,
        useContentSize: true,
        autoHideMenuBar: true,
        backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
        resizable: true,
        show: true,
        title,
        webPreferences: this.createWebPreferences(),
        icon: this.dependencies.getAppIconPath(),
      });
      window.setMenuBarVisibility(false);
      this.applyNavigationGuards(window);
      void window.loadURL(providerSettingsUrl.toString());
      return window;
    });
  }

  public closeProviderSettingsWindow(webContents: WebContents): boolean {
    return this.providerSettingsWindowController.closeForWebContents(webContents);
  }

  public dispose(): void {
    this.quitting = true;
    this.settingsCloseConfirmed = true;
    for (const window of new Set([this.mainWindow, this.settingsWindow, this.historyWindow])) {
      if (window && !window.isDestroyed()) window.close();
    }
    this.mainWindow = null;
    this.settingsWindow = null;
    this.historyWindow = null;
    this.aboutWindowController.dispose();
    this.providerSettingsWindowController.dispose();
  }

  private getAllWindows(): readonly (BrowserWindow | null)[] {
    return [
      this.mainWindow,
      this.settingsWindow,
      this.historyWindow,
      this.aboutWindowController.getWindow(),
      ...this.providerSettingsWindowController.getWindows(),
    ];
  }

  private readonly createAboutWindow = (): BrowserWindow => {
    const window = this.dependencies.createBrowserWindow({
      width: 420,
      height: 420,
      minWidth: 360,
      minHeight: 380,
      useContentSize: true,
      autoHideMenuBar: true,
      backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
      show: true,
      maximizable: false,
      resizable: false,
      title: 'About GPT-Voice',
      webPreferences: this.createWebPreferences(),
      icon: this.dependencies.getAppIconPath(),
    });
    window.setMenuBarVisibility(false);
    this.applyNavigationGuards(window);
    void window.loadURL(this.dependencies.getAppUrl('about.html'));
    return window;
  };

  private createWebPreferences(): NonNullable<BrowserWindowConstructorOptions['webPreferences']> {
    return {
      preload: this.dependencies.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    };
  }

  private showAndFocus(window: BrowserWindow): void {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  private applyNavigationGuards(window: BrowserWindow): void {
    window.webContents.on('will-navigate', (event, url) => {
      let allowed: boolean;
      try {
        const parsed = new URL(url);
        allowed = parsed.protocol === APP_PROTOCOL && parsed.host === APP_HOST;
      } catch {
        allowed = false;
      }

      if (!allowed) {
        this.dependencies.logger.warn('Blocked navigation to:', url);
        event.preventDefault();
      }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:') void this.dependencies.openExternal(parsed.toString());
      } catch {
        this.dependencies.logger.warn('Blocked malformed external URL:', url);
      }
      return { action: 'deny' };
    });
  }
}
