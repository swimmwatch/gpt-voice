import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- SQLite is required by the project's Node 24 runtime.
import { DatabaseSync } from 'node:sqlite';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
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
import { getAppUrl } from './appProtocol';
import { resolveCodexCliOutputSchemaPath } from './services/prettifyCodexCli';
import { writeTextFileAtomically } from './translationSettings';
import { resolveStreamingVoiceProviderCapability } from './providers/streamingVoiceProviderCapability';
import { MainProcessCompositionRoot } from './di/mainProcessCompositionRoot';
import { createCloakBrowserTranslationContextOptions } from './cloakBrowserLaunchOptions';
import { createClaudeWebPageTransport } from './providers/claudeWebPageTransport';
import { inspectClaudeWebReadiness } from './providers/ClaudeWebVoiceProvider';
import { createPlaywrightGoogleTranslatePageAdapter } from './translateProviders/GoogleTranslateProvider';
import { createPlaywrightBingTranslatePageAdapter } from './translateProviders/BingTranslateProvider';
import { createPlaywrightYandexTranslatePageAdapter } from './translateProviders/YandexTranslateProvider';
import { APP_DATABASE_TIMEOUT_MS } from './repositories/sqlite/appDatabase';

const loadRuntimeModule = createRequire(__filename);
const CLOAK_BROWSER_PACKAGE_NAME = 'cloakbrowser';
const PLAYWRIGHT_PACKAGE_NAME = 'playwright-core';
const UNKNOWN_RUNTIME_VERSION = 'unknown';
const MAX_PACKAGE_DIRECTORY_ASCENTS = 6;
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

function getInstalledPackageVersion(packageName: string): string {
  try {
    let currentDirectory = path.dirname(loadRuntimeModule.resolve(packageName));
    for (let index = 0; index < MAX_PACKAGE_DIRECTORY_ASCENTS; index += 1) {
      const packageFile = path.join(currentDirectory, 'package.json');
      if (fs.existsSync(packageFile)) {
        const parsed: unknown = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          (parsed as Record<string, unknown>).name === packageName &&
          typeof (parsed as Record<string, unknown>).version === 'string'
        ) {
          return (parsed as Record<string, string>).version;
        }
      }
      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) break;
      currentDirectory = parentDirectory;
    }
  } catch {
    // The manifest uses a fixed safe marker when package metadata is unavailable.
  }
  return UNKNOWN_RUNTIME_VERSION;
}

function hashDiagnosticsPayload(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

async function diagnosticsExportPathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function runTextAutomationCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('Text automation command failed'));
        return;
      }
      resolve();
    });
  });
}

/**
 * Constructs and starts the process-owned application graph.
 */
function bootstrapMainProcess(): void {
  const appConfigPaths = resolveAppConfigPaths({
    environment: process.env,
    homeDirectory: os.homedir,
    platform: process.platform,
  });

  const application = new MainProcessCompositionRoot({
    assetPaths: {
      isPackaged: app.isPackaged,
      mainDirectory: __dirname,
      resourcesPath: process.resourcesPath,
    },
    cacheNow: Date.now,
    databaseDependencies: {
      closeDatabase: (database) => database.close(),
      createDatabase: (databasePath) => new DatabaseSync(databasePath, { timeout: APP_DATABASE_TIMEOUT_MS }),
      fileExists: fs.existsSync,
      now: getCurrentDate,
      platform: process.platform,
      setFileMode: fs.chmodSync,
    },
    diagnosticsArchive: {
      architecture: process.arch,
      fileSystem: {
        chmod: (filePath, mode) => fs.promises.chmod(filePath, mode),
        createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
        readFile: (filePath) => fs.promises.readFile(filePath),
        removeFile: (filePath) => fs.promises.rm(filePath, { force: true }),
        rename: (sourcePath, destinationPath) => fs.promises.rename(sourcePath, destinationPath),
      },
      getAppVersion: () => app.getVersion(),
      hash: hashDiagnosticsPayload,
      platform: process.platform,
      runtimeVersions: {
        cloakBrowser: getInstalledPackageVersion(CLOAK_BROWSER_PACKAGE_NAME),
        electron: process.versions.electron ?? UNKNOWN_RUNTIME_VERSION,
        node: process.versions.node,
        playwright: getInstalledPackageVersion(PLAYWRIGHT_PACKAGE_NAME),
      },
    },
    diagnosticsExport: {
      dialog: {
        showSaveDialog: (parentWindow, options) => dialog.showSaveDialog(parentWindow, options),
      },
      fileSystem: {
        pathExists: diagnosticsExportPathExists,
      },
      platform: process.platform,
      randomBytes,
    },
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
    initialProviderReadiness: {
      clock: {
        clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
        now: Date.now,
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      },
      createAbortController: () => new AbortController(),
    },
    ipc: {
      ipc: {
        handle: (channel, listener) => ipcMain.handle(channel, listener),
        removeHandler: (channel) => ipcMain.removeHandler(channel),
      },
      platform: process.platform,
    },
    logger: {
      fileSystem: fs,
      loadModule: () => {
        const moduleValue: unknown = loadRuntimeModule('electron-log/main');
        return moduleValue;
      },
    },
    now: getCurrentDate,
    randomUUID,
    reportStreamingDiagnostic: ignoreStreamingDiagnostic,
    resolveStreamingCapability: resolveStreamingVoiceProviderCapability,
    textAutomation: {
      environment: process.env,
      platform: process.platform,
      runner: runTextAutomationCommand,
    },
    prettify: {
      audit: {
        elapsedNow: Date.now,
        now: getCurrentDate,
        randomUUID,
      },
      httpReadiness: {
        clock: {
          clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
          now: Date.now,
          setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        },
        createAbortController: () => new AbortController(),
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
        killProcessGroup: (processId, signal) => process.kill(processId, signal),
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
        homeDirectory: os.homedir,
        platform: process.platform,
        spawn: (command, args, options) => spawn(command, [...args], options),
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
        platform: process.platform,
      },
      window: {
        createBrowserWindow: (options) => new BrowserWindow(options),
        getAppUrl,
        platform: process.platform,
        preloadPath: path.join(__dirname, 'preload.js'),
      },
    },
  });

  application.bootstrap();
}

bootstrapMainProcess();
