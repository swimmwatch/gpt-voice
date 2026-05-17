import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { createLogger } from './logger';
import { getAppIcon, getAppIconPath } from './assets';
import { getAppUrl } from './appProtocol';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
const log = createLogger('window');

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
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

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false;
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

  // Prevent new window creation; open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
