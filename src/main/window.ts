import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { createLogger } from './logger';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
const log = createLogger('window');

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setQuitting(value: boolean): void {
  isQuitting = value;
}

export function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      log.warn('Blocked navigation to:', url);
      event.preventDefault();
    }
  });

  // Prevent new window creation; open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
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
