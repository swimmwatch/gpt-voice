import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { app, BrowserWindow, globalShortcut, Menu, nativeImage, protocol, session, shell, Tray } from 'electron';
import log, { createLogger } from './logger';
import {
  consumePendingTranslationSettingsRepairNotice,
  currentCancelHotkey,
  currentHotkey,
  currentPrettifyEnabled,
  currentPrettifyHotkey,
  currentProvider,
  currentRetryTranscriptionHotkey,
  currentStopHotkey,
  currentTranslateEnabled,
  currentTranslateHotkey,
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
import { registerIpcHandlers } from './ipc';
import { getSupportedLocales, setLocale, t } from './i18n';
import { configureCloakBrowserRuntime } from './cloakbrowser';
import { getAppIcon, getAppIconPath, getAssetPath } from './assets';
import { getAppUrl } from './appProtocol';
import { syncLinuxDesktopIcons } from './linuxDesktopIcons';
import { unloadLoadedOllamaPrettifyModel } from './services/prettifyProviders';
import { shutdownAllTranslationProviders } from './services/translation';
import { resolveStartupLocale } from './startupLocale';
import { showSystemNotification, writeClipboardText } from './electronRuntime';
import { presentPendingTranslationSettingsRepairNotice } from './translationSettings';
import { APP_DATABASE_FILE } from './repositories/sqlite/appDatabase';
import { voiceProviderAudit } from './providers';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';
import { getActiveSelectedTextAction } from './services/selectedTextActionState';
import { cancelSelectedTextPrettify, prettifySelectedText } from './services/selectedTextPrettify';
import { translateSelectedTextToClipboard } from './services/selectedTextTranslation';

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

const application = new MainProcessCompositionRoot({
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
}).createApplication({
  app,
  configureCloakBrowserRuntime,
  desktopControllers: {
    appProtocol: {
      appIconPath: getAppIconPath(),
      appRoot: path.resolve(__dirname),
      logger: createLogger('app-protocol'),
      protocol,
      readFile,
    },
    desktopRuntime: {
      app,
      arguments: process.argv,
      buildMenu: (template) => Menu.buildFromTemplate(template),
      electronVersion: process.versions.electron,
      environment: process.env,
      exit: (code) => process.exit(code),
      getAppIconPath,
      openExternal: (url) => shell.openExternal(url),
      platform: process.platform,
      schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      session,
      setApplicationMenu: (menu) => Menu.setApplicationMenu(menu),
      writeStandardOutput: (value) => process.stdout.write(value),
    },
    linuxDesktopIntegration: {
      app,
      environment: process.env,
      fileSystem: fs,
      getAppIconPath,
      getAssetPath,
      homeDirectory: os.homedir,
      logger: createLogger('desktop-integration'),
      platform: process.platform,
      spawn: (command, args, options) => spawn(command, [...args], options),
      syncDesktopIcons: syncLinuxDesktopIcons,
    },
    shortcuts: {
      cancelSelectedTextPrettify,
      getActiveSelectedTextAction,
      getSettings: () => ({
        cancelHotkey: currentCancelHotkey,
        hotkey: currentHotkey,
        prettifyEnabled: currentPrettifyEnabled,
        prettifyHotkey: currentPrettifyHotkey,
        retryTranscriptionHotkey: currentRetryTranscriptionHotkey,
        stopHotkey: currentStopHotkey,
        translateEnabled: currentTranslateEnabled,
        translateHotkey: currentTranslateHotkey,
      }),
      globalShortcut,
      logger: createLogger('shortcuts'),
      platform: process.platform,
      prettifySelectedText,
      translateSelectedTextToClipboard,
    },
    tray: {
      application: app,
      buildMenu: (template) => Menu.buildFromTemplate(template),
      createNativeImage: (iconPath) => nativeImage.createFromPath(iconPath),
      createTray: (icon) => new Tray(icon),
      getAssetPath,
      platform: process.platform,
      translate: t,
    },
    window: {
      createBrowserWindow: (options) => new BrowserWindow(options),
      getAppIcon,
      getAppIconPath,
      getAppUrl,
      logger: createLogger('window'),
      openExternal: (url) => shell.openExternal(url),
      platform: process.platform,
      preloadPath: path.join(__dirname, 'preload.js'),
    },
  },
  getCurrentVoiceProviderId: () => currentProvider,
  initializeBackgroundBrowser: initBackgroundBrowser,
  initializeLocale,
  loadConfig,
  logger: log,
  presentTranslationSettingsRepairNotice,
  shutdownBackgroundBrowser,
  shutdownTranslationProviders: shutdownAllTranslationProviders,
  unloadPrettifyModel: unloadLoadedOllamaPrettifyModel,
});

application.bootstrap();
