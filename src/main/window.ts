import { BrowserWindow, shell, type BrowserWindowConstructorOptions, type WebContents } from 'electron';
import * as path from 'path';
import { createLogger } from './logger';
import { getAppIcon, getAppIconPath } from './assets';
import { getAppUrl } from './appProtocol';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let isQuitting = false;
const log = createLogger('window');

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

export function isTrustedAppWindow(webContents: WebContents, senderUrl: string): boolean {
  const trustedWindows = [mainWindow, settingsWindow].filter((win): win is BrowserWindow => Boolean(win));
  return trustedWindows.some((win) => webContents.id === win.webContents.id && senderUrl === win.webContents.getURL());
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
    width: 520,
    height: 720,
    minWidth: 440,
    minHeight: 520,
    autoHideMenuBar: true,
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
  settingsWindow.loadURL(getAppUrl('settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

export function closeSettingsWindow(): void {
  settingsWindow?.close();
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
    width: 460,
    height: 420,
    minWidth: 400,
    minHeight: 360,
    autoHideMenuBar: true,
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
  mainWindow.loadURL(getAppUrl());
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
