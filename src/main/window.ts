import { BrowserWindow, shell, type BrowserWindowConstructorOptions, type WebContents } from 'electron';
import * as path from 'node:path';
import { createAboutWindowController, isTrustedWindow } from './aboutWindowController';
import { createProviderSettingsWindowController } from './providerSettingsWindowController';
import { createLogger } from './logger';
import { getAppIcon, getAppIconPath } from './assets';
import { getAppUrl } from './appProtocol';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;
let isQuitting = false;
let isSettingsWindowCloseConfirmed = false;
const log = createLogger('window');
const MAIN_WINDOW_CONTENT_WIDTH = 460;
const MAIN_WINDOW_CONTENT_HEIGHT = 420;
const INITIAL_WINDOW_BACKGROUND_COLOR = '#181a1b';
const providerSettingsWindowController = createProviderSettingsWindowController<BrowserWindow>();

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

export function getHistoryWindow(): BrowserWindow | null {
  return historyWindow;
}

export function isTrustedAppWindow(webContents: WebContents, senderUrl: string): boolean {
  return isTrustedWindow(
    [
      mainWindow,
      settingsWindow,
      historyWindow,
      aboutWindowController.getWindow(),
      ...providerSettingsWindowController.getWindows(),
    ],
    webContents,
    senderUrl,
  );
}

export function showProviderSettingsWindow(providerId: string, title: string): void {
  providerSettingsWindowController.show(providerId, () => {
    const providerSettingsUrl = new URL(getAppUrl('provider-settings.html'));
    providerSettingsUrl.searchParams.set('providerId', providerId);
    const providerWindow = new BrowserWindow({
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
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        navigateOnDragDrop: false,
      },
      icon: getAppIconPath(),
    });
    providerWindow.setMenuBarVisibility(false);
    applyNavigationGuards(providerWindow);
    void providerWindow.loadURL(providerSettingsUrl.toString());
    return providerWindow;
  });
}

export function closeProviderSettingsWindow(webContents: WebContents): boolean {
  return providerSettingsWindowController.closeForWebContents(webContents);
}

export function setQuitting(value: boolean): void {
  isQuitting = value;
}

export function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function applyNavigationGuards(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event, url) => {
    let allowed: boolean;
    try {
      const parsed = new URL(url);
      allowed = parsed.protocol === 'app:' && parsed.host === 'gpt-voice';
    } catch {
      allowed = false;
    }

    if (!allowed) {
      log.warn('Blocked navigation to:', url);
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') {
        void shell.openExternal(parsed.toString());
      }
    } catch {
      log.warn('Blocked malformed external URL:', url);
    }
    return { action: 'deny' };
  });
}

export function showSettingsWindow(): void {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const appIconPath = getAppIconPath();
  const options: BrowserWindowConstructorOptions = {
    width: 760,
    height: 720,
    minWidth: 440,
    minHeight: 520,
    autoHideMenuBar: true,
    backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
    show: true,
    title: 'Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
    icon: appIconPath,
  };

  settingsWindow = new BrowserWindow(options);
  settingsWindow.setMenuBarVisibility(false);
  applyNavigationGuards(settingsWindow);
  void settingsWindow.loadURL(getAppUrl('settings.html'));

  settingsWindow.on('close', (event) => {
    if (isQuitting || isSettingsWindowCloseConfirmed) {
      return;
    }

    // The renderer owns dirty-state confirmation for both native and in-app close requests.
    event.preventDefault();
    settingsWindow?.webContents.send('app-settings-close-requested');
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    isSettingsWindowCloseConfirmed = false;
  });
}

export function closeSettingsWindow(): void {
  if (!settingsWindow) {
    return;
  }

  isSettingsWindowCloseConfirmed = true;
  settingsWindow.close();
}

const aboutWindowController = createAboutWindowController(() => {
  const aboutWindow = new BrowserWindow({
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
    icon: getAppIconPath(),
  });
  aboutWindow.setMenuBarVisibility(false);
  applyNavigationGuards(aboutWindow);
  void aboutWindow.loadURL(getAppUrl('about.html'));
  return aboutWindow;
});

export function showAboutWindow(): void {
  aboutWindowController.show();
}

export function closeAboutWindow(): void {
  aboutWindowController.close();
}

export function showHistoryWindow(): void {
  if (historyWindow) {
    if (historyWindow.isMinimized()) {
      historyWindow.restore();
    }
    historyWindow.show();
    historyWindow.focus();
    return;
  }

  const appIconPath = getAppIconPath();
  const options: BrowserWindowConstructorOptions = {
    width: 760,
    height: 720,
    minWidth: 520,
    minHeight: 420,
    autoHideMenuBar: true,
    backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
    show: true,
    title: 'History',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
    icon: appIconPath,
  };

  historyWindow = new BrowserWindow(options);
  historyWindow.setMenuBarVisibility(false);
  applyNavigationGuards(historyWindow);
  void historyWindow.loadURL(getAppUrl('history.html'));

  historyWindow.on('closed', () => {
    historyWindow = null;
  });
}

export function createWindow(): void {
  const appIcon = getAppIcon();
  const appIconPath = getAppIconPath();

  if (appIcon.isEmpty()) {
    log.warn('App icon could not be loaded:', appIconPath);
  } else {
    log.debug('App icon loaded:', appIconPath, appIcon.getSize());
  }

  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_CONTENT_WIDTH,
    height: MAIN_WINDOW_CONTENT_HEIGHT,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: INITIAL_WINDOW_BACKGROUND_COLOR,
    fullscreenable: false,
    maximizable: false,
    resizable: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
    icon: appIconPath,
  });

  const applyWindowIcon = (): void => {
    if (!mainWindow || process.platform === 'darwin') {
      return;
    }

    mainWindow.setIcon(appIconPath);

    if (!appIcon.isEmpty()) {
      mainWindow.setIcon(appIcon);
    }
  };

  applyWindowIcon();
  mainWindow.once('ready-to-show', applyWindowIcon);
  mainWindow.webContents.once('did-finish-load', applyWindowIcon);

  mainWindow.setMenuBarVisibility(false);
  void mainWindow.loadURL(getAppUrl());
  applyNavigationGuards(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}
