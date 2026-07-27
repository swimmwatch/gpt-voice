import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  protocol,
  safeStorage,
  session,
  shell,
  Tray,
} from 'electron';
import { resolveAppConfigPaths } from './config';
import type { CloakBrowserApi } from './cloakbrowser';
import { getAppIcon, getAppIconPath, getAssetPath } from './assets';
import { getAppUrl } from './appProtocol';
import { syncLinuxDesktopIcons } from './linuxDesktopIcons';
import { resolveCodexCliOutputSchemaPath } from './services/prettifyCodexCli';
import { writeTextFileAtomically } from './translationSettings';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';
import { runTextAutomationAction } from './services/textAutomation';
import { createCloakBrowserTranslationContextOptions } from './cloakBrowserLaunchOptions';
import { createClaudeWebPageTransport } from './providers/claudeWebPageTransport';
import { inspectClaudeWebReadiness } from './providers/ClaudeWebVoiceProvider';
import { createPlaywrightGoogleTranslatePageAdapter } from './translateProviders/GoogleTranslateProvider';
import { createPlaywrightBingTranslatePageAdapter } from './translateProviders/BingTranslateProvider';
import { createPlaywrightYandexTranslatePageAdapter } from './translateProviders/YandexTranslateProvider';

const loadRuntimeModule = createRequire(__filename);
// CloakBrowser is ESM while the Electron main bundle is CommonJS.
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- the importer is injected into the graph-owned loader.
const importCloakBrowserModule = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<CloakBrowserApi>;

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
  cloakBrowserRuntime: {
    environment: process.env,
    fileSystem: fs,
    importModule: importCloakBrowserModule,
    isPackaged: app.isPackaged,
    platform: process.platform,
    resourcesPath: process.resourcesPath,
  },
  cloakBrowserSettings: {
    fileSystem: fs,
  },
  config: {
    fileSystem: fs,
    generateFingerprintSeed,
    paths: appConfigPaths,
    writeFileAtomically: (filePath, contents) =>
      writeTextFileAtomically(filePath, contents, {
        createTemporaryPath: (target) => `${target}.${randomUUID()}.tmp`,
        fileSystem: fs,
      }),
  },
  electronRuntime: {
    loadModule: () => ({
      clipboard,
      Notification,
      safeStorage,
      shell,
    }),
    platform: process.platform,
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  },
  getMonotonicTimeMs,
  getRequestedAt,
  ipc: {
    ipc: {
      handle: (channel, listener) => ipcMain.handle(channel, listener),
      removeHandler: (channel) => ipcMain.removeHandler(channel),
    },
    platform: process.platform,
  },
  logger: {
    loadModule: () => {
      const moduleValue: unknown = loadRuntimeModule('electron-log/main');
      return moduleValue;
    },
  },
  now: getCurrentDate,
  randomUUID,
  reportStreamingDiagnostic: ignoreStreamingDiagnostic,
  resolveStreamingCapability: resolveStreamingVoiceProviderCapability,
  prettify: {
    audit: {
      elapsedNow: Date.now,
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
      getCacheContext: () => [],
      platform: process.platform,
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
    settingsStorage: {
      fileSystem: fs,
    },
  },
  translation: {
    audit: {
      elapsedNow: Date.now,
      now: getCurrentDate,
      randomUUID,
    },
    now: Date.now,
    providers: {
      createBingPageAdapter: createPlaywrightBingTranslatePageAdapter,
      createContextOptions: createCloakBrowserTranslationContextOptions,
      createGooglePageAdapter: createPlaywrightGoogleTranslatePageAdapter,
      createYandexPageAdapter: createPlaywrightYandexTranslatePageAdapter,
      sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
    selectedText: {
      automateTextAction: async (action) => {
        await runTextAutomationAction(action);
      },
      platform: process.platform,
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    },
  },
  voice: {
    audit: {
      elapsedNow: Date.now,
      now: getCurrentDate,
      randomUUID,
    },
    browser: {},
    providers: {
      chatGPT: {
        now: Date.now,
        reloadPage: async (page, timeoutMs) => {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
        },
        sessionStore: {
          fileSystem: fs,
          now: Date.now,
        },
      },
      claudeWeb: {
        createTransport: createClaudeWebPageTransport,
        inspectReadiness: inspectClaudeWebReadiness,
        now: Date.now,
        waitForReadinessRetry: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
      },
      openAIApi: {
        fetch,
      },
    },
  },
}).createApplication({
  app,
  desktopControllers: {
    appProtocol: {
      appIconPath: getAppIconPath(),
      appRoot: path.resolve(__dirname),
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
      platform: process.platform,
      spawn: (command, args, options) => spawn(command, [...args], options),
      syncDesktopIcons: syncLinuxDesktopIcons,
    },
    shortcuts: {
      globalShortcut,
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
      platform: process.platform,
      preloadPath: path.join(__dirname, 'preload.js'),
    },
  },
});

application.bootstrap();
