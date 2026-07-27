/* eslint-disable max-classes-per-file -- lifecycle fakes own distinct application, runtime, and IPC state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MainProcessApplication,
  type MainProcessApplicationDependencies,
  type MainProcessElectronApplication,
  type MainProcessIpcRegistration,
  type MainProcessOwnedRuntime,
  type MainProcessPreventableEvent,
} from '@main/mainProcessApplication';

class RecordingElectronApplication implements MainProcessElectronApplication {
  public onCount = 0;
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
    this.onCount += 1;
    this.listeners.set(event, listener);
  }

  public quit(): void {
    this.quitCount += 1;
  }

  public emit(event: 'activate' | 'before-quit' | 'second-instance' | 'window-all-closed'): void {
    const listener = this.listeners.get(event) as (() => void) | undefined;
    listener?.();
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

  public constructor(private readonly events: string[]) {}

  public async dispose(): Promise<void> {
    this.disposeCount += 1;
    this.events.push('ipc-dispose');
  }
}

class RecordingRuntime implements MainProcessOwnedRuntime {
  public readonly ipcRegistration: RecordingIpcRegistration;
  public closeCount = 0;
  public shutdownCount = 0;

  public constructor(private readonly events: string[]) {
    this.ipcRegistration = new RecordingIpcRegistration(events);
  }

  public closeDatabase(): void {
    this.closeCount += 1;
    this.events.push('database-close');
  }

  public async pruneDiagnostics(): Promise<void> {
    this.events.push('diagnostic-prune');
  }

  public registerIpc(): MainProcessIpcRegistration {
    this.events.push('ipc-register');
    return this.ipcRegistration;
  }

  public async shutdownDiagnostics() {
    this.shutdownCount += 1;
    this.events.push('diagnostic-shutdown');
    return { affectedRows: 0, status: 'success' } as const;
  }
}

class MainProcessApplicationHarness {
  public readonly app = new RecordingElectronApplication();
  public readonly events: string[] = [];
  public readonly runtime = new RecordingRuntime(this.events);
  public readonly warnings: Array<{ readonly message: string; readonly metadata?: Readonly<Record<string, unknown>> }> =
    [];
  public runtimeCreateCount = 0;

  public createApplication(overrides: Partial<MainProcessApplicationDependencies> = {}): MainProcessApplication {
    return new MainProcessApplication({
      app: this.app,
      configureCloakBrowserRuntime: () => this.events.push('cloak-runtime'),
      configureDockIcon: () => this.events.push('dock-icon'),
      configureNativeAppMetadata: () => this.events.push('native-metadata'),
      configureSessionPermissions: () => this.events.push('session-permissions'),
      createRuntime: () => {
        this.runtimeCreateCount += 1;
        this.events.push('runtime-create');
        return this.runtime;
      },
      createTray: () => this.events.push('tray-create'),
      createWindow: () => this.events.push('window-create'),
      globalShortcuts: {
        unregisterAll: () => this.events.push('shortcuts-unregister'),
      },
      initializeBackgroundBrowser: async () => {
        this.events.push('browser-initialize');
        return { providerId: 'chatgpt', ready: true };
      },
      initializeLocale: () => this.events.push('locale-initialize'),
      isRemovingLinuxDesktopIntegration: false,
      isStartupBenchmark: false,
      loadConfig: () => this.events.push('config-load'),
      logger: {
        errorHandler: {
          startCatching: () => this.events.push('logger-catch'),
        },
        initialize: () => this.events.push('logger-initialize'),
        warn: (message, metadata) => this.warnings.push({ message, ...(metadata ? { metadata } : {}) }),
      },
      presentTranslationSettingsRepairNotice: () => this.events.push('settings-notice'),
      publishBackgroundStatus: () => this.events.push('background-status'),
      refreshLinuxDesktopIcons: () => this.events.push('desktop-icons'),
      registerAppProtocol: () => this.events.push('protocol-register'),
      registerLinuxDesktopIntegration: () => this.events.push('desktop-integration'),
      registerShortcuts: () => this.events.push('shortcuts-register'),
      removeLinuxDesktopIntegration: () => this.events.push('desktop-remove'),
      setQuitting: () => this.events.push('set-quitting'),
      showMainWindow: () => this.events.push('window-show'),
      shutdownBackgroundBrowser: async () => {
        this.events.push('browser-shutdown');
      },
      shutdownTranslationProviders: async () => {
        this.events.push('translation-shutdown');
        return { failedProviderIds: [], success: true };
      },
      unloadPrettifyModel: async () => {
        this.events.push('prettify-shutdown');
      },
      waitForStartupBenchmarkReady: () => this.events.push('benchmark-wait'),
      ...overrides,
    });
  }
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('main process application lifecycle', () => {
  it('registers its Electron lifecycle callbacks once', () => {
    const harness = new MainProcessApplicationHarness();
    const application = harness.createApplication();

    application.register();
    application.register();

    assert.equal(harness.app.onCount, 6);
  });

  it('creates the runtime only on normal ready and prunes before IPC registration', async () => {
    const harness = new MainProcessApplicationHarness();
    const application = harness.createApplication();
    application.register();

    assert.equal(harness.runtimeCreateCount, 0);
    harness.app.emitReady();
    await flushAsyncWork();

    assert.deepEqual(harness.events, [
      'logger-initialize',
      'logger-catch',
      'cloak-runtime',
      'native-metadata',
      'desktop-icons',
      'desktop-integration',
      'protocol-register',
      'dock-icon',
      'session-permissions',
      'config-load',
      'locale-initialize',
      'settings-notice',
      'runtime-create',
      'diagnostic-prune',
      'ipc-register',
      'window-create',
      'tray-create',
      'shortcuts-register',
      'browser-initialize',
      'background-status',
    ]);
  });

  it('keeps integration removal and benchmark startup from opening unrelated resources', async () => {
    const removalHarness = new MainProcessApplicationHarness();
    removalHarness
      .createApplication({
        isRemovingLinuxDesktopIntegration: true,
      })
      .register();
    removalHarness.app.emitReady();
    await flushAsyncWork();

    assert.equal(removalHarness.runtimeCreateCount, 0);
    assert.deepEqual(removalHarness.events, ['logger-initialize', 'logger-catch', 'desktop-remove']);
    assert.equal(removalHarness.app.quitCount, 1);

    const benchmarkHarness = new MainProcessApplicationHarness();
    benchmarkHarness
      .createApplication({
        isStartupBenchmark: true,
      })
      .register();
    benchmarkHarness.app.emitReady();
    await flushAsyncWork();

    assert.equal(benchmarkHarness.runtimeCreateCount, 1);
    assert.equal(benchmarkHarness.events.includes('benchmark-wait'), true);
    assert.equal(benchmarkHarness.events.includes('tray-create'), false);
    assert.equal(benchmarkHarness.events.includes('browser-initialize'), false);
    assert.equal(benchmarkHarness.events.includes('cloak-runtime'), false);
  });

  it('owns one idempotent shutdown in the required resource order', async () => {
    const harness = new MainProcessApplicationHarness();
    const application = harness.createApplication();
    application.register();
    harness.app.emitReady();
    await flushAsyncWork();
    harness.events.length = 0;

    harness.app.emit('before-quit');
    let preventCount = 0;
    const quitEvent = {
      preventDefault: () => {
        preventCount += 1;
      },
    };
    harness.app.emitWillQuit(quitEvent);
    harness.app.emitWillQuit(quitEvent);
    await flushAsyncWork();

    assert.equal(preventCount, 2);
    assert.equal(harness.runtime.ipcRegistration.disposeCount, 1);
    assert.equal(harness.runtime.shutdownCount, 1);
    assert.equal(harness.runtime.closeCount, 1);
    assert.equal(harness.app.quitCount, 1);
    assert.deepEqual(harness.events, [
      'set-quitting',
      'shortcuts-unregister',
      'ipc-dispose',
      'prettify-shutdown',
      'translation-shutdown',
      'browser-shutdown',
      'diagnostic-shutdown',
      'database-close',
    ]);

    harness.app.emitWillQuit(quitEvent);
    await flushAsyncWork();
    assert.equal(harness.runtime.ipcRegistration.disposeCount, 1);
    assert.equal(harness.runtime.closeCount, 1);
  });

  it('keeps startup and shutdown state isolated between application instances', async () => {
    const first = new MainProcessApplicationHarness();
    const second = new MainProcessApplicationHarness();
    first.createApplication().register();
    second.createApplication().register();

    first.app.emitReady();
    await flushAsyncWork();
    first.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();

    assert.equal(first.runtime.closeCount, 1);
    assert.equal(second.runtimeCreateCount, 0);
    assert.equal(second.runtime.closeCount, 0);
    assert.equal(second.app.quitCount, 0);
  });
});
