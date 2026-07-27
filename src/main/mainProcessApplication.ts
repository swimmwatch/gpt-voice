import type { DiagnosticCaptureMaintenanceResult } from './services/diagnosticCaptureStorage';

const STARTUP_FAILURE_LOG = 'Application startup failed';
const STREAMING_CLEANUP_FAILURE_LOG = 'Streaming transcription cleanup incomplete during quit';
const PRETTIFY_CLEANUP_FAILURE_LOG = 'Failed to unload Ollama prettify model during quit';
const TRANSLATION_CLEANUP_INCOMPLETE_LOG = 'Translation provider cleanup incomplete during quit:';
const TRANSLATION_CLEANUP_FAILURE_LOG = 'Translation provider cleanup failed during quit';
const BROWSER_CLEANUP_FAILURE_LOG = 'Background browser cleanup incomplete during quit';
const DATABASE_CLEANUP_FAILURE_LOG = 'Application database cleanup incomplete during quit';
const QUIT_CLEANUP_FAILURE_LOG = 'Quit cleanup failed';

export interface MainProcessPreventableEvent {
  preventDefault(): void;
}

export interface MainProcessElectronApplication {
  isReady(): boolean;
  on(
    event: 'activate' | 'before-quit' | 'ready' | 'second-instance' | 'window-all-closed',
    listener: () => void,
  ): unknown;
  on(event: 'will-quit', listener: (event: MainProcessPreventableEvent) => void): unknown;
  quit(): void;
}

export interface MainProcessLogger {
  readonly errorHandler: {
    startCatching(): void;
  };
  initialize(): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface MainProcessBackgroundStatus {
  readonly authExpired?: boolean;
  readonly error?: string;
  readonly providerId?: string;
  readonly ready: boolean;
}

export interface MainProcessTranslationShutdownResult {
  readonly failedProviderIds: readonly string[];
  readonly success: boolean;
}

export interface MainProcessGlobalShortcuts {
  unregisterAll(): void;
}

export interface MainProcessIpcRegistration {
  dispose(): Promise<void>;
}

/** Narrow application-facing view of the private dependency graph. */
export interface MainProcessOwnedRuntime {
  closeDatabase(): void;
  pruneDiagnostics(): Promise<void>;
  registerIpc(): MainProcessIpcRegistration;
  shutdownDiagnostics(): Promise<DiagnosticCaptureMaintenanceResult>;
}

export interface MainProcessApplicationDependencies {
  readonly app: MainProcessElectronApplication;
  readonly configureCloakBrowserRuntime: () => void;
  readonly configureDockIcon: () => void;
  readonly configureNativeAppMetadata: () => void;
  readonly configureSessionPermissions: () => void;
  readonly createRuntime: () => MainProcessOwnedRuntime;
  readonly createTray: () => void;
  readonly createWindow: () => void;
  readonly globalShortcuts: MainProcessGlobalShortcuts;
  readonly initializeBackgroundBrowser: () => Promise<MainProcessBackgroundStatus>;
  readonly initializeLocale: () => void;
  readonly isRemovingLinuxDesktopIntegration: boolean;
  readonly isStartupBenchmark: boolean;
  readonly loadConfig: () => void;
  readonly logger: MainProcessLogger;
  readonly presentTranslationSettingsRepairNotice: () => void;
  readonly publishBackgroundStatus: (status: MainProcessBackgroundStatus) => void;
  readonly refreshLinuxDesktopIcons: () => void;
  readonly registerAppProtocol: () => void;
  readonly registerLinuxDesktopIntegration: () => void;
  readonly registerShortcuts: () => void;
  readonly removeLinuxDesktopIntegration: () => void;
  readonly setQuitting: (quitting: boolean) => void;
  readonly showMainWindow: () => void;
  readonly shutdownBackgroundBrowser: () => Promise<void>;
  readonly shutdownTranslationProviders: () => Promise<MainProcessTranslationShutdownResult>;
  readonly unloadPrettifyModel: () => Promise<void>;
  readonly waitForStartupBenchmarkReady: () => void;
}

/**
 * Owns one Electron application's startup graph, IPC registration, and
 * idempotent quit lifecycle without publishing a global application instance.
 */
export class MainProcessApplication {
  private ipcRegistration: MainProcessIpcRegistration | null = null;
  private quitCleanupComplete = false;
  private quitCleanupPromise: Promise<void> | null = null;
  private registered = false;
  private runtime: MainProcessOwnedRuntime | null = null;

  public constructor(private readonly dependencies: MainProcessApplicationDependencies) {}

  public register(): void {
    if (this.registered) return;
    this.registered = true;
    const { app } = this.dependencies;
    app.on('second-instance', this.onSecondInstance);
    app.on('ready', this.onReady);
    app.on('window-all-closed', this.onWindowAllClosed);
    app.on('activate', this.onActivate);
    app.on('will-quit', this.onWillQuit);
    app.on('before-quit', this.onBeforeQuit);
  }

  private readonly onSecondInstance = (): void => {
    if (this.dependencies.app.isReady()) {
      this.dependencies.showMainWindow();
    }
  };

  private readonly onReady = (): void => {
    const { dependencies } = this;
    dependencies.logger.initialize();
    dependencies.logger.errorHandler.startCatching();

    if (dependencies.isRemovingLinuxDesktopIntegration) {
      dependencies.removeLinuxDesktopIntegration();
      dependencies.app.quit();
      return;
    }

    if (!dependencies.isStartupBenchmark) {
      dependencies.configureCloakBrowserRuntime();
      dependencies.configureNativeAppMetadata();
      dependencies.refreshLinuxDesktopIcons();
      dependencies.registerLinuxDesktopIntegration();
    }
    dependencies.registerAppProtocol();
    dependencies.configureDockIcon();
    dependencies.configureSessionPermissions();
    dependencies.loadConfig();
    dependencies.initializeLocale();
    dependencies.presentTranslationSettingsRepairNotice();

    try {
      this.runtime = dependencies.createRuntime();
      void this.startRuntime(this.runtime).catch(() => {
        dependencies.logger.warn(STARTUP_FAILURE_LOG);
      });
    } catch {
      dependencies.logger.warn(STARTUP_FAILURE_LOG);
    }
  };

  private async startRuntime(runtime: MainProcessOwnedRuntime): Promise<void> {
    await runtime.pruneDiagnostics();
    if (this.quitCleanupPromise) return;

    this.ipcRegistration = runtime.registerIpc();
    this.dependencies.createWindow();

    if (this.dependencies.isStartupBenchmark) {
      this.dependencies.waitForStartupBenchmarkReady();
      return;
    }

    this.dependencies.createTray();
    this.dependencies.registerShortcuts();
    const status = await this.dependencies.initializeBackgroundBrowser();
    this.dependencies.publishBackgroundStatus(status);
  }

  private readonly onWindowAllClosed = (): void => {
    // The application intentionally remains active in the tray.
  };

  private readonly onActivate = (): void => {
    this.dependencies.showMainWindow();
  };

  private readonly onBeforeQuit = (): void => {
    this.dependencies.setQuitting(true);
  };

  private readonly onWillQuit = (event: MainProcessPreventableEvent): void => {
    if (this.quitCleanupComplete) return;

    event.preventDefault();
    this.quitCleanupPromise ??= this.runQuitCleanup()
      .catch(() => {
        this.dependencies.logger.warn(QUIT_CLEANUP_FAILURE_LOG);
      })
      .finally(() => {
        this.quitCleanupComplete = true;
        this.dependencies.app.quit();
      });
  };

  private async runQuitCleanup(): Promise<void> {
    try {
      this.dependencies.globalShortcuts.unregisterAll();
    } catch {
      this.dependencies.logger.warn(QUIT_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.ipcRegistration?.dispose();
    } catch {
      this.dependencies.logger.warn(STREAMING_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.dependencies.unloadPrettifyModel();
    } catch {
      this.dependencies.logger.warn(PRETTIFY_CLEANUP_FAILURE_LOG);
    }

    try {
      const translationShutdown = await this.dependencies.shutdownTranslationProviders();
      if (!translationShutdown.success) {
        this.dependencies.logger.warn(TRANSLATION_CLEANUP_INCOMPLETE_LOG, {
          failedProviderIds: translationShutdown.failedProviderIds,
        });
      }
    } catch {
      this.dependencies.logger.warn(TRANSLATION_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.dependencies.shutdownBackgroundBrowser();
    } catch {
      this.dependencies.logger.warn(BROWSER_CLEANUP_FAILURE_LOG);
    }

    const runtime = this.runtime;
    if (!runtime) return;

    try {
      const storageShutdown = await runtime.shutdownDiagnostics();
      if (storageShutdown.status === 'failure') {
        this.dependencies.logger.warn(DATABASE_CLEANUP_FAILURE_LOG, {
          causeCode: storageShutdown.causeCode,
        });
      }
    } catch {
      this.dependencies.logger.warn(DATABASE_CLEANUP_FAILURE_LOG);
    }

    try {
      runtime.closeDatabase();
    } catch {
      this.dependencies.logger.warn(DATABASE_CLEANUP_FAILURE_LOG);
    }
  }
}
