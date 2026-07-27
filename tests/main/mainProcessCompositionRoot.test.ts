/* eslint-disable max-classes-per-file -- application and IPC fakes own independent test state. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { BrowserWindow, Menu, NativeImage, Tray } from 'electron';
import type { BrowserContext } from 'playwright-core';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Tests exercise the Node 24 SQLite implementation.
import { DatabaseSync } from 'node:sqlite';
import {
  MainProcessCompositionRoot,
  type MainProcessApplicationEnvironment,
  type MainProcessCompositionEnvironment,
} from '@main/di/mainProcessCompositionRoot';
import type { MainIpcDependencies } from '@main/ipc';
import {
  type MainProcessElectronApplication,
  type MainProcessIpcRegistration,
  type MainProcessPreventableEvent,
} from '@main/mainProcessApplication';

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
  public readonly webContents = {
    executeJavaScript: async () => true,
    getURL: () => 'app://gpt-voice/index.html',
    id: 1,
    isDestroyed: () => false,
    on: () => undefined,
    once: () => undefined,
    send: () => undefined,
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

class RecordingIpcRegistration implements MainProcessIpcRegistration {
  public disposeCount = 0;

  public async dispose(): Promise<void> {
    this.disposeCount += 1;
  }
}

interface CompositionHarnessState {
  closeCount: number;
  createCount: number;
  readonly ipcDependencies: MainIpcDependencies[];
  readonly ipcRegistrations: RecordingIpcRegistration[];
}

class MainProcessCompositionHarness {
  public readonly app = new RecordingElectronApplication();
  public readonly state: CompositionHarnessState = {
    closeCount: 0,
    createCount: 0,
    ipcDependencies: [],
    ipcRegistrations: [],
  };
  public readonly temporaryDirectory: string;
  public readonly databasePath: string;
  public readonly compositionEnvironment: MainProcessCompositionEnvironment;
  public readonly applicationEnvironment: MainProcessApplicationEnvironment;

  public constructor(isRemovingLinuxDesktopIntegration = false) {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-main-composition-'));
    this.databasePath = path.join(this.temporaryDirectory, 'application.sqlite3');
    this.compositionEnvironment = {
      cacheNow: () => 0,
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
      databasePath: this.databasePath,
      diagnosticLogger: { warn: () => undefined },
      getMonotonicTimeMs: () => 0,
      getRequestedAt: () => '2026-07-27T12:00:00.000Z',
      historyLogger: { warn: () => undefined },
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      randomUUID: () => '00000000-0000-4000-8000-000000000001',
      registerIpcHandlers: (dependencies) => {
        const registration = new RecordingIpcRegistration();
        this.state.ipcDependencies.push(dependencies);
        this.state.ipcRegistrations.push(registration);
        return registration;
      },
      reportStreamingDiagnostic: () => undefined,
      resolveStreamingCapability: () => null,
      voice: {
        audit: {
          elapsedNow: () => 0,
          getSink: () => null,
          now: () => new Date('2026-07-27T12:00:00.000Z'),
          randomUUID: () => '00000000-0000-4000-8000-000000000002',
        },
        browser: {
          createBackgroundContext: async () => ({ close: async () => undefined }) as BrowserContext,
          createLoginContext: async () => ({ close: async () => undefined }) as BrowserContext,
          getCurrentProviderId: () => 'openai-api',
          getNotAuthenticatedError: () => 'not authenticated',
          logger: { info: () => undefined },
          presentError: () => 'provider unavailable',
          setCurrentProviderId: () => undefined,
        },
        providers: {
          chatGPT: {
            logger: { info: () => undefined, warn: () => undefined },
            now: () => 0,
            reloadPage: async () => undefined,
            sessionStore: {
              fileSystem: fs,
              logger: { error: () => undefined, info: () => undefined },
              now: () => 0,
              sessionFile: path.join(this.temporaryDirectory, 'chatgpt-session.json'),
              tokenFile: path.join(this.temporaryDirectory, 'access-token.json'),
            },
            writeClipboardText: () => undefined,
          },
          claudeWeb: {
            clearSession: () => false,
            createTransport: () => {
              throw new Error('unexpected Claude transport');
            },
            getSettings: () => ({ language: 'en-US' }),
            getStorageState: (session) => ({ cookies: session.cookies, origins: session.origins }),
            inspectReadiness: async () => ({
              authentication: 'unavailable',
              featureAvailable: false,
              organizationEvidence: {
                activeOrganizationCandidates: [],
                eligibleOrganizations: [],
              },
            }),
            navigationLogger: { warn: () => undefined },
            now: () => 0,
            readSession: () => ({ status: 'missing' }),
            resolveOrganization: () => ({
              accountScope: 'unknown',
              routing: { status: 'missing' },
            }),
            saveSession: () => undefined,
            waitForReadinessRetry: async () => undefined,
            writeClipboardText: () => undefined,
          },
          openAIApi: {
            fetch: async () => ({ status: 200, text: async () => '' }),
            getSettings: () => ({
              apiKey: '',
              language: 'auto',
              model: 'whisper-1',
              prompt: '',
              temperature: 0,
            }),
            writeClipboardText: () => undefined,
          },
        },
      },
      writeClipboardText: () => undefined,
    };
    this.applicationEnvironment = {
      app: this.app,
      configureCloakBrowserRuntime: () => undefined,
      desktopControllers: {
        appProtocol: {
          appIconPath: '/app/icon.png',
          appRoot: '/app',
          logger: { warn: () => undefined },
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
          getAppIconPath: () => '/app/icon.png',
          openExternal: async () => undefined,
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
          getAppIconPath: () => '/app/icon.png',
          getAssetPath: () => '/app/icon.png',
          homeDirectory: () => '/home/test',
          logger: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
          },
          platform: 'win32',
          spawn: () => ({
            once: () => undefined,
            unref: () => undefined,
          }),
          syncDesktopIcons: () => undefined,
        },
        shortcuts: {
          cancelSelectedTextPrettify: () => false,
          getActiveSelectedTextAction: () => null,
          getSettings: () => ({
            cancelHotkey: 'Escape',
            hotkey: 'Super+Shift+Space',
            prettifyEnabled: true,
            prettifyHotkey: 'Super+Shift+P',
            retryTranscriptionHotkey: 'Super+Shift+R',
            stopHotkey: 'Super+Shift+S',
            translateEnabled: true,
            translateHotkey: 'Super+Shift+T',
          }),
          globalShortcut: {
            register: () => true,
            unregister: () => undefined,
            unregisterAll: () => undefined,
          },
          logger: { info: () => undefined, warn: () => undefined },
          platform: 'linux',
          prettifySelectedText: async () => ({ success: true }),
          translateSelectedTextToClipboard: async () => ({ success: true }),
        },
        tray: {
          application: this.app,
          buildMenu: () => ({}) as Menu,
          createNativeImage: () => new TestNativeImage() as unknown as NativeImage,
          createTray: () => new TestTray() as unknown as Tray,
          getAssetPath: () => '/app/icon.png',
          platform: 'linux',
          translate: () => '',
        },
        window: {
          createBrowserWindow: () => new TestDesktopWindow() as unknown as BrowserWindow,
          getAppIcon: () => new TestNativeImage() as unknown as NativeImage,
          getAppIconPath: () => '/app/icon.png',
          getAppUrl: () => 'app://gpt-voice/index.html',
          logger: { debug: () => undefined, warn: () => undefined },
          openExternal: async () => undefined,
          platform: 'linux',
          preloadPath: '/app/preload.js',
        },
      },
      getCurrentVoiceProviderId: () => 'chatgpt',
      initializeLocale: () => undefined,
      loadConfig: () => undefined,
      logger: {
        errorHandler: { startCatching: () => undefined },
        initialize: () => undefined,
        warn: () => undefined,
      },
      presentTranslationSettingsRepairNotice: () => undefined,
      shutdownTranslationProviders: async () => ({ failedProviderIds: [], success: true }),
      unloadPrettifyModel: async () => undefined,
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
    assert.match(ipc, /export class MainIpcRegistration/u);
    assert.match(ipc, /registration\.handle\('transcribe-audio'/u);
    assert.match(ipc, /if \(this\.disposalPromise\) return this\.disposalPromise;/u);
    assert.match(ipc, /for \(const channel of this\.channels\) ipcMain\.removeHandler\(channel\);/u);
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

  it('defers database and service construction until normal application startup', async () => {
    const harness = createHarness();
    const application = new MainProcessCompositionRoot(harness.compositionEnvironment).createApplication(
      harness.applicationEnvironment,
    );
    application.bootstrap();

    assert.equal(harness.state.createCount, 0);
    assert.equal(harness.state.ipcDependencies.length, 0);

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.state.createCount, 1);
    assert.equal(harness.state.ipcDependencies.length, 1);

    harness.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();
    assert.equal(harness.state.closeCount, 1);
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

    const firstDependencies = first.state.ipcDependencies[0];
    const secondDependencies = second.state.ipcDependencies[0];
    assert.notEqual(firstDependencies.historyController, secondDependencies.historyController);
    assert.notEqual(firstDependencies.backgroundBrowserService, secondDependencies.backgroundBrowserService);
    assert.notEqual(firstDependencies.desktopRuntimeController, secondDependencies.desktopRuntimeController);
    assert.notEqual(firstDependencies.shortcutController, secondDependencies.shortcutController);
    assert.notEqual(firstDependencies.streamingTranscriptionService, secondDependencies.streamingTranscriptionService);
    assert.notEqual(firstDependencies.transcriptionService, secondDependencies.transcriptionService);
    assert.notEqual(firstDependencies.voiceAudit, secondDependencies.voiceAudit);
    assert.notEqual(firstDependencies.voiceProviderRegistry, secondDependencies.voiceProviderRegistry);
    assert.notEqual(firstDependencies.windowManager, secondDependencies.windowManager);
    assert.notEqual(first.state.ipcRegistrations[0], second.state.ipcRegistrations[0]);

    first.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();

    assert.equal(first.state.ipcRegistrations[0].disposeCount, 1);
    assert.equal(first.state.closeCount, 1);
    assert.equal(second.state.ipcRegistrations[0].disposeCount, 0);
    assert.equal(second.state.closeCount, 0);

    second.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();
  });

  it('does not create or open the graph for the Linux integration-removal mode', async () => {
    const harness = createHarness(true);
    new MainProcessCompositionRoot(harness.compositionEnvironment)
      .createApplication(harness.applicationEnvironment)
      .bootstrap();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.state.createCount, 0);
    assert.equal(harness.state.ipcDependencies.length, 0);
    assert.equal(harness.app.quitCount, 1);
  });
});
