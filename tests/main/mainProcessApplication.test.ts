/* eslint-disable max-classes-per-file -- lifecycle fakes own distinct controller resources. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow } from 'electron';
import { AboutWindowController } from '@main/aboutWindowController';
import { AppProtocolController } from '@main/appProtocol';
import { DesktopRuntimeController } from '@main/desktopRuntimeController';
import { LinuxDesktopIntegrationController } from '@main/linuxDesktopIntegration';
import {
  MainProcessApplication,
  type MainProcessApplicationDependencies,
  type MainProcessElectronApplication,
  type MainProcessOwnedRuntime,
  type MainProcessPreventableEvent,
  type MainProcessRuntimeFactory,
} from '@main/mainProcessApplication';
import { ShortcutController } from '@main/shortcuts';
import { TrayController } from '@main/tray';
import { WindowManager, type BackgroundBrowserStatus } from '@main/window';
import { ProviderSettingsWindowController } from '@main/providerSettingsWindowController';
import { BackgroundBrowserService } from '@main/browser';
import { FirstLaunchStartupCoordinator } from '@main/firstLaunchStartupCoordinator';
import { MainInteractionLock } from '@shared/mainInteractionLock';
import { RecordingVoiceProviderAudit } from './providers/voiceAuditTestUtils';
import type { VoiceProviderAuditId } from '@main/providerAudit/mappings';
import { I18nService } from '@main/i18n';
import { TestAppConfigStore, TestCloakBrowserSettingsRepository } from './appConfigTestUtils';
import type { TranslationSettingsRepairNotice } from '@main/translationSettings';
import type { PrettifyProfileCatalogRepairNotice } from '@main/prettifyProfileCatalogState';
import { INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE } from '@shared/translationProvider';
import {
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  type FirstLaunchStartupJobRunResult,
} from '@shared/firstLaunchStartup';
import { InitialProviderReadinessTestDependencies } from './initialProviderReadinessTestUtils';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

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

class RecordingRuntime implements MainProcessOwnedRuntime {
  public closeCount = 0;
  public ipcDisposeCount = 0;
  public archiveShutdownCount = 0;
  public shutdownCount = 0;

  public constructor(private readonly events: string[]) {}

  public closeDatabase(): void {
    this.closeCount += 1;
    this.events.push('database-close');
  }

  public async pruneDiagnostics(): Promise<void> {
    this.events.push('diagnostic-prune');
  }

  public async disposeIpc(): Promise<void> {
    this.ipcDisposeCount += 1;
    this.events.push('ipc-dispose');
  }

  public registerIpc(): void {
    this.events.push('ipc-register');
  }

  public async shutdownLocalWhisper(): Promise<void> {
    this.events.push('local-whisper-shutdown');
  }

  public async shutdownDiagnostics() {
    this.shutdownCount += 1;
    this.events.push('diagnostic-shutdown');
    return { affectedRows: 0, status: 'success' } as const;
  }

  public async shutdownDiagnosticsArchive(): Promise<void> {
    this.archiveShutdownCount += 1;
    this.events.push('diagnostics-archive-shutdown');
  }
}

class RecordingRuntimeFactory implements MainProcessRuntimeFactory {
  public createCount = 0;

  public constructor(
    private readonly events: string[],
    private readonly runtime: MainProcessOwnedRuntime,
  ) {}

  public create(): MainProcessOwnedRuntime {
    this.createCount += 1;
    this.events.push('runtime-create');
    return this.runtime;
  }
}

class RecordingAppProtocolController extends AppProtocolController {
  public constructor(private readonly events: string[]) {
    super({
      appIconPath: '/app/icon.png',
      appRoot: '/app',
      logger: { warn: () => undefined },
      protocol: {
        handle: () => undefined,
        registerSchemesAsPrivileged: () => undefined,
        unhandle: () => undefined,
      },
      readFile: async () => Buffer.alloc(0),
    });
  }

  public override registerScheme(): void {
    this.events.push('protocol-scheme');
  }

  public override registerHandler(): void {
    this.events.push('protocol-register');
  }

  public override dispose(): void {
    this.events.push('protocol-dispose');
  }
}

class RecordingWindowManager extends WindowManager {
  public constructor(private readonly events: string[]) {
    super({
      createAboutWindowController: (createWindow) => new AboutWindowController(createWindow),
      createBrowserWindow: () => {
        throw new Error('unexpected-window-construction');
      },
      getAppIcon: () => {
        throw new Error('unexpected-icon-read');
      },
      getAppIconPath: () => '/app/icon.png',
      getAppUrl: () => 'app://gpt-voice/index.html',
      logger: { debug: () => undefined, warn: () => undefined },
      mainInteractionLock: new MainInteractionLock(() => false),
      openExternal: async () => undefined,
      platform: 'linux',
      preloadPath: '/app/preload.js',
      providerSettingsWindowController: new ProviderSettingsWindowController<BrowserWindow>(),
    });
  }

  public override createMainWindow(): void {
    this.events.push('window-create');
  }

  public override dispose(): void {
    this.events.push('window-dispose');
  }

  public override publishBackgroundStatus(_status: BackgroundBrowserStatus, _fallbackProviderId: string | null): void {
    this.events.push('background-status');
  }

  public override publishFirstLaunchStartupSnapshot(): void {
    this.events.push('startup-snapshot');
  }

  public override setQuitting(): void {
    this.events.push('set-quitting');
  }

  public override showMainWindow(): void {
    this.events.push('window-show');
  }
}

class RecordingDesktopRuntimeController extends DesktopRuntimeController {
  public constructor(
    private readonly events: string[],
    windowManager: WindowManager,
    options: { readonly benchmark?: boolean; readonly removing?: boolean } = {},
  ) {
    super({
      app: {
        commandLine: { appendSwitch: () => undefined },
        disableHardwareAcceleration: () => undefined,
        getVersion: () => '1.0.0',
        isPackaged: false,
        quit: () => undefined,
        requestSingleInstanceLock: () => true,
        setAboutPanelOptions: () => undefined,
        setAppUserModelId: () => undefined,
        setName: () => undefined,
        showAboutPanel: () => undefined,
      },
      arguments: [
        ...(options.benchmark ? ['--startup-benchmark'] : []),
        ...(options.removing ? ['--remove-linux-appimage-desktop-integration'] : []),
      ],
      buildMenu: () => {
        throw new Error('unexpected-menu-construction');
      },
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
      windowManager,
      writeStandardOutput: () => undefined,
    });
  }

  public override configureBeforeReady(): void {
    this.events.push('desktop-before-ready');
  }

  public override acquireSingleInstanceLock(): boolean {
    this.events.push('desktop-lock');
    return true;
  }

  public override configureNativeMetadata(): void {
    this.events.push('native-metadata');
  }

  public override configureApplicationReady(): void {
    this.events.push('desktop-ready');
  }

  public override waitForStartupBenchmarkReady(): void {
    this.events.push('benchmark-wait');
  }
}

class RecordingLinuxDesktopIntegrationController extends LinuxDesktopIntegrationController {
  public constructor(private readonly events: string[]) {
    super({
      app: { getVersion: () => '1.0.0', isPackaged: false },
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
      logger: { debug: () => undefined, info: () => undefined, warn: () => undefined },
      platform: 'linux',
      spawn: () => ({
        once: () => undefined,
        unref: () => undefined,
      }),
    });
  }

  public override refreshIcons(): void {
    this.events.push('desktop-icons');
  }

  public override registerAppImage(): void {
    this.events.push('desktop-integration');
  }

  public override removeAppImage(): void {
    this.events.push('desktop-remove');
  }
}

class RecordingTrayController extends TrayController {
  public constructor(
    private readonly events: string[],
    windowManager: WindowManager,
  ) {
    super({
      application: { quit: () => undefined },
      buildMenu: () => {
        throw new Error('unexpected-menu-construction');
      },
      createNativeImage: () => {
        throw new Error('unexpected-icon-construction');
      },
      createTray: () => {
        throw new Error('unexpected-tray-construction');
      },
      getAssetPath: () => '/app/icon.png',
      localization: new I18nService(),
      mainInteractionLock: new MainInteractionLock(() => false),
      platform: 'linux',
      windowManager,
    });
  }

  public override create(): void {
    this.events.push('tray-create');
  }

  public override dispose(): void {
    this.events.push('tray-dispose');
  }
}

class RecordingShortcutController extends ShortcutController {
  public constructor(
    private readonly events: string[],
    trayController: TrayController,
    windowManager: WindowManager,
  ) {
    super({
      config: new TestAppConfigStore(),
      globalShortcut: {
        register: () => true,
        unregister: () => undefined,
        unregisterAll: () => undefined,
      },
      logger: { info: () => undefined, warn: () => undefined },
      localization: new I18nService(),
      mainInteractionLock: new MainInteractionLock(() => false),
      notification: { show: () => undefined },
      platform: 'linux',
      prettifyRuntime: { isProviderConnected: () => true },
      providerHomeActionDispatcher: { dispatch: () => ({ accepted: false }) },
      selectedTextActionGate: {
        getActive: () => null,
        subscribe: () => () => undefined,
      },
      selectedTextPrettifyService: {
        cancel: () => null,
        applyDefaultProfileToSelectedText: async () => ({ success: true, status: '' }),
        chooseProfileForSelectedText: async () => ({ success: true, status: '' }),
        focusExistingChooser: () => false,
      },
      selectedTextTranslationService: {
        cancel: () => false,
        translateSelectedTextToClipboard: async () => ({ success: true }),
      },
      trayController,
      windowManager,
    });
  }

  public override register(): void {
    this.events.push('shortcuts-register');
  }

  public override dispose(): void {
    this.events.push('shortcuts-dispose');
  }
}

class RecordingBackgroundBrowserService extends BackgroundBrowserService {
  public constructor(
    private readonly events: string[],
    private readonly initializationStatus: { readonly providerId: string; readonly ready: boolean } = {
      providerId: 'openai-api',
      ready: true,
    },
  ) {
    super({
      audit: new RecordingVoiceProviderAudit(),
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
      config: new TestAppConfigStore('openai-api'),
      createBackgroundContext: async () => {
        throw new Error('unexpected background context');
      },
      createLoginContext: async () => {
        throw new Error('unexpected login context');
      },
      localization: new I18nService(),
      logger: { info: () => undefined },
      providerRegistry: {
        createProvider: () => {
          throw new Error('unexpected provider construction');
        },
        isKnownProviderId: (_providerId): _providerId is VoiceProviderAuditId => false,
      },
      readinessDeadline: new InitialProviderReadinessTestDependencies(),
    });
  }

  public override initialize(): Promise<{ readonly providerId: string; readonly ready: boolean }> {
    this.events.push('browser-initialize');
    return Promise.resolve(this.initializationStatus);
  }

  public override shutdown(): Promise<void> {
    this.events.push('browser-shutdown');
    return Promise.resolve();
  }
}

class RecordingConfigStore extends TestAppConfigStore {
  public constructor(
    private readonly events: string[],
    translateEnabled: boolean,
    providerId: string | null,
  ) {
    super(providerId);
    this.setTextActionSettings({ translateEnabled });
  }

  public override load(): void {
    this.events.push('config-load');
  }

  public override consumePendingTranslationSettingsRepairNotice(): TranslationSettingsRepairNotice {
    return { categories: ['shape'], providers: [] };
  }

  public override consumePendingPrettifyProfileCatalogRepairNotice(): PrettifyProfileCatalogRepairNotice {
    return { repaired: true };
  }
}

class RecordingI18nService extends I18nService {
  public constructor(private readonly events: string[]) {
    super();
  }

  public override setLocale(locale: Parameters<I18nService['setLocale']>[0]): void {
    super.setLocale(locale);
    this.events.push('locale-initialize');
  }
}

class MainProcessApplicationHarness {
  public readonly app = new RecordingElectronApplication();
  public readonly events: string[] = [];
  public readonly runtime = new RecordingRuntime(this.events);
  public readonly runtimeFactory = new RecordingRuntimeFactory(this.events, this.runtime);
  public startupCoordinator: FirstLaunchStartupCoordinator | null = null;
  public readonly warnings: Array<{
    readonly message: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> = [];
  public createApplication(
    options: {
      readonly benchmark?: boolean;
      readonly backgroundBrowserStatus?: { readonly providerId: string; readonly ready: boolean };
      readonly removing?: boolean;
      readonly providerId?: string | null;
      readonly cloakBrowserPreparation?: Promise<FirstLaunchStartupJobRunResult>;
      readonly translationEnabled?: boolean;
      readonly translationInitializationFailure?: boolean;
    } = {},
  ): MainProcessApplication {
    const windowManager = new RecordingWindowManager(this.events);
    const trayController = new RecordingTrayController(this.events, windowManager);
    const shortcutController = new RecordingShortcutController(this.events, trayController, windowManager);
    const backgroundBrowserService = new RecordingBackgroundBrowserService(
      this.events,
      options.backgroundBrowserStatus,
    );
    const config = new RecordingConfigStore(
      this.events,
      options.translationEnabled ?? true,
      options.providerId === undefined ? 'chatgpt' : options.providerId,
    );
    const translationRuntime = {
      initializeSelectedProvider: async () => {
        this.events.push('translation-initialize');
        if (options.translationInitializationFailure) {
          throw new Error('private translation startup failure');
        }
        return INITIAL_TRANSLATION_PROVIDER_CONNECTION_STATE;
      },
      shutdown: async () => {
        this.events.push('translation-shutdown');
        return { failedProviderIds: [], success: true };
      },
    };
    const firstLaunchStartupCoordinator = new FirstLaunchStartupCoordinator({
      jobRunners: [
        {
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
          run: async () => {
            this.events.push('cloak-prepare');
            if (options.cloakBrowserPreparation) return options.cloakBrowserPreparation;
            return { failureCode: null, success: true };
          },
        },
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
          isRequired: () => config.getSnapshot().provider !== null,
          run: async () => {
            const providerId = config.getSnapshot().provider;
            if (providerId === null) return { failureCode: null, success: true };
            const status = await backgroundBrowserService.initialize();
            windowManager.publishBackgroundStatus(status, providerId);
            return { failureCode: null, success: true };
          },
        },
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
          run: async () => {
            await translationRuntime.initializeSelectedProvider();
            return { failureCode: null, success: true };
          },
        },
      ],
    });
    this.startupCoordinator = firstLaunchStartupCoordinator;
    const dependencies: MainProcessApplicationDependencies = {
      app: this.app,
      appProtocolController: new RecordingAppProtocolController(this.events),
      backgroundBrowserService,
      config,
      configureCloakBrowserRuntime: () => this.events.push('cloak-runtime'),
      desktopRuntimeController: new RecordingDesktopRuntimeController(this.events, windowManager, options),
      firstLaunchStartupCoordinator,
      localization: new RecordingI18nService(this.events),
      linuxDesktopIntegrationController: new RecordingLinuxDesktopIntegrationController(this.events),
      logger: {
        errorHandler: {
          startCatching: () => this.events.push('logger-catch'),
        },
        initialize: () => this.events.push('logger-initialize'),
        warn: (message, metadata) => this.warnings.push({ message, ...(metadata ? { metadata } : {}) }),
      },
      prettifyRuntime: {
        shutdown: async () => {
          this.events.push('prettify-shutdown');
        },
      },
      providerHomeActionDispatcher: {
        dispose: () => this.events.push('provider-home-action-dispose'),
      },
      prettifyProfileChooserWindow: {
        dispose: () => this.events.push('prettify-chooser-dispose'),
      },
      notify: () => this.events.push('settings-notice'),
      runtimeFactory: this.runtimeFactory,
      selectedTextPrettifyService: {
        dispose: () => this.events.push('prettify-selection-dispose'),
      },
      shortcutController,
      translationRuntime,
      trayController,
      windowManager,
    };
    return new MainProcessApplication(dependencies);
  }
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('main process application lifecycle', () => {
  it('bootstraps and registers its Electron lifecycle callbacks once', () => {
    const harness = new MainProcessApplicationHarness();
    const application = harness.createApplication();

    application.bootstrap();
    application.bootstrap();

    assert.equal(harness.app.onCount, 6);
    assert.deepEqual(harness.events, ['desktop-before-ready', 'protocol-scheme', 'desktop-lock']);
  });

  it('starts exactly once when asynchronous composition finishes after Electron is ready', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.app.ready = true;
    const application = harness.createApplication();

    application.bootstrap();
    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.runtimeFactory.createCount, 1);
    assert.equal(harness.events.filter((event) => event === 'window-create').length, 1);
  });

  it('creates IPC and the main window before coordinator work while diagnostics prune concurrently', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.createApplication().bootstrap();

    assert.equal(harness.runtimeFactory.createCount, 0);
    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.events.includes('diagnostic-prune'), true);
    assert.ok(harness.events.indexOf('ipc-register') < harness.events.indexOf('window-create'));
    assert.ok(harness.events.indexOf('window-create') < harness.events.indexOf('cloak-prepare'));
    assert.ok(harness.events.indexOf('cloak-prepare') < harness.events.indexOf('translation-initialize'));
    assert.ok(harness.events.indexOf('cloak-prepare') < harness.events.indexOf('browser-initialize'));
    assert.ok(harness.events.indexOf('browser-initialize') < harness.events.indexOf('background-status'));
  });

  it('keeps integration removal and benchmark startup from opening unrelated resources', async () => {
    const removalHarness = new MainProcessApplicationHarness();
    removalHarness.createApplication({ removing: true }).bootstrap();
    removalHarness.app.emitReady();
    await flushAsyncWork();

    assert.equal(removalHarness.runtimeFactory.createCount, 0);
    assert.deepEqual(removalHarness.events.slice(3), ['logger-initialize', 'logger-catch', 'desktop-remove']);
    assert.equal(removalHarness.app.quitCount, 1);

    const benchmarkHarness = new MainProcessApplicationHarness();
    benchmarkHarness.createApplication({ benchmark: true }).bootstrap();
    benchmarkHarness.app.emitReady();
    await flushAsyncWork();

    assert.equal(benchmarkHarness.runtimeFactory.createCount, 1);
    assert.equal(benchmarkHarness.events.includes('benchmark-wait'), true);
    assert.equal(benchmarkHarness.events.includes('tray-create'), false);
    assert.equal(benchmarkHarness.events.includes('browser-initialize'), false);
    assert.equal(benchmarkHarness.events.includes('translation-initialize'), false);
    assert.equal(benchmarkHarness.events.includes('cloak-runtime'), false);
  });

  it('keeps application startup fail-open when Translation provider initialization rejects', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.createApplication({ translationInitializationFailure: true }).bootstrap();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.events.includes('translation-initialize'), true);
    assert.equal(harness.events.includes('browser-initialize'), true);
    assert.equal(harness.events.includes('background-status'), true);
    assert.equal(harness.startupCoordinator?.getSnapshot().state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed);
    assert.deepEqual(harness.warnings, []);
  });

  it('lets the Translation runtime publish its disabled state during startup', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.createApplication({ translationEnabled: false }).bootstrap();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.events.includes('translation-initialize'), true);
    assert.equal(harness.events.includes('browser-initialize'), true);
    assert.equal(harness.events.includes('background-status'), true);
  });

  it('skips Voice Provider initialization on a fresh profile while keeping other startup jobs available', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.createApplication({ providerId: null }).bootstrap();

    harness.app.emitReady();
    await flushAsyncWork();

    assert.equal(harness.events.includes('translation-initialize'), true);
    assert.equal(harness.events.includes('browser-initialize'), false);
    assert.equal(
      harness.startupCoordinator
        ?.getSnapshot()
        .jobs.find((job) => job.id === FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider)?.state,
      'not-required',
    );
  });

  it('settles selected but disconnected providers without blocking the startup view', async () => {
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly providerId: string;
      readonly status: { readonly providerId: string; readonly ready: boolean };
    }> = [
      {
        name: 'signed-out browser provider',
        providerId: 'chatgpt',
        status: { providerId: 'chatgpt', ready: false },
      },
      {
        name: 'unconfigured API provider',
        providerId: 'openai-api',
        status: { providerId: 'openai-api', ready: false },
      },
      {
        name: 'unloaded Local Whisper model',
        providerId: 'local-whisper',
        status: { providerId: 'local-whisper', ready: false },
      },
    ];

    for (const testCase of cases) {
      const harness = new MainProcessApplicationHarness();
      harness
        .createApplication({
          backgroundBrowserStatus: testCase.status,
          providerId: testCase.providerId,
        })
        .bootstrap();
      harness.app.emitReady();
      await flushAsyncWork();

      const voiceProviderJob = harness.startupCoordinator
        ?.getSnapshot()
        .jobs.find((job) => job.id === FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider);
      assert.equal(voiceProviderJob?.state, 'succeeded', testCase.name);
      assert.equal(harness.startupCoordinator?.getSnapshot().state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded);
      assert.equal(harness.events.includes('background-status'), true);
    }
  });

  it('disposes startup publication before quit cleanup suppresses late completion events', async () => {
    const preparation = createDeferred<FirstLaunchStartupJobRunResult>();
    const harness = new MainProcessApplicationHarness();
    harness.createApplication({ cloakBrowserPreparation: preparation.promise }).bootstrap();
    harness.app.emitReady();
    await flushAsyncWork();

    harness.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();
    const snapshotCountBeforeCompletion = harness.events.filter((event) => event === 'startup-snapshot').length;

    preparation.resolve({ failureCode: null, success: true });
    await flushAsyncWork();

    assert.equal(harness.events.filter((event) => event === 'startup-snapshot').length, snapshotCountBeforeCompletion);
    assert.equal(harness.events.includes('browser-initialize'), false);
    assert.equal(harness.events.includes('translation-initialize'), false);
  });

  it('owns one idempotent shutdown in the required resource order', async () => {
    const harness = new MainProcessApplicationHarness();
    harness.createApplication().bootstrap();
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
    assert.equal(harness.runtime.ipcDisposeCount, 1);
    assert.equal(harness.runtime.archiveShutdownCount, 1);
    assert.equal(harness.runtime.shutdownCount, 1);
    assert.equal(harness.runtime.closeCount, 1);
    assert.equal(harness.app.quitCount, 1);
    assert.deepEqual(harness.events, [
      'set-quitting',
      'shortcuts-dispose',
      'provider-home-action-dispose',
      'prettify-selection-dispose',
      'prettify-chooser-dispose',
      'ipc-dispose',
      'prettify-shutdown',
      'translation-shutdown',
      'browser-shutdown',
      'local-whisper-shutdown',
      'diagnostics-archive-shutdown',
      'diagnostic-shutdown',
      'database-close',
      'tray-dispose',
      'window-dispose',
      'protocol-dispose',
    ]);
  });

  it('keeps startup and shutdown state isolated between application instances', async () => {
    const first = new MainProcessApplicationHarness();
    const second = new MainProcessApplicationHarness();
    first.createApplication().bootstrap();
    second.createApplication().bootstrap();

    first.app.emitReady();
    await flushAsyncWork();
    first.app.emitWillQuit({ preventDefault: () => undefined });
    await flushAsyncWork();

    assert.equal(first.runtime.closeCount, 1);
    assert.equal(second.runtimeFactory.createCount, 0);
    assert.equal(second.runtime.closeCount, 0);
    assert.equal(second.app.quitCount, 0);
  });
});
