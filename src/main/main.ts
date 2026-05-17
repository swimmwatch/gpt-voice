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

app.setName('GPT-Voice');

if (app.isPackaged) {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
  app.commandLine.appendSwitch('no-sandbox');
}

app.on('ready', () => {
  log.initialize();
  log.errorHandler.startCatching();
  configureCloakBrowserRuntime();

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
