import type { MainIpcDependencies } from '../ipc';
import type {
  MainProcessIpcRegistration,
  MainProcessOwnedRuntime,
  MainProcessRuntimeFactory as MainProcessRuntimeFactoryContract,
} from '../mainProcessApplication';
import type { StreamingTranscriptionOperationId } from '../providers/streamingVoiceProvider';
import type { AppDatabaseDependencies } from '../repositories/sqlite/appDatabase';
import { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import { SqliteDiagnosticCaptureRepository } from '../repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from '../repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor } from '../services/diagnosticTextRedactor';
import type { TranscriptionCompletionDependencies } from '../services/transcriptionCompletion';
import {
  StreamingTranscriptionService,
  type MainStreamingTranscriptionServiceDependencies,
} from '../services/streamingTranscription';
import { TranscriptionService } from '../services/transcription';
import { TranscriptionHistoryIpcController } from '../services/transcriptionHistoryIpcController';
import { createTranscriptionResultCache } from '../services/transcriptionResultCache';
import type { DesktopRuntimeController } from '../desktopRuntimeController';
import type { ShortcutController } from '../shortcuts';
import type { WindowManager } from '../window';
import type { BackgroundBrowserService } from '../browser';
import type { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from '../providers/voiceProviderRegistry';
import { MainProcessRuntimeGraph } from './mainProcessRuntimeGraph';

type StreamingRuntimeDependencies = Omit<
  MainStreamingTranscriptionServiceDependencies,
  keyof TranscriptionCompletionDependencies
>;

export interface MainProcessRuntimeFactoryDependencies {
  readonly cacheNow: () => number;
  readonly databaseDependencies?: Partial<AppDatabaseDependencies>;
  readonly databasePath: string;
  readonly diagnosticLogger: {
    warn(...args: unknown[]): void;
  };
  readonly getMonotonicTimeMs: StreamingRuntimeDependencies['getMonotonicTimeMs'];
  readonly getRequestedAt: StreamingRuntimeDependencies['getRequestedAt'];
  readonly historyLogger: {
    warn(message: string, metadata: Readonly<Record<string, unknown>>): void;
  };
  readonly now: () => Date;
  readonly randomUUID: () => string;
  readonly registerIpcHandlers: (dependencies: MainIpcDependencies) => MainProcessIpcRegistration;
  readonly reportStreamingDiagnostic: StreamingRuntimeDependencies['reportDiagnostic'];
  readonly resolveStreamingCapability: StreamingRuntimeDependencies['resolveCapability'];
  readonly writeClipboardText: (text: string) => void;
}

export interface MainProcessRuntimeFactoryControllers {
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly shortcutController: ShortcutController;
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

  public create(): MainProcessOwnedRuntime {
    const database = new AppDatabaseCoordinator(this.dependencies.databasePath, this.dependencies.databaseDependencies);
    const historyRepository = new SqliteTranscriptionHistoryRepository(database);
    const diagnosticRepository = new SqliteDiagnosticCaptureRepository(database);
    const diagnosticStorage = new DiagnosticCaptureStorage(diagnosticRepository, {
      logger: this.dependencies.diagnosticLogger,
      now: this.dependencies.now,
      randomUUID: this.dependencies.randomUUID,
      redactor: new DiagnosticTextRedactor(),
    });
    const cache = createTranscriptionResultCache({ now: this.dependencies.cacheNow });
    const completionDependencies: TranscriptionCompletionDependencies = {
      cache,
      historyRepository,
      writeClipboardText: this.dependencies.writeClipboardText,
    };
    const transcriptionService = new TranscriptionService({
      ...completionDependencies,
      audit: this.controllers.voiceProviderAudit,
      backgroundBrowserService: this.controllers.backgroundBrowserService,
      getRequestedAt: this.dependencies.getRequestedAt,
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

    return new MainProcessRuntimeGraph({
      backgroundBrowserService: this.controllers.backgroundBrowserService,
      database,
      desktopRuntimeController: this.controllers.desktopRuntimeController,
      diagnosticStorage,
      historyController,
      registerIpcHandlers: this.dependencies.registerIpcHandlers,
      shortcutController: this.controllers.shortcutController,
      streamingTranscriptionService,
      transcriptionService,
      voiceAudit: this.controllers.voiceProviderAudit,
      voiceProviderRegistry: this.controllers.voiceProviderRegistry,
      windowManager: this.controllers.windowManager,
    });
  }

  private readonly createStreamingOperationId = (): StreamingTranscriptionOperationId => {
    return this.dependencies.randomUUID() as StreamingTranscriptionOperationId;
  };
}
