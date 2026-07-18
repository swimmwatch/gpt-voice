import { app, globalShortcut, session } from 'electron';
import log from './logger';
import { loadConfig, getCurrentLocale } from './config';
import { initBackgroundBrowser, shutdownBackgroundBrowser } from './browser';
import { createWindow, getMainWindow, setQuitting, showMainWindow } from './window';
import { createTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { registerIpcHandlers, teardownStreamingTranscriptionIpcHandlers } from './ipc';
import { setLocale, getSupportedLocales } from './i18n';
import { configureCloakBrowserRuntime } from './cloakbrowser';
import { getAppIconPath } from './assets';
import {
  refreshLinuxDesktopIcons,
  registerLinuxAppImageDesktopIntegration,
  removeLinuxAppImageDesktopIntegration,
} from './linuxDesktopIntegration';
import { registerAppProtocol, registerAppProtocolScheme } from './appProtocol';
import { configureAppIdentity, configureNativeAppMetadata } from './appMetadata';
import { closeTranscriptionHistoryStore } from './services/transcriptionHistoryStorage';
import { unloadLoadedOllamaPrettifyModel } from './services/prettifyProviders';

const CHROMIUM_FATAL_LOG_LEVEL = '3';
const STARTUP_BENCHMARK_READY_MARKER = 'GPT_VOICE_STARTUP_READY';
const STARTUP_BENCHMARK_POLL_INTERVAL_MS = 25;
let quitCleanupComplete = false;
let quitCleanupPromise: Promise<void> | null = null;

configureAppIdentity();
app.disableHardwareAcceleration();
registerAppProtocolScheme();

const isStartupBenchmark = process.argv.includes('--startup-benchmark');

const isRemovingLinuxAppImageDesktopIntegration =
  process.platform === 'linux' && process.argv.includes('--remove-linux-appimage-desktop-integration');

if (!isRemovingLinuxAppImageDesktopIntegration && !app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (app.isReady()) {
    showMainWindow();
  }
});

function waitForStartupBenchmarkReady(): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  const checkWindowStartupState = async (): Promise<void> => {
    if (mainWindow.isDestroyed()) {
      return;
    }

    try {
      const isReady: unknown = await mainWindow.webContents.executeJavaScript(
        "document.body?.dataset.windowStartup === 'ready'",
        true,
      );
      if (isReady === true) {
        process.stdout.write(`${STARTUP_BENCHMARK_READY_MARKER}\n`);
        app.quit();
        return;
      }
    } catch {
      // The renderer can briefly be unavailable while its document is being replaced.
    }

    setTimeout(() => {
      void checkWindowStartupState();
    }, STARTUP_BENCHMARK_POLL_INTERVAL_MS);
  };

  void checkWindowStartupState();
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'gpt-voice');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  // Chromium can print non-actionable X11 clipboard atom cache messages as ERROR.
  // Keep native Chromium stderr quiet while preserving app logs and fatal Chromium logs.
  app.commandLine.appendSwitch('log-level', CHROMIUM_FATAL_LOG_LEVEL);
}

if (app.isPackaged && process.platform === 'linux' && process.env.APPIMAGE) {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
  app.commandLine.appendSwitch('no-sandbox');
}

app.on('ready', () => {
  log.initialize();
  log.errorHandler.startCatching();

  if (isRemovingLinuxAppImageDesktopIntegration) {
    removeLinuxAppImageDesktopIntegration();
    app.quit();
    return;
  }

  if (!isStartupBenchmark) {
    configureCloakBrowserRuntime();
    configureNativeAppMetadata();
    refreshLinuxDesktopIcons();
    registerLinuxAppImageDesktopIntegration();
  }
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

  registerIpcHandlers();
  createWindow();

  if (isStartupBenchmark) {
    waitForStartupBenchmarkReady();
    return;
  }

  createTray();
  registerShortcuts();

  void initBackgroundBrowser().then((status) => {
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
  showMainWindow();
});

async function runQuitCleanup(): Promise<void> {
  globalShortcut.unregisterAll();
  await teardownStreamingTranscriptionIpcHandlers();
  try {
    await unloadLoadedOllamaPrettifyModel();
  } catch (error: unknown) {
    log.warn('Failed to unload Ollama prettify model during quit:', error instanceof Error ? error.message : error);
  }
  closeTranscriptionHistoryStore();
  await shutdownBackgroundBrowser();
}

app.on('will-quit', (event) => {
  if (quitCleanupComplete) return;

  event.preventDefault();
  void (quitCleanupPromise ??= runQuitCleanup()
    .catch((error: unknown) => {
      log.warn('Quit cleanup failed:', error instanceof Error ? error.message : error);
    })
    .finally(() => {
      quitCleanupComplete = true;
      app.quit();
    }));
});

app.on('before-quit', () => {
  setQuitting(true);
});
