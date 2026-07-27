import type { DiagnosticCaptureMaintenanceResult } from './services/diagnosticCaptureStorage';
import type { AppProtocolController } from './appProtocol';
import type { DesktopRuntimeController } from './desktopRuntimeController';
import type { LinuxDesktopIntegrationController } from './linuxDesktopIntegration';
import type { ShortcutController } from './shortcuts';
import type { TrayController } from './tray';
import type { WindowManager } from './window';
import type { BackgroundBrowserService } from './browser';
import type { TranslationRuntime } from './services/translation';
import type { PrettifyRuntime } from './services/prettifyProviders';

const STARTUP_FAILURE_LOG = 'Application startup failed';
const STREAMING_CLEANUP_FAILURE_LOG = 'Streaming transcription cleanup incomplete during quit';
const PRETTIFY_CLEANUP_FAILURE_LOG = 'Failed to unload Ollama prettify model during quit';
const TRANSLATION_CLEANUP_INCOMPLETE_LOG = 'Translation provider cleanup incomplete during quit:';
const TRANSLATION_CLEANUP_FAILURE_LOG = 'Translation provider cleanup failed during quit';
const BROWSER_CLEANUP_FAILURE_LOG = 'Background browser cleanup incomplete during quit';
const DATABASE_CLEANUP_FAILURE_LOG = 'Application database cleanup incomplete during quit';
const QUIT_CLEANUP_FAILURE_LOG = 'Quit cleanup failed';
const DESKTOP_CLEANUP_FAILURE_LOG = 'Desktop resource cleanup incomplete during quit';

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

export interface MainProcessRuntimeFactory {
  create(): MainProcessOwnedRuntime;
}

export interface MainProcessApplicationDependencies {
  readonly app: MainProcessElectronApplication;
  readonly appProtocolController: AppProtocolController;
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly configureCloakBrowserRuntime: () => void;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly getCurrentVoiceProviderId: () => string;
  readonly initializeLocale: () => void;
  readonly linuxDesktopIntegrationController: LinuxDesktopIntegrationController;
  readonly loadConfig: () => void;
  readonly logger: MainProcessLogger;
  readonly presentTranslationSettingsRepairNotice: () => void;
  readonly prettifyRuntime: Pick<PrettifyRuntime, 'shutdown'>;
  readonly runtimeFactory: MainProcessRuntimeFactory;
  readonly shortcutController: ShortcutController;
  readonly translationRuntime: Pick<TranslationRuntime, 'shutdown'>;
  readonly trayController: TrayController;
  readonly windowManager: WindowManager;
}

/**
 * Owns one Electron application's startup graph, IPC registration, and
 * idempotent quit lifecycle without publishing a global application instance.
 */
export class MainProcessApplication {
  private bootstrapped = false;
  private ipcRegistration: MainProcessIpcRegistration | null = null;
  private quitCleanupComplete = false;
  private quitCleanupPromise: Promise<void> | null = null;
  private registered = false;
  private runtime: MainProcessOwnedRuntime | null = null;

  public constructor(private readonly dependencies: MainProcessApplicationDependencies) {}

  public bootstrap(): void {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    this.dependencies.desktopRuntimeController.configureBeforeReady();
    this.dependencies.appProtocolController.registerScheme();
    if (!this.dependencies.desktopRuntimeController.acquireSingleInstanceLock()) return;
    this.register();
  }

  private register(): void {
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
      this.dependencies.windowManager.showMainWindow();
    }
  };

  private readonly onReady = (): void => {
    const { dependencies } = this;
    dependencies.logger.initialize();
    dependencies.logger.errorHandler.startCatching();

    const desktopRuntime = dependencies.desktopRuntimeController;
    if (desktopRuntime.isRemovingLinuxDesktopIntegration) {
      dependencies.linuxDesktopIntegrationController.removeAppImage();
      dependencies.app.quit();
      return;
    }

    if (!desktopRuntime.isStartupBenchmark) {
      dependencies.configureCloakBrowserRuntime();
      desktopRuntime.configureNativeMetadata();
      dependencies.linuxDesktopIntegrationController.refreshIcons();
      dependencies.linuxDesktopIntegrationController.registerAppImage();
    }
    dependencies.appProtocolController.registerHandler();
    desktopRuntime.configureApplicationReady();
    dependencies.loadConfig();
    dependencies.initializeLocale();
    dependencies.presentTranslationSettingsRepairNotice();

    try {
      this.runtime = dependencies.runtimeFactory.create();
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
    this.dependencies.windowManager.createMainWindow();

    if (this.dependencies.desktopRuntimeController.isStartupBenchmark) {
      this.dependencies.desktopRuntimeController.waitForStartupBenchmarkReady();
      return;
    }

    this.dependencies.trayController.create();
    this.dependencies.shortcutController.register();
    const status = await this.dependencies.backgroundBrowserService.initialize();
    this.dependencies.windowManager.publishBackgroundStatus(status, this.dependencies.getCurrentVoiceProviderId());
  }

  private readonly onWindowAllClosed = (): void => {
    // The application intentionally remains active in the tray.
  };

  private readonly onActivate = (): void => {
    this.dependencies.windowManager.showMainWindow();
  };

  private readonly onBeforeQuit = (): void => {
    this.dependencies.windowManager.setQuitting(true);
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
      this.dependencies.shortcutController.dispose();
    } catch {
      this.dependencies.logger.warn(QUIT_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.ipcRegistration?.dispose();
    } catch {
      this.dependencies.logger.warn(STREAMING_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.dependencies.prettifyRuntime.shutdown();
    } catch {
      this.dependencies.logger.warn(PRETTIFY_CLEANUP_FAILURE_LOG);
    }

    try {
      const translationShutdown = await this.dependencies.translationRuntime.shutdown();
      if (!translationShutdown.success) {
        this.dependencies.logger.warn(TRANSLATION_CLEANUP_INCOMPLETE_LOG, {
          failedProviderIds: translationShutdown.failedProviderIds,
        });
      }
    } catch {
      this.dependencies.logger.warn(TRANSLATION_CLEANUP_FAILURE_LOG);
    }

    try {
      await this.dependencies.backgroundBrowserService.shutdown();
    } catch {
      this.dependencies.logger.warn(BROWSER_CLEANUP_FAILURE_LOG);
    }

    const runtime = this.runtime;
    if (runtime) {
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

    this.disposeDesktopResources();
  }

  private disposeDesktopResources(): void {
    try {
      this.dependencies.trayController.dispose();
    } catch {
      this.dependencies.logger.warn(DESKTOP_CLEANUP_FAILURE_LOG);
    }
    try {
      this.dependencies.windowManager.dispose();
    } catch {
      this.dependencies.logger.warn(DESKTOP_CLEANUP_FAILURE_LOG);
    }
    try {
      this.dependencies.appProtocolController.dispose();
    } catch {
      this.dependencies.logger.warn(DESKTOP_CLEANUP_FAILURE_LOG);
    }
  }
}
