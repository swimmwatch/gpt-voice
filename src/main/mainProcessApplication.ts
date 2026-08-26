import type { DiagnosticCaptureMaintenanceResult } from './services/diagnosticCaptureStorage';
import type { AppProtocolController } from './appProtocol';
import type { DesktopRuntimeController } from './desktopRuntimeController';
import type { LinuxDesktopIntegrationController } from './linuxDesktopIntegration';
import type { ShortcutController } from './shortcuts';
import type { TrayController } from './tray';
import type { WindowManager } from './window';
import type { BackgroundBrowserService } from './browser';
import type { FirstLaunchStartupCoordinator } from './firstLaunchStartupCoordinator';
import type { TranslationRuntime } from './services/translation';
import type { PrettifyRuntime } from './services/prettifyProviders';
import type { SelectedTextPrettifyService } from './services/selectedTextPrettify';
import type { AppConfigStore } from './config';
import type { I18nService } from './i18n';
import { resolveStartupLocale } from './startupLocale';
import { presentPendingTranslationSettingsRepairNotice } from './translationSettings';
import { presentPendingPrettifyProfileCatalogRepairNotice } from './prettifyProfileCatalogState';
import type { PrettifyProfileChooserWindowController } from './prettifyProfileChooserWindowController';
import type { ProviderHomeActionDispatcher } from './providerHomeActionDispatcher';

const STARTUP_FAILURE_LOG = 'Application startup failed';
const STREAMING_CLEANUP_FAILURE_LOG = 'Streaming transcription cleanup incomplete during quit';
const PRETTIFY_CLEANUP_FAILURE_LOG = 'Failed to unload Ollama prettify model during quit';
const PRETTIFY_SELECTION_CLEANUP_FAILURE_LOG = 'Selected-text Prettify cleanup failed during quit';
const PRETTIFY_CHOOSER_CLEANUP_FAILURE_LOG = 'Prettify profile chooser cleanup failed during quit';
const TRANSLATION_CLEANUP_INCOMPLETE_LOG = 'Translation provider cleanup incomplete during quit:';
const TRANSLATION_CLEANUP_FAILURE_LOG = 'Translation provider cleanup failed during quit';
const BROWSER_CLEANUP_FAILURE_LOG = 'Background browser cleanup incomplete during quit';
const LOCAL_WHISPER_CLEANUP_FAILURE_LOG = 'Local Whisper cleanup incomplete during quit';
const DIAGNOSTICS_ARCHIVE_CLEANUP_FAILURE_LOG = 'Diagnostics archive cleanup incomplete during quit';
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

/** Narrow application-facing view of the private dependency graph. */
export interface MainProcessOwnedRuntime {
  closeDatabase(): void;
  disposeIpc(): Promise<void>;
  pruneDiagnostics(): Promise<void>;
  registerIpc(): void;
  shutdownLocalWhisper(): Promise<void>;
  shutdownDiagnostics(): Promise<DiagnosticCaptureMaintenanceResult>;
  shutdownDiagnosticsArchive(): Promise<void>;
}

export interface MainProcessRuntimeFactory {
  create(): MainProcessOwnedRuntime;
}

export interface MainProcessApplicationDependencies {
  readonly app: MainProcessElectronApplication;
  readonly appProtocolController: AppProtocolController;
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly config: Pick<
    AppConfigStore,
    | 'consumePendingPrettifyProfileCatalogRepairNotice'
    | 'consumePendingTranslationSettingsRepairNotice'
    | 'getSnapshot'
    | 'load'
  >;
  readonly configureCloakBrowserRuntime: () => void;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly firstLaunchStartupCoordinator: Pick<FirstLaunchStartupCoordinator, 'dispose' | 'start' | 'subscribe'>;
  readonly localization: I18nService;
  readonly linuxDesktopIntegrationController: LinuxDesktopIntegrationController;
  readonly logger: MainProcessLogger;
  readonly notify: (title: string, body: string) => void;
  readonly prettifyRuntime: Pick<PrettifyRuntime, 'shutdown'>;
  readonly providerHomeActionDispatcher: Pick<ProviderHomeActionDispatcher, 'dispose'>;
  readonly prettifyProfileChooserWindow: Pick<PrettifyProfileChooserWindowController, 'dispose'>;
  readonly runtimeFactory: MainProcessRuntimeFactory;
  readonly selectedTextPrettifyService: Pick<SelectedTextPrettifyService, 'dispose'>;
  readonly shortcutController: ShortcutController;
  readonly translationRuntime: Pick<TranslationRuntime, 'initializeSelectedProvider' | 'shutdown'>;
  readonly trayController: TrayController;
  readonly windowManager: WindowManager;
}

/**
 * Owns one Electron application's startup graph, IPC registration, and
 * idempotent quit lifecycle without publishing a global application instance.
 */
export class MainProcessApplication {
  private bootstrapped = false;
  private readyHandled = false;
  private quitCleanupComplete = false;
  private quitCleanupPromise: Promise<void> | null = null;
  private registered = false;
  private runtime: MainProcessOwnedRuntime | null = null;
  private startupSnapshotUnsubscribe: (() => void) | null = null;

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
    if (app.isReady()) this.onReady();
  }

  private readonly onSecondInstance = (): void => {
    if (this.dependencies.app.isReady()) {
      this.dependencies.windowManager.showMainWindow();
    }
  };

  private readonly onReady = (): void => {
    if (this.readyHandled) return;
    this.readyHandled = true;
    const { dependencies } = this;
    dependencies.logger.initialize();
    dependencies.logger.errorHandler.startCatching();

    const desktopRuntime = dependencies.desktopRuntimeController;
    if (desktopRuntime.isRemovingLinuxDesktopIntegration) {
      dependencies.linuxDesktopIntegrationController.removeAppImage();
      dependencies.app.quit();
      return;
    }

    dependencies.config.load();
    const config = dependencies.config.getSnapshot();
    dependencies.localization.setLocale(
      resolveStartupLocale(config.locale, config.localeExplicit, dependencies.localization.getSupportedLocales()),
    );

    if (!desktopRuntime.isStartupBenchmark) {
      dependencies.configureCloakBrowserRuntime();
      desktopRuntime.configureNativeMetadata();
      dependencies.linuxDesktopIntegrationController.refreshIcons();
      dependencies.linuxDesktopIntegrationController.registerAppImage();
    }
    dependencies.appProtocolController.registerHandler();
    desktopRuntime.configureApplicationReady();
    presentPendingTranslationSettingsRepairNotice({
      notice: dependencies.config.consumePendingTranslationSettingsRepairNotice(),
      notify: dependencies.notify,
      translate: dependencies.localization.translate,
    });
    presentPendingPrettifyProfileCatalogRepairNotice({
      notice: dependencies.config.consumePendingPrettifyProfileCatalogRepairNotice(),
      notify: dependencies.notify,
      translate: dependencies.localization.translate,
    });

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
    const diagnosticsPruning = runtime.pruneDiagnostics();
    if (this.quitCleanupPromise) {
      await diagnosticsPruning;
      return;
    }

    runtime.registerIpc();
    this.dependencies.windowManager.createMainWindow();

    if (this.dependencies.desktopRuntimeController.isStartupBenchmark) {
      this.dependencies.desktopRuntimeController.waitForStartupBenchmarkReady();
      await diagnosticsPruning;
      return;
    }

    this.startupSnapshotUnsubscribe ??= this.dependencies.firstLaunchStartupCoordinator.subscribe((snapshot) => {
      this.dependencies.windowManager.publishFirstLaunchStartupSnapshot(snapshot);
    });
    void this.dependencies.firstLaunchStartupCoordinator.start();
    this.dependencies.trayController.create();
    this.dependencies.shortcutController.register();
    await diagnosticsPruning;
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

  /** Releases process-owned services in dependency order while preserving best-effort cleanup. */
  private async runQuitCleanup(): Promise<void> {
    const runtime = this.runtime;
    this.startupSnapshotUnsubscribe?.();
    this.startupSnapshotUnsubscribe = null;
    this.dependencies.firstLaunchStartupCoordinator.dispose();
    try {
      this.dependencies.shortcutController.dispose();
    } catch {
      this.dependencies.logger.warn(QUIT_CLEANUP_FAILURE_LOG);
    }

    this.dependencies.providerHomeActionDispatcher.dispose();

    try {
      this.dependencies.selectedTextPrettifyService.dispose();
    } catch {
      this.dependencies.logger.warn(PRETTIFY_SELECTION_CLEANUP_FAILURE_LOG);
    }

    try {
      this.dependencies.prettifyProfileChooserWindow.dispose();
    } catch {
      this.dependencies.logger.warn(PRETTIFY_CHOOSER_CLEANUP_FAILURE_LOG);
    }

    try {
      await runtime?.disposeIpc();
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

    try {
      await runtime?.shutdownLocalWhisper();
    } catch {
      this.dependencies.logger.warn(LOCAL_WHISPER_CLEANUP_FAILURE_LOG);
    }

    if (runtime) {
      try {
        await runtime.shutdownDiagnosticsArchive();
      } catch {
        this.dependencies.logger.warn(DIAGNOSTICS_ARCHIVE_CLEANUP_FAILURE_LOG);
      }

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
