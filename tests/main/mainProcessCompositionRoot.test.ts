/* eslint-disable max-classes-per-file -- application and IPC fakes own independent test state. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
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
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

class RecordingElectronApplication implements MainProcessElectronApplication {
  public quitCount = 0;
  public ready = false;
  private readonly listeners = new Map<string, unknown>();

  public isReady(): boolean {
    return this.ready;
  }

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
      ensureBackgroundBrowser: async () => undefined,
      getActiveProvider: () => null,
      getMonotonicTimeMs: () => 0,
      getRequestedAt: () => '2026-07-27T12:00:00.000Z',
      historyLogger: { warn: () => undefined },
      isBackgroundReady: () => false,
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
      voiceAudit: new VoiceProviderAudit(),
      writeClipboardText: () => undefined,
    };
    this.applicationEnvironment = {
      app: this.app,
      configureCloakBrowserRuntime: () => undefined,
      configureDockIcon: () => undefined,
      configureNativeAppMetadata: () => undefined,
      configureSessionPermissions: () => undefined,
      createTray: () => undefined,
      createWindow: () => undefined,
      globalShortcuts: { unregisterAll: () => undefined },
      initializeBackgroundBrowser: async () => ({ ready: true }),
      initializeLocale: () => undefined,
      isRemovingLinuxDesktopIntegration,
      isStartupBenchmark: false,
      loadConfig: () => undefined,
      logger: {
        errorHandler: { startCatching: () => undefined },
        initialize: () => undefined,
        warn: () => undefined,
      },
      presentTranslationSettingsRepairNotice: () => undefined,
      publishBackgroundStatus: () => undefined,
      refreshLinuxDesktopIcons: () => undefined,
      registerAppProtocol: () => undefined,
      registerLinuxDesktopIntegration: () => undefined,
      registerShortcuts: () => undefined,
      removeLinuxDesktopIntegration: () => undefined,
      setQuitting: () => undefined,
      showMainWindow: () => undefined,
      shutdownBackgroundBrowser: async () => undefined,
      shutdownTranslationProviders: async () => ({ failedProviderIds: [], success: true }),
      unloadPrettifyModel: async () => undefined,
      waitForStartupBenchmarkReady: () => undefined,
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

    assert.doesNotMatch(
      main,
      /\b(?:const|let)\s+(?:appDatabase|transcriptionHistoryRepository|diagnosticCaptureRepository|diagnosticCaptureStorage|transcribeAudio|streamingTranscriptionService|quitCleanupComplete|quitCleanupPromise)\b/u,
    );
    assert.doesNotMatch(ipc, /\blet\s+streamingTranscriptionIpcController\b/u);
    assert.match(ipc, /export class MainIpcRegistration/u);
    assert.match(ipc, /registration\.handle\('transcribe-audio'/u);
    assert.match(ipc, /if \(this\.disposalPromise\) return this\.disposalPromise;/u);
    assert.match(ipc, /for \(const channel of this\.channels\) ipcMain\.removeHandler\(channel\);/u);
    assert.doesNotMatch(diagnosticStorage, /DEFAULT_DEPENDENCIES|Partial<DiagnosticCaptureStorageDependencies>/u);
    assert.doesNotMatch(diagnosticRedactor, /export const diagnosticTextRedactor/u);
    assert.doesNotMatch(transcription, /\bimport\s*\{\s*voiceProviderAudit\b|\baudit\?:/u);
    assert.doesNotMatch(streaming, /\bcreateMainStreamingTranscriptionService\b|\bimport\s*\{\s*voiceProviderAudit\b/u);
  });

  it('defers database and service construction until normal application startup', async () => {
    const harness = createHarness();
    const application = new MainProcessCompositionRoot(harness.compositionEnvironment).createApplication(
      harness.applicationEnvironment,
    );
    application.register();

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
      .register();
    new MainProcessCompositionRoot(second.compositionEnvironment)
      .createApplication(second.applicationEnvironment)
      .register();

    first.app.emitReady();
    second.app.emitReady();
    await flushAsyncWork();

    const firstDependencies = first.state.ipcDependencies[0];
    const secondDependencies = second.state.ipcDependencies[0];
    assert.notEqual(firstDependencies.historyController, secondDependencies.historyController);
    assert.notEqual(firstDependencies.streamingTranscriptionService, secondDependencies.streamingTranscriptionService);
    assert.notEqual(firstDependencies.transcribeAudio, secondDependencies.transcribeAudio);
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
      .register();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.state.createCount, 0);
    assert.equal(harness.state.ipcDependencies.length, 0);
    assert.equal(harness.app.quitCount, 1);
  });
});
