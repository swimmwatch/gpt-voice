import { app, globalShortcut, session } from 'electron';
import log from './logger';
import {
  consumePendingTranslationSettingsRepairNotice,
  currentProvider,
  getCurrentLocale,
  hasExplicitLocalePreference,
  loadConfig,
} from './config';
import {
  ensureBackgroundBrowser,
  getActiveProvider,
  initBackgroundBrowser,
  isBgReady,
  shutdownBackgroundBrowser,
} from './browser';
import { createWindow, getMainWindow, setQuitting, showMainWindow } from './window';
import { createTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { registerIpcHandlers, teardownStreamingTranscriptionIpcHandlers } from './ipc';
import { getSupportedLocales, setLocale, t } from './i18n';
import { configureCloakBrowserRuntime } from './cloakbrowser';
import { getAppIconPath } from './assets';
import {
  refreshLinuxDesktopIcons,
  registerLinuxAppImageDesktopIntegration,
  removeLinuxAppImageDesktopIntegration,
} from './linuxDesktopIntegration';
import { registerAppProtocol, registerAppProtocolScheme } from './appProtocol';
import { configureAppIdentity, configureNativeAppMetadata } from './appMetadata';
import { unloadLoadedOllamaPrettifyModel } from './services/prettifyProviders';
import { shutdownAllTranslationProviders } from './services/translation';
import { resolveStartupLocale } from './startupLocale';
import { showSystemNotification, writeClipboardText } from './electronRuntime';
import { presentPendingTranslationSettingsRepairNotice } from './translationSettings';
import { DiagnosticCaptureStorage } from './services/diagnosticCaptureStorage';
import { AppDatabaseCoordinator } from './repositories/sqlite/appDatabase';
import { SqliteDiagnosticCaptureRepository } from './repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from './repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { createTranscriptionService } from './services/transcription';
import { createMainStreamingTranscriptionService } from './services/streamingTranscription';
import { createTranscriptionResultCache } from './services/transcriptionResultCache';

const CHROMIUM_FATAL_LOG_LEVEL = '3';
const STARTUP_BENCHMARK_READY_MARKER = 'GPT_VOICE_STARTUP_READY';
const STARTUP_BENCHMARK_POLL_INTERVAL_MS = 25;
let quitCleanupComplete = false;
let quitCleanupPromise: Promise<void> | null = null;

const appDatabase = new AppDatabaseCoordinator();
const transcriptionHistoryRepository = new SqliteTranscriptionHistoryRepository(appDatabase);
const diagnosticCaptureRepository = new SqliteDiagnosticCaptureRepository(appDatabase);
const diagnosticCaptureStorage = new DiagnosticCaptureStorage(diagnosticCaptureRepository);
const transcriptionCompletionDependencies = {
  cache: createTranscriptionResultCache(),
  historyRepository: transcriptionHistoryRepository,
  writeClipboardText,
};
const transcribeAudio = createTranscriptionService({
  ...transcriptionCompletionDependencies,
  ensureBackgroundBrowser: () => ensureBackgroundBrowser(),
  getActiveProvider,
  getRequestedAt: () => new Date().toISOString(),
  isBackgroundReady: isBgReady,
});
const streamingTranscriptionService = createMainStreamingTranscriptionService(transcriptionCompletionDependencies);

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

  loadConfig();
  setLocale(resolveStartupLocale(getCurrentLocale(), hasExplicitLocalePreference(), getSupportedLocales()));
  presentPendingTranslationSettingsRepairNotice({
    consume: consumePendingTranslationSettingsRepairNotice,
    notify: showSystemNotification,
    translate: t,
  });

  void diagnosticCaptureStorage
    .pruneOnStartup()
    .then(() => {
      registerIpcHandlers({
        historyRepository: transcriptionHistoryRepository,
        streamingTranscriptionService,
        transcribeAudio,
      });
      createWindow();

      if (isStartupBenchmark) {
        waitForStartupBenchmarkReady();
        return null;
      }

      createTray();
      registerShortcuts();
      return initBackgroundBrowser();
    })
    .then((status) => {
      if (!status) return;
      const providerId = status.providerId || currentProvider;
      if (status.ready) {
        getMainWindow()?.webContents.send('bg-browser-ready', providerId);
      } else if (status.error) {
        getMainWindow()?.webContents.send('bg-browser-error', providerId, status.error, Boolean(status.authExpired));
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
  try {
    await teardownStreamingTranscriptionIpcHandlers();
  } catch {
    log.warn('Streaming transcription cleanup incomplete during quit');
  }
  try {
    await unloadLoadedOllamaPrettifyModel();
  } catch {
    log.warn('Failed to unload Ollama prettify model during quit');
  }
  try {
    const translationShutdown = await shutdownAllTranslationProviders();
    if (!translationShutdown.success) {
      log.warn('Translation provider cleanup incomplete during quit:', {
        failedProviderIds: translationShutdown.failedProviderIds,
      });
    }
  } catch {
    log.warn('Translation provider cleanup failed during quit');
  }
  try {
    await shutdownBackgroundBrowser();
  } catch {
    log.warn('Background browser cleanup incomplete during quit');
  }
  const storageShutdown = await diagnosticCaptureStorage.shutdown();
  if (storageShutdown.status === 'failure') {
    log.warn('Application database cleanup incomplete during quit:', {
      causeCode: storageShutdown.causeCode,
    });
  }
  try {
    appDatabase.close();
  } catch {
    log.warn('Application database cleanup incomplete during quit');
  }
}

app.on('will-quit', (event) => {
  if (quitCleanupComplete) return;

  event.preventDefault();
  void (quitCleanupPromise ??= runQuitCleanup()
    .catch(() => {
      log.warn('Quit cleanup failed');
    })
    .finally(() => {
      quitCleanupComplete = true;
      app.quit();
    }));
});

app.on('before-quit', () => {
  setQuitting(true);
});
