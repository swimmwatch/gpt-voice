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
  APP_DIR,
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
  getTranslationSettingsSnapshot,
  hasExplicitLocalePreference,
  loadConfig,
  setProvider,
} from './config';
import { registerIpcHandlers } from './ipc';
import { getSupportedLocales, setLocale, t } from './i18n';
import { configureCloakBrowserRuntime, launchCloakContext, launchCloakPersistentContext } from './cloakbrowser';
import { getAppIcon, getAppIconPath, getAssetPath } from './assets';
import { getAppUrl } from './appProtocol';
import { syncLinuxDesktopIcons } from './linuxDesktopIcons';
import { getPrettifySettingsView, getPrettifySettingsWithSecret } from './services/prettifySettingsStorage';
import { resolveCodexCliOutputSchemaPath } from './services/prettifyCodexCli';
import { resolveStartupLocale } from './startupLocale';
import {
  readClipboardText,
  showSystemNotification,
  writeClipboardText,
  writeTypedClipboardText,
} from './electronRuntime';
import { presentPendingTranslationSettingsRepairNotice } from './translationSettings';
import { APP_DATABASE_FILE } from './repositories/sqlite/appDatabase';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';
import { runTextAutomationAction } from './services/textAutomation';
import {
  createCloakBrowserLoginContextOptions,
  createCloakBrowserPersistentContextOptions,
  createCloakBrowserTranslationContextOptions,
} from './cloakBrowserLaunchOptions';
import { presentNotificationError } from '@shared/notifications';
import { getOpenAIApiSettingsWithSecret } from './providers/openaiApiSettings';
import {
  clearClaudeWebSession,
  getPlaywrightStorageState,
  readClaudeWebSession,
  resolveClaudeWebOrganization,
  saveClaudeWebSession,
} from './providers/claudeWebSession';
import { getClaudeWebSettings } from './providers/claudeWebSettings';
import { createClaudeWebPageTransport } from './providers/claudeWebPageTransport';
import { inspectClaudeWebReadiness } from './providers/ClaudeWebVoiceProvider';
import { createPlaywrightGoogleTranslatePageAdapter } from './translateProviders/GoogleTranslateProvider';
import { createPlaywrightBingTranslatePageAdapter } from './translateProviders/BingTranslateProvider';
import { createPlaywrightYandexTranslatePageAdapter } from './translateProviders/YandexTranslateProvider';

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
  getMonotonicTimeMs,
  getRequestedAt,
  historyLogger: createLogger('ipc'),
  now: getCurrentDate,
  randomUUID,
  registerIpcHandlers,
  reportStreamingDiagnostic: ignoreStreamingDiagnostic,
  resolveStreamingCapability: resolveStreamingVoiceProviderCapability,
  prettify: {
    audit: {
      elapsedNow: Date.now,
      getSink: () => createLogger('provider-audit'),
      now: getCurrentDate,
      randomUUID,
    },
    cliRunner: {
      clock: {
        clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
        now: Date.now,
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      },
      environment: process.env,
      fileSystem: {
        access: (filePath, mode) => fs.promises.access(filePath, mode),
        mkdtemp: (prefix) => fs.promises.mkdtemp(prefix),
        removeDirectory: (directory) => fs.promises.rm(directory, { force: true, recursive: true }),
        stat: (filePath) => fs.promises.stat(filePath),
      },
      getTemporaryDirectory: os.tmpdir,
      platform: process.platform,
      spawn: (executable, args, options) => spawn(executable, args, options),
    },
    codexCli: {
      outputSchemaPathResolver: () =>
        resolveCodexCliOutputSchemaPath({
          isPackaged: app.isPackaged,
          mainDirectory: __dirname,
          resourcesPath: process.resourcesPath,
        }),
      schemaFileSystem: {
        access: (filePath, mode) => fs.promises.access(filePath, mode),
        readFile: (filePath) => fs.promises.readFile(filePath),
        stat: (filePath) => fs.promises.stat(filePath),
      },
    },
    fetch,
    getSettingsWithSecret: getPrettifySettingsWithSecret,
    selectedText: {
      automateTextAction: async (action) => {
        await runTextAutomationAction(action);
      },
      clipboard: {
        readText: readClipboardText,
        writeText: writeTypedClipboardText,
      },
      getCacheContext: () => [],
      getPrettifySettings: getPrettifySettingsView,
      logger: createLogger('selection-prettify'),
      notify: showSystemNotification,
      platform: process.platform,
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
  },
  translation: {
    audit: {
      elapsedNow: Date.now,
      getSink: () => createLogger('provider-audit'),
      now: getCurrentDate,
      randomUUID,
    },
    getSettings: getTranslationSettingsSnapshot,
    now: Date.now,
    providers: {
      createBingPageAdapter: createPlaywrightBingTranslatePageAdapter,
      createContext: launchCloakContext,
      createContextOptions: createCloakBrowserTranslationContextOptions,
      createGooglePageAdapter: createPlaywrightGoogleTranslatePageAdapter,
      createYandexPageAdapter: createPlaywrightYandexTranslatePageAdapter,
      sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
    selectedText: {
      automateTextAction: async (action) => {
        await runTextAutomationAction(action);
      },
      clipboard: {
        readText: readClipboardText,
        writeText: writeTypedClipboardText,
      },
      logger: createLogger('selection-translate'),
      notify: showSystemNotification,
      platform: process.platform,
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
  },
  voice: {
    audit: {
      elapsedNow: Date.now,
      getSink: () => createLogger('provider-audit'),
      now: getCurrentDate,
      randomUUID,
    },
    browser: {
      createBackgroundContext: (settings) =>
        launchCloakPersistentContext(createCloakBrowserPersistentContextOptions(settings)),
      createLoginContext: () => launchCloakContext(createCloakBrowserLoginContextOptions()),
      getCurrentProviderId: () => currentProvider,
      getNotAuthenticatedError: () => t('error.noAccessToken'),
      logger: createLogger('browser'),
      presentError: (error) => presentNotificationError(error, { context: 'generic', t }).userMessage,
      setCurrentProviderId: setProvider,
    },
    providers: {
      chatGPT: {
        logger: createLogger('chatgpt-provider'),
        now: Date.now,
        reloadPage: async (page, timeoutMs) => {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
        },
        sessionStore: {
          fileSystem: fs,
          logger: createLogger('chatgpt-provider'),
          now: Date.now,
          sessionFile: path.join(APP_DIR, 'chatgpt-session.json'),
          tokenFile: path.join(APP_DIR, 'access-token.json'),
        },
        writeClipboardText,
      },
      claudeWeb: {
        clearSession: clearClaudeWebSession,
        createTransport: createClaudeWebPageTransport,
        getSettings: getClaudeWebSettings,
        getStorageState: getPlaywrightStorageState,
        inspectReadiness: inspectClaudeWebReadiness,
        navigationLogger: createLogger('claude-web-provider'),
        now: Date.now,
        readSession: readClaudeWebSession,
        resolveOrganization: resolveClaudeWebOrganization,
        saveSession: saveClaudeWebSession,
        waitForReadinessRetry: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
        writeClipboardText,
      },
      openAIApi: {
        fetch,
        getSettings: getOpenAIApiSettingsWithSecret,
        writeClipboardText,
      },
    },
  },
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
  initializeLocale,
  loadConfig,
  logger: log,
  presentTranslationSettingsRepairNotice,
});

application.bootstrap();
