import { MainIpcController, TrustedIpcRegistrar, type MainIpcControllerDependencies } from '../ipc';
import type {
  MainProcessOwnedRuntime,
  MainProcessRuntimeFactory as MainProcessRuntimeFactoryContract,
} from '../mainProcessApplication';
import type { StreamingTranscriptionOperationId } from '../providers/streamingVoiceProvider';
import type { AppDatabaseCoordinator, AppDatabaseDependencies } from '../repositories/sqlite/appDatabase';
import type { SqliteTranscriptionHistoryRepository } from '../repositories/sqlite/sqliteTranscriptionHistoryRepository';
import type { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import type { TranscriptionCompletionDependencies } from '../services/transcriptionCompletion';
import {
  StreamingTranscriptionService,
  type MainStreamingTranscriptionServiceDependencies,
} from '../services/streamingTranscription';
import { TranscriptionService } from '../services/transcription';
import { LocalWhisperTranscriptionDispatch } from '../services/localWhisperTranscriptionDispatch';
import { TranscriptionHistoryIpcController } from '../services/transcriptionHistoryIpcController';
import { createTranscriptionResultCache } from '../services/transcriptionResultCache';
import type { DesktopRuntimeController } from '../desktopRuntimeController';
import type { ShortcutController } from '../shortcuts';
import type { ProviderHomeActionDispatcher } from '../providerHomeActionDispatcher';
import type { WindowManager } from '../window';
import type { BackgroundBrowserService } from '../browser';
import type { FirstLaunchStartupCoordinator } from '../firstLaunchStartupCoordinator';
import type { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from '../providers/voiceProviderRegistry';
import type { TranslationRuntime } from '../services/translation';
import type { PrettifyRuntime } from '../services/prettifyProviders';
import { MainProcessRuntimeGraph } from './mainProcessRuntimeGraph';
import type { I18nService } from '../i18n';
import type { WebContents } from 'electron';
import { PrettifyConnectionCheckCoordinator } from '../services/prettifyConnectionCheckCoordinator';
import { StreamingTranscriptionIpcController } from '../streamingTranscriptionIpcController';
import type { DiagnosticCaptureSettingsService } from '../services/diagnosticCaptureSettings';
import type { DiagnosticsArchiveService } from '../services/diagnosticsArchive';
import type { DiagnosticsExportService } from '../services/diagnosticsExport';
import type { PrettifyProfilePortabilityService } from '../services/prettifyProfilePortability';
import type { CloakBrowserSettingsResetService } from '../services/cloakBrowserSettingsReset';
import { PrettifyProfileChooserIpcRegistrar } from '../prettifyProfileChooserIpcRegistrar';
import type { PrettifyProfileChooserWindowController } from '../prettifyProfileChooserWindowController';
import type { LocalWhisperCoordinator } from '../localWhisper/coordinator/LocalWhisperCoordinator';
import type { LocalWhisperIpcController } from '../localWhisper/ipc/LocalWhisperIpcController';
import type { LocalWhisperSnapshotService } from '../localWhisper/ipc/LocalWhisperSnapshotService';
import { MainInteractionLock } from '@shared/mainInteractionLock';
import { VoiceProviderSelectionService } from '../localWhisper/ipc/VoiceProviderSelectionService';

type StreamingRuntimeDependencies = Omit<
  MainStreamingTranscriptionServiceDependencies,
  keyof TranscriptionCompletionDependencies
>;

type RuntimeOwnedMainIpcDependencyKeys =
  | 'backgroundBrowserService'
  | 'cloakBrowserSettingsReset'
  | 'createPrettifyConnectionCoordinator'
  | 'createStreamingTranscriptionController'
  | 'desktopRuntimeController'
  | 'diagnosticCaptureSettings'
  | 'diagnosticsExport'
  | 'firstLaunchStartupCoordinator'
  | 'historyController'
  | 'mainInteractionLock'
  | 'prettifyProfileChooserIpc'
  | 'prettifyProfileChooserWindow'
  | 'prettifyProfilePortability'
  | 'providerHomeActionDispatcher'
  | 'prettifyRuntime'
  | 'providerSelection'
  | 'shortcutController'
  | 'streamingTranscriptionService'
  | 'transcriptionService'
  | 'translationRuntime'
  | 'trustedIpc'
  | 'voiceAudit'
  | 'voiceProviderRegistry'
  | 'windowManager';

export interface MainProcessRuntimeFactoryDependencies {
  readonly cacheNow: () => number;
  readonly databaseDependencies: AppDatabaseDependencies;
  readonly databasePath: string;
  readonly diagnosticLogger: {
    warn(...args: unknown[]): void;
  };
  readonly getMonotonicTimeMs: StreamingRuntimeDependencies['getMonotonicTimeMs'];
  readonly getRequestedAt: StreamingRuntimeDependencies['getRequestedAt'];
  readonly historyLogger: {
    warn(message: string, metadata: Readonly<Record<string, unknown>>): void;
  };
  readonly ipc: Omit<MainIpcControllerDependencies, RuntimeOwnedMainIpcDependencyKeys>;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly now: () => Date;
  readonly randomUUID: () => string;
  readonly reportStreamingDiagnostic: StreamingRuntimeDependencies['reportDiagnostic'];
  readonly resolveStreamingCapability: StreamingRuntimeDependencies['resolveCapability'];
  readonly transcriptionLogger: TranscriptionCompletionDependencies['logger'];
  readonly writeClipboardText: (text: string) => void;
}

export interface MainProcessRuntimeFactoryControllers {
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly cloakBrowserSettingsReset: CloakBrowserSettingsResetService;
  readonly database: AppDatabaseCoordinator;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly diagnosticCaptureSettings: DiagnosticCaptureSettingsService;
  readonly diagnosticStorage: DiagnosticCaptureStorage;
  readonly diagnosticsArchive: DiagnosticsArchiveService;
  readonly diagnosticsExport: DiagnosticsExportService;
  readonly firstLaunchStartupCoordinator: FirstLaunchStartupCoordinator;
  readonly historyRepository: SqliteTranscriptionHistoryRepository;
  readonly localWhisperCoordinator: LocalWhisperCoordinator;
  readonly localWhisperEnvironmentDispose: () => Promise<void>;
  readonly localWhisperIpcController: LocalWhisperIpcController;
  readonly localWhisperSnapshots: LocalWhisperSnapshotService;
  readonly mainInteractionLock: MainInteractionLock;
  readonly prettifyProfileChooserWindow: PrettifyProfileChooserWindowController;
  readonly prettifyProfilePortability: PrettifyProfilePortabilityService;
  readonly providerHomeActionDispatcher: ProviderHomeActionDispatcher;
  readonly shortcutController: ShortcutController;
  readonly prettifyRuntime: PrettifyRuntime;
  readonly translationRuntime: TranslationRuntime;
  readonly voiceProviderAudit: VoiceProviderAudit;
  readonly voiceProviderRegistry: VoiceProviderRegistry;
  readonly windowManager: WindowManager;
}

/** Constructs one deferred database, service, and IPC runtime graph. */
export class MainProcessRuntimeFactory implements MainProcessRuntimeFactoryContract {
  public constructor(
    private readonly dependencies: MainProcessRuntimeFactoryDependencies,
    private readonly controllers: MainProcessRuntimeFactoryControllers,
  ) {}

  /** Creates one application-owned runtime graph without publishing shared mutable state. */
  public create(): MainProcessOwnedRuntime {
    const { database, diagnosticCaptureSettings, diagnosticStorage, diagnosticsArchive, historyRepository } =
      this.controllers;
    const cache = createTranscriptionResultCache({ now: this.dependencies.cacheNow });
    const completionDependencies: TranscriptionCompletionDependencies = {
      cache,
      historyRepository,
      logger: this.dependencies.transcriptionLogger,
      writeClipboardText: this.dependencies.writeClipboardText,
    };
    const transcriptionService = new TranscriptionService({
      ...completionDependencies,
      audit: this.controllers.voiceProviderAudit,
      backgroundBrowserService: this.controllers.backgroundBrowserService,
      getRequestedAt: this.dependencies.getRequestedAt,
      localization: this.dependencies.localization,
      localWhisperDispatch: new LocalWhisperTranscriptionDispatch({
        ...completionDependencies,
        audit: this.controllers.voiceProviderAudit,
      }),
    });
    const streamingTranscriptionService = new StreamingTranscriptionService({
      ...completionDependencies,
      audit: this.controllers.voiceProviderAudit,
      backgroundBrowserService: this.controllers.backgroundBrowserService,
      createOperationId: this.createStreamingOperationId,
      getMonotonicTimeMs: this.dependencies.getMonotonicTimeMs,
      getRequestedAt: this.dependencies.getRequestedAt,
      reportDiagnostic: this.dependencies.reportStreamingDiagnostic,
      resolveCapability: this.dependencies.resolveStreamingCapability,
    });
    const historyController = new TranscriptionHistoryIpcController(historyRepository, {
      logger: this.dependencies.historyLogger,
      writeClipboardText: this.dependencies.writeClipboardText,
    });
    const trustedIpc = new TrustedIpcRegistrar(
      this.dependencies.ipc.ipc,
      this.dependencies.ipc.logger,
      this.controllers.windowManager,
    );
    const prettifyProfileChooserIpc = new PrettifyProfileChooserIpcRegistrar({
      controller: this.controllers.prettifyProfileChooserWindow,
      ipc: this.dependencies.ipc.ipc,
      localization: this.dependencies.ipc.localization,
      logger: this.dependencies.ipc.logger,
    });
    const providerSelection = new VoiceProviderSelectionService({
      config: this.dependencies.ipc.config,
      runtime: this.controllers.backgroundBrowserService,
      registry: this.controllers.voiceProviderRegistry,
      getReadinessRevision: () => this.controllers.localWhisperSnapshots.snapshot.snapshotRevision,
      mainInteractionLock: this.controllers.mainInteractionLock,
    });
    const ipcController = new MainIpcController({
      ...this.dependencies.ipc,
      backgroundBrowserService: this.controllers.backgroundBrowserService,
      cloakBrowserSettingsReset: this.controllers.cloakBrowserSettingsReset,
      createPrettifyConnectionCoordinator: (runtime) => new PrettifyConnectionCheckCoordinator<WebContents>(runtime),
      createStreamingTranscriptionController: (dependencies) =>
        new StreamingTranscriptionIpcController<WebContents>(dependencies),
      desktopRuntimeController: this.controllers.desktopRuntimeController,
      diagnosticCaptureSettings,
      diagnosticsExport: this.controllers.diagnosticsExport,
      firstLaunchStartupCoordinator: this.controllers.firstLaunchStartupCoordinator,
      historyController,
      mainInteractionLock: this.controllers.mainInteractionLock,
      prettifyProfileChooserIpc,
      prettifyProfileChooserWindow: this.controllers.prettifyProfileChooserWindow,
      prettifyProfilePortability: this.controllers.prettifyProfilePortability,
      providerHomeActionDispatcher: this.controllers.providerHomeActionDispatcher,
      prettifyRuntime: this.controllers.prettifyRuntime,
      providerSelection,
      shortcutController: this.controllers.shortcutController,
      streamingTranscriptionService,
      transcriptionService,
      translationRuntime: this.controllers.translationRuntime,
      trustedIpc,
      voiceAudit: this.controllers.voiceProviderAudit,
      voiceProviderRegistry: this.controllers.voiceProviderRegistry,
      windowManager: this.controllers.windowManager,
    });

    return new MainProcessRuntimeGraph({
      database,
      diagnosticStorage,
      diagnosticsArchive,
      ipcController,
      localWhisperCoordinator: this.controllers.localWhisperCoordinator,
      localWhisperEnvironmentDispose: this.controllers.localWhisperEnvironmentDispose,
      localWhisperIpcController: this.controllers.localWhisperIpcController,
      localWhisperSnapshots: this.controllers.localWhisperSnapshots,
    });
  }

  private readonly createStreamingOperationId = (): StreamingTranscriptionOperationId => {
    return this.dependencies.randomUUID() as StreamingTranscriptionOperationId;
  };
}
