import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  session,
  shell,
  Tray,
} from 'electron';
import log, { createLogger } from './logger';
import { resolveAppConfigPaths } from './config';
import { configureCloakBrowserRuntime, launchCloakContext, launchCloakPersistentContext } from './cloakbrowser';
import { getAppIcon, getAppIconPath, getAssetPath } from './assets';
import { getAppUrl } from './appProtocol';
import { syncLinuxDesktopIcons } from './linuxDesktopIcons';
import { resolveCodexCliOutputSchemaPath } from './services/prettifyCodexCli';
import {
  decryptSafeStorageString,
  encryptSafeStorageString,
  isSafeStorageEncryptionAvailable,
  readClipboardText,
  showSystemNotification,
  writeClipboardText,
  writeTypedClipboardText,
} from './electronRuntime';
import { writeTextFileAtomically } from './translationSettings';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';
import { runTextAutomationAction } from './services/textAutomation';
import {
  createCloakBrowserLoginContextOptions,
  createCloakBrowserPersistentContextOptions,
  createCloakBrowserTranslationContextOptions,
} from './cloakBrowserLaunchOptions';
import {
  clearOpenAIApiKey,
  getOpenAIApiSettingsView,
  getOpenAIApiSettingsWithSecret,
  saveOpenAIApiSettings,
} from './providers/openaiApiSettings';
import {
  clearClaudeWebSession,
  getPlaywrightStorageState,
  readClaudeWebSession,
  resolveClaudeWebOrganization,
  saveClaudeWebSession,
} from './providers/claudeWebSession';
import { getClaudeWebSettings, saveClaudeWebSettings } from './providers/claudeWebSettings';
import { createClaudeWebPageTransport } from './providers/claudeWebPageTransport';
import { inspectClaudeWebReadiness } from './providers/ClaudeWebVoiceProvider';
import { createPlaywrightGoogleTranslatePageAdapter } from './translateProviders/GoogleTranslateProvider';
import { createPlaywrightBingTranslatePageAdapter } from './translateProviders/BingTranslateProvider';
import { createPlaywrightYandexTranslatePageAdapter } from './translateProviders/YandexTranslateProvider';

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

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90_000) + 10_000);
}

const appConfigPaths = resolveAppConfigPaths({
  environment: process.env,
  homeDirectory: os.homedir,
  platform: process.platform,
});

const application = new MainProcessCompositionRoot({
  cacheNow: Date.now,
  cloakBrowserSettings: {
    fileSystem: fs,
    logger: createLogger('cloakbrowser-settings'),
    secureStorage: {
      decrypt: decryptSafeStorageString,
      encrypt: encryptSafeStorageString,
      isEncryptionAvailable: isSafeStorageEncryptionAvailable,
    },
  },
  config: {
    fileSystem: fs,
    generateFingerprintSeed,
    logger: createLogger('config'),
    paths: appConfigPaths,
    writeFileAtomically: (filePath, contents) =>
      writeTextFileAtomically(filePath, contents, {
        createTemporaryPath: (target) => `${target}.${randomUUID()}.tmp`,
        fileSystem: fs,
      }),
  },
  diagnosticLogger: createLogger('diagnostic-capture'),
  getMonotonicTimeMs,
  getRequestedAt,
  historyLogger: createLogger('ipc'),
  ipc: {
    ipc: {
      handle: (channel, listener) => ipcMain.handle(channel, listener),
      removeHandler: (channel) => ipcMain.removeHandler(channel),
    },
    logger: createLogger('ipc'),
    notification: {
      show: showSystemNotification,
    },
    platform: process.platform,
    voiceSettings: {
      clearOpenAIApiKey,
      getClaudeWebSettings,
      getOpenAIApiSettingsView,
      saveClaudeWebSettings,
      saveOpenAIApiSettings,
    },
  },
  now: getCurrentDate,
  randomUUID,
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
    selectedText: {
      automateTextAction: async (action) => {
        await runTextAutomationAction(action);
      },
      clipboard: {
        readText: readClipboardText,
        writeText: writeTypedClipboardText,
      },
      getCacheContext: () => [],
      logger: createLogger('selection-prettify'),
      notify: showSystemNotification,
      platform: process.platform,
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
    settingsStorage: {
      fileSystem: fs,
      logger: createLogger('prettify-settings'),
      secureStorage: {
        decrypt: decryptSafeStorageString,
        encrypt: encryptSafeStorageString,
        isEncryptionAvailable: isSafeStorageEncryptionAvailable,
      },
    },
  },
  translation: {
    audit: {
      elapsedNow: Date.now,
      getSink: () => createLogger('provider-audit'),
      now: getCurrentDate,
      randomUUID,
    },
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
        launchCloakPersistentContext(
          createCloakBrowserPersistentContextOptions(settings, appConfigPaths.browserCacheDirectory),
        ),
      createLoginContext: (settings) => launchCloakContext(createCloakBrowserLoginContextOptions(settings)),
      logger: createLogger('browser'),
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
          sessionFile: appConfigPaths.chatGPTSessionFile,
          tokenFile: appConfigPaths.chatGPTTokenFile,
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
  logger: log,
});

application.bootstrap();
