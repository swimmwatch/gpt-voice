import { randomUUID } from 'node:crypto';
import { app, globalShortcut, session } from 'electron';
import log, { createLogger } from './logger';
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
import { registerIpcHandlers } from './ipc';
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
import { APP_DATABASE_FILE } from './repositories/sqlite/appDatabase';
import { voiceProviderAudit } from './providers';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';

const CHROMIUM_FATAL_LOG_LEVEL = '3';
const STARTUP_BENCHMARK_READY_MARKER = 'GPT_VOICE_STARTUP_READY';
const STARTUP_BENCHMARK_POLL_INTERVAL_MS = 25;
const STARTUP_BENCHMARK_ARGUMENT = '--startup-benchmark';
const REMOVE_LINUX_DESKTOP_INTEGRATION_ARGUMENT = '--remove-linux-appimage-desktop-integration';

configureAppIdentity();
app.disableHardwareAcceleration();
registerAppProtocolScheme();

const isStartupBenchmark = process.argv.includes(STARTUP_BENCHMARK_ARGUMENT);
const isRemovingLinuxAppImageDesktopIntegration =
  process.platform === 'linux' && process.argv.includes(REMOVE_LINUX_DESKTOP_INTEGRATION_ARGUMENT);

if (!isRemovingLinuxAppImageDesktopIntegration && !app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function waitForStartupBenchmarkReady(): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  const checkWindowStartupState = async (): Promise<void> => {
    if (mainWindow.isDestroyed()) return;

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

function configureDockIcon(): void {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(getAppIconPath());
  }
}

function configureSessionPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });
}

function initializeLocale(): void {
  setLocale(resolveStartupLocale(getCurrentLocale(), hasExplicitLocalePreference(), getSupportedLocales()));
}

function presentTranslationSettingsRepairNotice(): void {
  presentPendingTranslationSettingsRepairNotice({
    consume: consumePendingTranslationSettingsRepairNotice,
    notify: showSystemNotification,
    translate: t,
  });
}

function publishBackgroundStatus(status: {
  readonly authExpired?: boolean;
  readonly error?: string;
  readonly providerId?: string;
  readonly ready: boolean;
}): void {
  const providerId = status.providerId || currentProvider;
  if (status.ready) {
    getMainWindow()?.webContents.send('bg-browser-ready', providerId);
  } else if (status.error) {
    getMainWindow()?.webContents.send('bg-browser-error', providerId, status.error, Boolean(status.authExpired));
  }
}

function getCurrentDate(): Date {
  return new Date();
}

function getRequestedAt(): string {
  return getCurrentDate().toISOString();
}

function getMonotonicTimeMs(): number {
  return performance.now();
}

function ignoreStreamingDiagnostic(): void {
  // Task 08 preserves the existing no-op diagnostic callback.
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

new MainProcessCompositionRoot({
  cacheNow: Date.now,
  databasePath: APP_DATABASE_FILE,
  diagnosticLogger: createLogger('diagnostic-capture'),
  ensureBackgroundBrowser,
  getActiveProvider,
  getMonotonicTimeMs,
  getRequestedAt,
  historyLogger: createLogger('ipc'),
  isBackgroundReady: isBgReady,
  now: getCurrentDate,
  randomUUID,
  registerIpcHandlers,
  reportStreamingDiagnostic: ignoreStreamingDiagnostic,
  resolveStreamingCapability: resolveStreamingVoiceProviderCapability,
  voiceAudit: voiceProviderAudit,
  writeClipboardText,
})
  .createApplication({
    app,
    configureCloakBrowserRuntime,
    configureDockIcon,
    configureNativeAppMetadata,
    configureSessionPermissions,
    createTray,
    createWindow,
    globalShortcuts: globalShortcut,
    initializeBackgroundBrowser: initBackgroundBrowser,
    initializeLocale,
    isRemovingLinuxDesktopIntegration: isRemovingLinuxAppImageDesktopIntegration,
    isStartupBenchmark,
    loadConfig,
    logger: log,
    presentTranslationSettingsRepairNotice,
    publishBackgroundStatus,
    refreshLinuxDesktopIcons,
    registerAppProtocol,
    registerLinuxDesktopIntegration: registerLinuxAppImageDesktopIntegration,
    registerShortcuts,
    removeLinuxDesktopIntegration: removeLinuxAppImageDesktopIntegration,
    setQuitting,
    showMainWindow,
    shutdownBackgroundBrowser,
    shutdownTranslationProviders: shutdownAllTranslationProviders,
    unloadPrettifyModel: unloadLoadedOllamaPrettifyModel,
    waitForStartupBenchmarkReady,
  })
  .register();
