/* eslint-disable max-classes-per-file -- application and IPC fakes own independent test state. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { BrowserWindow, IpcMainInvokeEvent, Menu, NativeImage, Tray } from 'electron';
import type { BrowserContext } from 'playwright-core';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Tests exercise the Node 24 SQLite implementation.
import { DatabaseSync } from 'node:sqlite';
import {
  MainProcessCompositionRoot,
  type MainProcessApplicationEnvironment,
  type MainProcessCompositionEnvironment,
} from '@main/di/mainProcessCompositionRoot';
import { resolveAppConfigPaths } from '@main/config';
import type { MainIpcTransport } from '@main/ipc';
import { type MainProcessElectronApplication, type MainProcessPreventableEvent } from '@main/mainProcessApplication';
import { writeTextFileAtomically } from '@main/translationSettings';
import { createPlaywrightBingTranslatePageAdapter } from '@main/translateProviders/BingTranslateProvider';
import { createPlaywrightGoogleTranslatePageAdapter } from '@main/translateProviders/GoogleTranslateProvider';
import { createPlaywrightYandexTranslatePageAdapter } from '@main/translateProviders/YandexTranslateProvider';
import { TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS } from '@shared/translationProvider';
import { PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS } from '@shared/prettifyProfileChooser';
import { PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS } from '@shared/prettifyProfilePortability';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

class RecordingElectronApplication implements MainProcessElectronApplication {
  public readonly commandLine = {
    appendSwitch: () => undefined,
  };
  public readonly isPackaged = false;
  public quitCount = 0;
  public ready = false;
  private readonly listeners = new Map<string, unknown>();

  public isReady(): boolean {
    return this.ready;
  }

  public disableHardwareAcceleration(): void {}

  public getVersion(): string {
    return '1.0.0';
  }

  public requestSingleInstanceLock(): boolean {
    return true;
  }

  public setAboutPanelOptions(): void {}

  public setAppUserModelId(): void {}

  public setName(): void {}

  public showAboutPanel(): void {}

  public on(
    event: 'activate' | 'before-quit' | 'ready' | 'second-instance' | 'window-all-closed',
    listener: () => void,
  ): void;
  public on(event: 'will-quit', listener: (event: MainProcessPreventableEvent) => void): void;
  public on(event: string, listener: unknown): void {
    this.listeners.set(event, listener);
  }

  public quit(): void {
    this.quitCount += 1;
  }

  public emitReady(): void {
    this.ready = true;
    const listener = this.listeners.get('ready') as (() => void) | undefined;
    listener?.();
  }

  public emitWillQuit(event: MainProcessPreventableEvent): void {
    const listener = this.listeners.get('will-quit') as
      ((preventableEvent: MainProcessPreventableEvent) => void) | undefined;
    listener?.(event);
  }
}

class TestDesktopWindow {
  public readonly sentMessages: unknown[][] = [];
  public readonly webContents = {
    executeJavaScript: async () => true,
    getURL: () => 'app://gpt-voice/index.html',
    id: 1,
    isDestroyed: () => false,
    on: () => undefined,
    once: () => undefined,
    send: (...args: unknown[]) => {
      this.sentMessages.push(args);
    },
    setWindowOpenHandler: () => undefined,
  };

  public close(): void {}
  public focus(): void {}
  public hide(): void {}
  public isDestroyed(): boolean {
    return false;
  }
  public isMinimized(): boolean {
    return false;
  }
  public isVisible(): boolean {
    return true;
  }
  public async loadURL(): Promise<void> {}
  public on(): void {}
  public once(): void {}
  public restore(): void {}
  public setIcon(): void {}
  public setMenuBarVisibility(): void {}
  public show(): void {}
}

class TestNativeImage {
  public getSize(): { readonly height: number; readonly width: number } {
    return { height: 22, width: 22 };
  }
  public isEmpty(): boolean {
    return false;
  }
  public resize(): this {
    return this;
  }
  public setTemplateImage(): void {}
}

class TestTray {
  public destroy(): void {}
  public isDestroyed(): boolean {
    return false;
  }
  public on(): void {}
  public setContextMenu(): void {}
  public setImage(): void {}
  public setToolTip(): void {}
}

type MainIpcListener = Parameters<MainIpcTransport['handle']>[1];

interface CompositionHarnessState {
  closeCount: number;
  createCount: number;
  readonly ipcHandlers: Map<string, MainIpcListener>;
  readonly removedIpcChannels: string[];
  readonly prettifyAuditRecords: string[];
  readonly translationAuditRecords: string[];
  window: TestDesktopWindow | null;
}

class MainProcessCompositionHarness {
  public readonly app = new RecordingElectronApplication();
  public readonly state: CompositionHarnessState = {
    closeCount: 0,
    createCount: 0,
    ipcHandlers: new Map(),
    removedIpcChannels: [],
    prettifyAuditRecords: [],
    translationAuditRecords: [],
    window: null,
  };
  public readonly temporaryDirectory: string;
  public readonly databasePath: string;
  public readonly compositionEnvironment: MainProcessCompositionEnvironment;
  public readonly applicationEnvironment: MainProcessApplicationEnvironment;

  public constructor(isRemovingLinuxDesktopIntegration = false) {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-main-composition-'));
    const configPaths = resolveAppConfigPaths({
      environment: { XDG_CONFIG_HOME: this.temporaryDirectory },
      homeDirectory: () => this.temporaryDirectory,
      platform: 'linux',
    });
    this.databasePath = configPaths.databaseFile;
    this.compositionEnvironment = {
      assetPaths: {
        isPackaged: false,
        mainDirectory: this.temporaryDirectory,
        resourcesPath: this.temporaryDirectory,
      },
      cacheNow: () => 0,
      cloakBrowserRuntime: {
        environment: {},
        fileSystem: fs,
        importModule: async () => ({
          launchContext: async () => ({ close: async () => undefined }) as BrowserContext,
          launchPersistentContext: async () => ({ close: async () => undefined }) as BrowserContext,
        }),
        isPackaged: false,
        platform: 'linux',
        resourcesPath: this.temporaryDirectory,
      },
      cloakBrowserSettings: {
        fileSystem: fs,
      },
      config: {
        fileSystem: fs,
        generateFingerprintSeed: () => '12345',
        paths: configPaths,
        writeFileAtomically: (filePath, contents) =>
          writeTextFileAtomically(filePath, contents, {
            createTemporaryPath: (target) => `${target}.tmp`,
            fileSystem: fs,
          }),
      },
      databaseDependencies: {
        closeDatabase: (database) => {
          this.state.closeCount += 1;
          database.close();
        },
        createDatabase: (databasePath) => {
          this.state.createCount += 1;
          return new DatabaseSync(databasePath);
        },
        fileExists: fs.existsSync,
        now: () => new Date('2026-07-27T12:00:00.000Z'),
        platform: 'win32',
        setFileMode: fs.chmodSync,
      },
      diagnosticsArchive: {
        architecture: 'x64',
        fileSystem: {
          chmod: (filePath, mode) => fs.promises.chmod(filePath, mode),
          createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
          readFile: (filePath) => fs.promises.readFile(filePath),
          removeFile: (filePath) => fs.promises.rm(filePath, { force: true }),
          rename: (sourcePath, destinationPath) => fs.promises.rename(sourcePath, destinationPath),
        },
        getAppVersion: () => '1.0.0',
        hash: (payload) => createHash('sha256').update(payload).digest('hex'),
        platform: 'linux',
        runtimeVersions: {
          cloakBrowser: '0.4.12',
          electron: '39.0.0',
          node: '24.0.0',
          playwright: '1.61.1',
        },
      },
      diagnosticsExport: {
        dialog: {
          showSaveDialog: async () => ({ canceled: true, filePath: '' }),
        },
        fileSystem: {
          pathExists: async () => false,
        },
        platform: 'linux',
        randomBytes: () => Buffer.from([0x01, 0x02, 0x03, 0x04]),
      },
      prettifyProfilePortability: {
        dialog: {
          showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
          showSaveDialog: async () => ({ canceled: true, filePath: '' }),
        },
        fileSystem: {
          pathExists: async () => false,
          readFileBounded: async () => new Uint8Array(),
          writeFileAtomically: async () => undefined,
        },
      },
      electronRuntime: {
        loadModule: () => ({
          clipboard: {
            readText: () => '',
            writeText: () => undefined,
          },
          safeStorage: {
            decryptString: (value) => value.toString('utf8'),
            encryptString: (value) => Buffer.from(value, 'utf8'),
            isEncryptionAvailable: () => true,
          },
          shell: {
            beep: () => undefined,
            openExternal: async () => undefined,
          },
        }),
        platform: 'linux',
        schedule: () => undefined,
      },
      getMonotonicTimeMs: () => 0,
      getRequestedAt: () => '2026-07-27T12:00:00.000Z',
      initialProviderReadiness: {
        clock: {
          clearTimeout: () => undefined,
          now: () => 0,
          setTimeout: () => 0,
        },
        createAbortController: () => new AbortController(),
      },
      ipc: {
        ipc: {
          handle: (channel, listener) => {
            this.state.ipcHandlers.set(channel, listener);
          },
          removeHandler: (channel) => {
            this.state.removedIpcChannels.push(channel);
            this.state.ipcHandlers.delete(channel);
          },
        },
        platform: 'linux',
      },
      logger: {
        fileSystem: fs,
        loadModule: () => {
          const recordAudit = (_label: unknown, serialized: unknown): void => {
            if (typeof serialized !== 'string') return;
            const record = JSON.parse(serialized) as { family?: string };
            if (record.family === 'prettify') this.state.prettifyAuditRecords.push(serialized);
            if (record.family === 'translation') this.state.translationAuditRecords.push(serialized);
          };
          const scopedLogger = {
            debug: () => undefined,
            error: recordAudit,
            info: recordAudit,
            warn: recordAudit,
          };
          return {
            ...scopedLogger,
            errorHandler: { startCatching: () => undefined },
            initialize: () => undefined,
            scope: () => scopedLogger,
            transports: {
              console: { level: '' },
              file: {
                getFile: () => ({ path: path.join(this.temporaryDirectory, 'main.log') }),
                level: '',
              },
            },
          };
        },
      },
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      randomUUID: () => '00000000-0000-4000-8000-000000000001',
      reportStreamingDiagnostic: () => undefined,
      resolveStreamingCapability: () => null,
      textAutomation: {
        environment: {},
        platform: 'linux',
        runner: async () => undefined,
      },
      prettify: {
        audit: {
          elapsedNow: () => 0,
          now: () => new Date('2026-07-27T12:00:00.000Z'),
          randomUUID: () => '00000000-0000-4000-8000-000000000004',
        },
        cliRunner: {
          clock: {
            clearTimeout: () => undefined,
            now: () => 0,
            setTimeout: () => 0,
          },
          environment: {},
          fileSystem: {
            access: async () => undefined,
            mkdtemp: async () => this.temporaryDirectory,
            removeDirectory: async () => undefined,
            stat: async () => ({ isFile: () => true }),
          },
          getTemporaryDirectory: () => this.temporaryDirectory,
          killProcessGroup: () => undefined,
          platform: 'linux',
          spawn: () => {
            throw new Error('unexpected Prettify process');
          },
        },
        codexCli: {
          outputSchemaPathResolver: () => '/app/prettify/codex-output.schema.json',
          schemaFileSystem: {
            access: async () => undefined,
            readFile: async () => new Uint8Array(),
            stat: async () => ({ isFile: () => true }),
          },
        },
        fetch: async () => ({ status: 200, text: async () => '{}' }),
        httpReadiness: {
          clock: {
            clearTimeout: () => undefined,
            now: () => 0,
            setTimeout: () => 0,
          },
          createAbortController: () => new AbortController(),
        },
        settingsStorage: {
          fileSystem: fs,
        },
        selectedText: {
          getCacheContext: () => [],
          platform: 'linux',
          wait: async () => undefined,
        },
      },
      translation: {
        audit: {
          elapsedNow: () => 0,
          now: () => new Date('2026-07-27T12:00:00.000Z'),
          randomUUID: () => '00000000-0000-4000-8000-000000000003',
        },
        now: () => 0,
        providers: {
          createBingPageAdapter: createPlaywrightBingTranslatePageAdapter,
          createContextOptions: () => ({ headless: true }),
          createGooglePageAdapter: createPlaywrightGoogleTranslatePageAdapter,
          createYandexPageAdapter: createPlaywrightYandexTranslatePageAdapter,
          sleep: async () => undefined,
        },
        selectedText: {
          platform: 'linux',
          wait: async () => undefined,
        },
      },
      voice: {
        audit: {
          elapsedNow: () => 0,
          now: () => new Date('2026-07-27T12:00:00.000Z'),
          randomUUID: () => '00000000-0000-4000-8000-000000000002',
        },
        browser: {},
        providers: {
          chatGPT: {
            now: () => 0,
            reloadPage: async () => undefined,
            sessionStore: {
              fileSystem: fs,
              now: () => 0,
            },
          },
          claudeWeb: {
            createTransport: () => {
              throw new Error('unexpected Claude transport');
            },
            inspectReadiness: async () => ({
              authentication: 'unavailable',
              featureAvailable: false,
              organizationEvidence: {
                activeOrganizationCandidates: [],
                eligibleOrganizations: [],
              },
            }),
            now: () => 0,
            waitForReadinessRetry: async () => undefined,
          },
          openAIApi: {
            fetch: async () => ({ status: 200, text: async () => '' }),
          },
        },
      },
    };
    this.applicationEnvironment = {
      app: this.app,
      desktopControllers: {
        appProtocol: {
          protocol: {
            handle: () => undefined,
            registerSchemesAsPrivileged: () => undefined,
            unhandle: () => undefined,
          },
          readFile: async () => Buffer.alloc(0),
        },
        desktopRuntime: {
          app: this.app,
          arguments: isRemovingLinuxDesktopIntegration ? ['--remove-linux-appimage-desktop-integration'] : [],
          buildMenu: () => ({}) as Menu,
          electronVersion: '39.0.0',
          environment: {},
          exit: () => undefined,
          platform: 'linux',
          schedule: () => undefined,
          session: {
            defaultSession: {
              setPermissionCheckHandler: () => undefined,
              setPermissionRequestHandler: () => undefined,
            },
          },
          setApplicationMenu: () => undefined,
          writeStandardOutput: () => undefined,
        },
        linuxDesktopIntegration: {
          app: this.app,
          environment: {},
          fileSystem: {
            copyFileSync: () => undefined,
            mkdirSync: () => undefined,
            rmSync: () => undefined,
            writeFileSync: () => undefined,
          },
          homeDirectory: () => '/home/test',
          platform: 'win32',
          spawn: () => ({
            once: () => undefined,
            unref: () => undefined,
          }),
        },
        prettifyProfileChooser: {
          preloadPath: '/app/prettify-profile-chooser-preload.js',
          screen: {
            getAllDisplays: () => [
              {
                bounds: { height: 800, width: 1000, x: 0, y: 0 },
                workArea: { height: 800, width: 1000, x: 0, y: 0 },
              } as never,
            ],
            getCursorScreenPoint: () => ({ x: 0, y: 0 }),
            getDisplayNearestPoint: () => ({ workArea: { height: 800, width: 1000, x: 0, y: 0 } }) as never,
            getPrimaryDisplay: () => ({ workArea: { height: 800, width: 1000, x: 0, y: 0 } }) as never,
          },
        },
        shortcuts: {
          globalShortcut: {
            register: () => true,
            unregister: () => undefined,
            unregisterAll: () => undefined,
          },
          platform: 'linux',
        },
        tray: {
          application: this.app,
          buildMenu: () => ({}) as Menu,
          createNativeImage: () => new TestNativeImage() as unknown as NativeImage,
          createTray: () => new TestTray() as unknown as Tray,
          platform: 'linux',
        },
        window: {
          createBrowserWindow: () => {
            const window = new TestDesktopWindow();
            this.state.window = window;
            return window as unknown as BrowserWindow;
          },
          getAppUrl: () => 'app://gpt-voice/index.html',
          platform: 'linux',
          preloadPath: '/app/preload.js',
        },
      },
    };
  }

  public cleanup(): void {
    fs.rmSync(this.temporaryDirectory, { force: true, recursive: true });
  }
}

const harnesses: MainProcessCompositionHarness[] = [];

afterEach(() => {
  for (const harness of harnesses) harness.cleanup();
  harnesses.length = 0;
});

function createHarness(isRemovingLinuxDesktopIntegration = false): MainProcessCompositionHarness {
  const harness = new MainProcessCompositionHarness(isRemovingLinuxDesktopIntegration);
  harnesses.push(harness);
  return harness;
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('main process composition root', () => {
  it('removes the Task 07 globals and default construction seams', () => {
    const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/main.ts'), 'utf8');
    const ipc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');
    const diagnosticStorage = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/diagnosticCaptureStorage.ts'),
      'utf8',
    );
    const diagnosticRedactor = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/diagnosticTextRedactor.ts'),
      'utf8',
    );
    const transcription = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/transcription.ts'), 'utf8');
    const streaming = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/streamingTranscription.ts'), 'utf8');
    const windowManager = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/window.ts'), 'utf8');
    const trayController = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/tray.ts'), 'utf8');
    const shortcutController = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/shortcuts.ts'), 'utf8');

    assert.doesNotMatch(
      main,
      /\b(?:const|let)\s+(?:appDatabase|transcriptionHistoryRepository|diagnosticCaptureRepository|diagnosticCaptureStorage|transcriptionService|streamingTranscriptionService|quitCleanupComplete|quitCleanupPromise)\b/u,
    );
    assert.doesNotMatch(ipc, /\blet\s+streamingTranscriptionIpcController\b/u);
    assert.match(ipc, /export class MainIpcController/u);
    assert.match(ipc, /this\.trustedIpc\.handle\('transcribe-audio'/u);
    assert.match(ipc, /if \(this\.disposalPromise\) return this\.disposalPromise;/u);
    assert.match(ipc, /for \(const channel of this\.channels\) this\.ipc\.removeHandler\(channel\);/u);
    assert.doesNotMatch(ipc, /\bexport function registerIpcHandlers\b|\bipcMain\b/u);
    assert.doesNotMatch(diagnosticStorage, /DEFAULT_DEPENDENCIES|Partial<DiagnosticCaptureStorageDependencies>/u);
    assert.doesNotMatch(diagnosticRedactor, /export const diagnosticTextRedactor/u);
    assert.doesNotMatch(
      transcription,
      /\bcreateTranscriptionService\b|\bimport\s*\{\s*voiceProviderAudit\b|\baudit\?:/u,
    );
    assert.match(transcription, /export class TranscriptionService/u);
    assert.doesNotMatch(streaming, /\bcreateMainStreamingTranscriptionService\b|\bimport\s*\{\s*voiceProviderAudit\b/u);
    assert.match(windowManager, /export class WindowManager/u);
    assert.match(trayController, /export class TrayController/u);
    assert.match(shortcutController, /export class ShortcutController/u);
    assert.doesNotMatch(windowManager, /^let\s+/mu);
    assert.doesNotMatch(trayController, /^let\s+/mu);
    assert.doesNotMatch(shortcutController, /^let\s+/mu);
  });

  it('removes migrated Voice and browser singleton construction seams', () => {
    const browser = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/browser.ts'), 'utf8');
    const providerIndex = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/providers/index.ts'), 'utf8');
    const providerAudit = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/providers/voiceProviderAudit.ts'), 'utf8');
    const providerFactory = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/providers/voiceProviderFactory.ts'),
      'utf8',
    );
    const providerRegistry = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/providers/voiceProviderRegistry.ts'),
      'utf8',
    );

    assert.equal(fs.existsSync(path.join(PROJECT_ROOT, 'src/main/backgroundBrowserLifecycle.ts')), false);
    assert.match(browser, /export class BackgroundBrowserService/u);
    assert.match(providerFactory, /export class VoiceProviderFactory/u);
    assert.match(providerRegistry, /export class VoiceProviderRegistry/u);
    assert.doesNotMatch(browser, /^let\s+/mu);
    assert.doesNotMatch(providerIndex, /\bproviderRegistry\b|\bcreateProvider\(|\bgetAvailableProviders\(/u);
    assert.doesNotMatch(providerAudit, /\bexport const voiceProviderAudit\b/u);
    assert.doesNotMatch(providerFactory, /\bDEFAULT_DEPENDENCIES\b|\bdefaultVoiceProviderFactory\b/u);
    assert.doesNotMatch(providerRegistry, /\bdefaultVoiceProviderRegistry\b/u);
  });

  it('removes migrated Translation singleton and default construction seams', () => {
    const runtime = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/translation.ts'), 'utf8');
    const selectedText = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/selectedTextTranslation.ts'),
      'utf8',
    );
    const providerAudit = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/translateProviders/translationProviderAudit.ts'),
      'utf8',
    );
    const providerBase = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/translateProviders/BaseTranslateProvider.ts'),
      'utf8',
    );
    const providerFactory = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/translateProviders/translationProviderFactory.ts'),
      'utf8',
    );
    const providerRegistry = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/translateProviders/index.ts'), 'utf8');

    assert.match(runtime, /export class TranslationRuntime/u);
    assert.match(selectedText, /export class SelectedTextTranslationService/u);
    assert.match(providerFactory, /export class TranslationProviderFactory/u);
    assert.match(providerRegistry, /export class TranslationProviderRegistry/u);
    assert.doesNotMatch(
      runtime,
      /\bexport (?:const|function) (?:translationRuntime|getTranslationExecutionSnapshot|isTranslationExecutionCurrent|validateTranslationInput|translateWithSnapshot|translateText|shutdownAllTranslationProviders)\b/u,
    );
    assert.doesNotMatch(
      selectedText,
      /\bcreateSelectedTextTranslationService\b|\bexport const translateSelectedTextToClipboard\b/u,
    );
    assert.doesNotMatch(providerAudit, /\bexport const translationProviderAudit\b/u);
    assert.doesNotMatch(
      providerRegistry,
      /\bDEFAULT_REGISTRY_DEPENDENCIES\b|\bTRANSLATION_PROVIDER_DEFINITIONS\b|\btranslationProviderRegistry\b/u,
    );
    assert.doesNotMatch(providerBase, /\bDEFAULT_DEPENDENCIES\b|launchCloakContext|Date\.now|setTimeout/u);
  });

  it('removes migrated Prettify singleton and default construction seams', () => {
    const runtime = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/prettifyProviders.ts'), 'utf8');
    const selectedText = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/selectedTextPrettify.ts'), 'utf8');
    const actionGate = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/selectedTextActionState.ts'), 'utf8');
    const providerAudit = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/prettifyProviderAudit.ts'),
      'utf8',
    );
    const oneShotExecution = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/prettifyOneShotExecution.ts'),
      'utf8',
    );
    const claudeCliAdapter = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/prettifyClaudeCli.ts'), 'utf8');
    const codexCliAdapter = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/prettifyCodexCli.ts'), 'utf8');
    const cliProviders = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/services/prettifyCliProviders.ts'), 'utf8');
    const ipc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');

    assert.match(runtime, /export class PrettifyProviderFactory/u);
    assert.match(runtime, /export class PrettifyProviderRegistry/u);
    assert.match(runtime, /export class PrettifyRuntime/u);
    assert.match(selectedText, /export class SelectedTextPrettifyService/u);
    assert.match(actionGate, /export class SelectedTextActionGate/u);
    assert.match(oneShotExecution, /export class OneShotPrettifyExecution/u);
    assert.doesNotMatch(
      runtime,
      /\bKNOWN_PRETTIFY_PROVIDERS\b|\bDEFAULT_PRETTIFY_PROVIDER_DEPENDENCIES\b|\bexport (?:async )?function (?:checkPrettifyCliConnection|listPrettifyModels|loadPrettifyModel|preparePrettifyExecution|runPrettify|unloadLoadedOllamaPrettifyModel|unloadPrettifyModel)\b/u,
    );
    assert.doesNotMatch(providerAudit, /\bexport const prettifyProviderAudit\b/u);
    assert.doesNotMatch(claudeCliAdapter, /\breadonly audit\?:|\?\? new PrettifyProviderAudit/u);
    assert.doesNotMatch(codexCliAdapter, /\breadonly audit\?:|\?\? new PrettifyProviderAudit/u);
    assert.doesNotMatch(cliProviders, /\bdefault(?:Claude|Codex)CliAdapter\b/u);
    assert.doesNotMatch(
      selectedText,
      /\bcreateSelectedTextPrettifyService\b|\bexport const (?:prettifySelectedText|cancelSelectedTextPrettify)\b/u,
    );
    assert.doesNotMatch(
      actionGate,
      /\bcreateSelectedTextActionGate\b|\bdefaultSelectedTextActionGate\b|\bselectedTextActionGate\b/u,
    );
    assert.doesNotMatch(ipc, /\bprettifyCliConnectionChecks\b|\bprettifyProviderAudit\b/u);
  });

  it('removes migrated config, localization, and settings-storage singleton seams', () => {
    const config = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/config.ts'), 'utf8');
    const localization = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/i18n/index.ts'), 'utf8');
    const cloakBrowserSettings = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/cloakBrowserSettings.ts'), 'utf8');
    const prettifySettings = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/services/prettifySettingsStorage.ts'),
      'utf8',
    );

    assert.match(config, /export class AppConfigStore/u);
    assert.doesNotMatch(config, /\bexport let\b|\bloadConfig\b|\bsaveConfig\b/u);
    assert.match(localization, /export class I18nService/u);
    assert.doesNotMatch(
      localization,
      /\blet currentLocale\b|\bexport function (?:getAllTranslations|getLocale|getSupportedLocales|setLocale|t)\b/u,
    );
    assert.match(cloakBrowserSettings, /export class CloakBrowserSettingsRepository/u);
    assert.doesNotMatch(
      cloakBrowserSettings,
      /\bexport function (?:getCloakBrowserSettingsView|getCloakBrowserSettingsWithSecret|prepareCloakBrowserSettings|saveCloakBrowserSettings)\b/u,
    );
    assert.match(prettifySettings, /export class PrettifySettingsStorage/u);
    assert.doesNotMatch(
      prettifySettings,
      /\bexport function (?:getPrettifySettings|getPrettifySettingsWithSecret|savePrettifySettings)\b/u,
    );
  });

  it('removes runtime-adapter caches and compatibility function seams', () => {
    const compositionRoot = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/di/mainProcessCompositionRoot.ts'),
      'utf8',
    );
    const logger = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/logger.ts'), 'utf8');
    const electronRuntime = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/electronRuntime.ts'), 'utf8');
    const cloakBrowserRuntime = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/cloakbrowser.ts'), 'utf8');
    const config = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/config.ts'), 'utf8');
    const openAIApiSettings = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/providers/openaiApiSettings.ts'),
      'utf8',
    );
    const claudeWebSettings = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/main/providers/claudeWebSettings.ts'),
      'utf8',
    );
    const claudeWebSession = fs.readFileSync(path.join(PROJECT_ROOT, 'src/main/providers/claudeWebSession.ts'), 'utf8');

    assert.match(compositionRoot, /new LoggerFactory|new ElectronRuntimeLoader|new CloakBrowserRuntimeLoader/u);
    assert.match(logger, /export class LoggerFactory/u);
    assert.doesNotMatch(logger, /\blet electronLog\b|\bexport function createLogger\b|\bexport default\b/u);
    assert.match(electronRuntime, /export class ElectronRuntimeLoader/u);
    assert.doesNotMatch(
      electronRuntime,
      /\blet electronRuntime\b|\bexport function (?:decryptSafeStorageString|encryptSafeStorageString|isSafeStorageEncryptionAvailable|readClipboardText|showSystemNotification|writeClipboardText|writeTypedClipboardText)\b/u,
    );
    assert.match(cloakBrowserRuntime, /export class CloakBrowserRuntimeLoader/u);
    assert.doesNotMatch(
      cloakBrowserRuntime,
      /\blet cloakBrowserPromise\b|\bexport (?:async )?function (?:configureCloakBrowserRuntime|launchCloakContext|launchCloakPersistentContext)\b/u,
    );
    assert.doesNotMatch(config, /\bAPP_DIR\b/u);
    assert.match(openAIApiSettings, /export class OpenAIApiSettingsRepository/u);
    assert.doesNotMatch(
      openAIApiSettings,
      /\bexport function (?:clearOpenAIApiKey|getOpenAIApiSettings|getOpenAIApiSettingsView|getOpenAIApiSettingsWithSecret|saveOpenAIApiSettings)\b/u,
    );
    assert.match(claudeWebSettings, /export class ClaudeWebSettingsRepository/u);
    assert.match(claudeWebSession, /export class ClaudeWebSessionRepository/u);
  });

  it('defers database and service construction until normal application startup', async () => {
    const harness = createHarness();
    const application = new MainProcessCompositionRoot(harness.compositionEnvironment).createApplication(
      harness.applicationEnvironment,
    );
    application.bootstrap();

    assert.equal(harness.state.createCount, 0);
    assert.equal(harness.state.ipcHandlers.size, 0);

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.state.createCount, 1);
    assert.equal(harness.state.ipcHandlers.size > 0, true);
    for (const channel of Object.values(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS)) {
      if (channel !== PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged) {
        assert.equal(harness.state.ipcHandlers.has(channel), true);
      }
    }
    for (const channel of Object.values(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS)) {
      assert.equal(harness.state.ipcHandlers.has(channel), true);
    }

    harness.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();
    assert.equal(harness.state.ipcHandlers.size, 0);
    assert.equal(harness.state.closeCount, 1);
  });

  it('keeps the single Translation connection subscription across repeated real CloakBrowser save handlers', async () => {
    const harness = createHarness();
    new MainProcessCompositionRoot(harness.compositionEnvironment)
      .createApplication(harness.applicationEnvironment)
      .bootstrap();
    harness.app.emitReady();
    await flushAsyncWork();

    const saveHandler = harness.state.ipcHandlers.get('save-cloakbrowser-settings');
    assert.ok(saveHandler);
    assert.ok(harness.state.window);
    const event = {
      sender: harness.state.window.webContents,
      senderFrame: { url: harness.state.window.webContents.getURL() },
    } as unknown as IpcMainInvokeEvent;
    const countConnectionMessages = (): number =>
      harness.state.window?.sentMessages.filter(
        ([channel]) => channel === TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed,
      ).length ?? 0;
    const initialMessageCount = countConnectionMessages();

    const first = await saveHandler(event, { backgroundMode: 'hidden' });
    const firstMessageCount = countConnectionMessages();
    const second = await saveHandler(event, { backgroundMode: 'visible' });
    const secondMessageCount = countConnectionMessages();

    assert.equal((first as { success?: boolean }).success, true);
    assert.equal((second as { success?: boolean }).success, true);
    assert.equal(firstMessageCount - initialMessageCount, 2);
    assert.equal(secondMessageCount - firstMessageCount, 2);
  });

  it('keeps independently composed repositories, services, IPC, and shutdown state isolated', async () => {
    const first = createHarness();
    const second = createHarness();
    new MainProcessCompositionRoot(first.compositionEnvironment)
      .createApplication(first.applicationEnvironment)
      .bootstrap();
    new MainProcessCompositionRoot(second.compositionEnvironment)
      .createApplication(second.applicationEnvironment)
      .bootstrap();

    first.app.emitReady();
    second.app.emitReady();
    await flushAsyncWork();

    assert.notEqual(first.state.ipcHandlers, second.state.ipcHandlers);
    assert.equal(first.state.ipcHandlers.size, second.state.ipcHandlers.size);
    const secondStartupAuditRecordCount = second.state.translationAuditRecords.length;
    const translateHandler = first.state.ipcHandlers.get('translate-text');
    assert.ok(translateHandler);
    assert.ok(first.state.window);
    await translateHandler(
      {
        sender: first.state.window.webContents,
        senderFrame: { url: first.state.window.webContents.getURL() },
      } as unknown as IpcMainInvokeEvent,
      'private-source-canary',
      'ru',
    );
    assert.equal(first.state.translationAuditRecords.length > 0, true);
    assert.equal(second.state.translationAuditRecords.length, secondStartupAuditRecordCount);
    assert.equal(first.state.translationAuditRecords.join('').includes('private-source-canary'), false);

    first.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();

    assert.equal(first.state.ipcHandlers.size, 0);
    assert.equal(first.state.closeCount, 1);
    assert.equal(second.state.ipcHandlers.size > 0, true);
    assert.equal(second.state.closeCount, 0);

    second.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();
    assert.equal(second.state.ipcHandlers.size, 0);
    assert.equal(second.state.closeCount, 1);
  });

  it('does not create or open the graph for the Linux integration-removal mode', async () => {
    const harness = createHarness(true);
    new MainProcessCompositionRoot(harness.compositionEnvironment)
      .createApplication(harness.applicationEnvironment)
      .bootstrap();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.state.createCount, 0);
    assert.equal(harness.state.ipcHandlers.size, 0);
    assert.equal(harness.app.quitCount, 1);
  });
});
