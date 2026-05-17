import { app, globalShortcut, session } from 'electron';
import log from './logger';
import { loadConfig, getCurrentLocale } from './config';
import { initBackgroundBrowser, shutdownBackgroundBrowser } from './browser';
import { createWindow, getMainWindow, setQuitting } from './window';
import { createTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { registerIpcHandlers } from './ipc';
import { setLocale, getSupportedLocales } from './i18n';
import { configureCloakBrowserRuntime } from './cloakbrowser';
import { getAppIconPath } from './assets';
import {
  registerLinuxAppImageDesktopIntegration,
  removeLinuxAppImageDesktopIntegration,
} from './linuxDesktopIntegration';
import { registerAppProtocol, registerAppProtocolScheme } from './appProtocol';

app.setName('GPT-Voice');
app.setAppUserModelId('com.gptvoice.app');
app.disableHardwareAcceleration();
registerAppProtocolScheme();

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'gpt-voice');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

if (app.isPackaged && process.platform === 'linux' && process.env.APPIMAGE) {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
  app.commandLine.appendSwitch('no-sandbox');
}

app.on('ready', () => {
  log.initialize();
  log.errorHandler.startCatching();

  if (process.argv.includes('--remove-linux-appimage-desktop-integration')) {
    removeLinuxAppImageDesktopIntegration();
    app.quit();
    return;
  }

  configureCloakBrowserRuntime();
  registerLinuxAppImageDesktopIntegration();
  registerAppProtocol();

  if (process.platform === 'darwin') {
    app.dock?.setIcon(getAppIconPath());
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });

  // Detect OS locale and set i18n
  const osLocale = app.getLocale().split('-')[0];
  if (getSupportedLocales().includes(osLocale)) {
    setLocale(osLocale);
  }

  loadConfig();

  // Apply persisted locale override if set
  const savedLocale = getCurrentLocale();
  if (savedLocale) {
    setLocale(savedLocale);
  }

  createWindow();
  createTray();
  registerShortcuts();
  registerIpcHandlers();

  initBackgroundBrowser().then((status) => {
    if (status.ready) {
      getMainWindow()?.webContents.send('bg-browser-ready');
    } else if (status.error) {
      getMainWindow()?.webContents.send('bg-browser-error', status.error, Boolean(status.authExpired));
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win === null) {
    createWindow();
  } else {
    win.show();
  }
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  await shutdownBackgroundBrowser();
});

app.on('before-quit', () => {
  setQuitting(true);
});
