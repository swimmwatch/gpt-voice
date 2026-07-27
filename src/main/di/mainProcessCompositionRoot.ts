import type { AppDatabaseDependencies } from '../repositories/sqlite/appDatabase';
import { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import { SqliteDiagnosticCaptureRepository } from '../repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from '../repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor } from '../services/diagnosticTextRedactor';
import { TranscriptionHistoryIpcController } from '../services/transcriptionHistoryIpcController';
import { createTranscriptionResultCache } from '../services/transcriptionResultCache';
import { createTranscriptionService } from '../services/transcription';
import {
  StreamingTranscriptionService,
  type MainStreamingTranscriptionServiceDependencies,
} from '../services/streamingTranscription';
import type { TranscriptionCompletionDependencies } from '../services/transcriptionCompletion';
import type { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import type { StreamingTranscriptionOperationId } from '../providers/streamingVoiceProvider';
import type { MainIpcDependencies } from '../ipc';
import {
  MainProcessApplication,
  type MainProcessApplicationDependencies,
  type MainProcessIpcRegistration,
  type MainProcessOwnedRuntime,
} from '../mainProcessApplication';
import { MainProcessRuntimeGraph } from './mainProcessRuntimeGraph';

type StreamingRuntimeDependencies = Omit<
  MainStreamingTranscriptionServiceDependencies,
  keyof TranscriptionCompletionDependencies
>;

export interface MainProcessCompositionEnvironment {
  readonly cacheNow: () => number;
  readonly databaseDependencies?: Partial<AppDatabaseDependencies>;
  readonly databasePath: string;
  readonly diagnosticLogger: {
    warn(...args: unknown[]): void;
  };
  readonly ensureBackgroundBrowser: () => Promise<void>;
  readonly getActiveProvider: MainStreamingTranscriptionServiceDependencies['getActiveProvider'];
  readonly getMonotonicTimeMs: StreamingRuntimeDependencies['getMonotonicTimeMs'];
  readonly getRequestedAt: StreamingRuntimeDependencies['getRequestedAt'];
  readonly historyLogger: {
    warn(message: string, metadata: Readonly<Record<string, unknown>>): void;
  };
  readonly isBackgroundReady: () => boolean;
  readonly now: () => Date;
  readonly randomUUID: () => string;
  readonly registerIpcHandlers: (dependencies: MainIpcDependencies) => MainProcessIpcRegistration;
  readonly reportStreamingDiagnostic: StreamingRuntimeDependencies['reportDiagnostic'];
  readonly resolveStreamingCapability: StreamingRuntimeDependencies['resolveCapability'];
  readonly voiceAudit: VoiceProviderAudit;
  readonly writeClipboardText: (text: string) => void;
}

export type MainProcessApplicationEnvironment = Omit<MainProcessApplicationDependencies, 'createRuntime'>;

/**
 * Constructs one private main-process dependency graph and returns its owning
 * application. It intentionally exposes no token lookup or resolved service.
 */
export class MainProcessCompositionRoot {
  public constructor(private readonly environment: MainProcessCompositionEnvironment) {}

  public createApplication(environment: MainProcessApplicationEnvironment): MainProcessApplication {
    return new MainProcessApplication({
      ...environment,
      createRuntime: this.createRuntime,
    });
  }

  private readonly createStreamingOperationId = (): StreamingTranscriptionOperationId => {
    return this.environment.randomUUID() as StreamingTranscriptionOperationId;
  };

  private readonly createRuntime = (): MainProcessOwnedRuntime => {
    const database = new AppDatabaseCoordinator(this.environment.databasePath, this.environment.databaseDependencies);
    const historyRepository = new SqliteTranscriptionHistoryRepository(database);
    const diagnosticRepository = new SqliteDiagnosticCaptureRepository(database);
    const diagnosticStorage = new DiagnosticCaptureStorage(diagnosticRepository, {
      logger: this.environment.diagnosticLogger,
      now: this.environment.now,
      randomUUID: this.environment.randomUUID,
      redactor: new DiagnosticTextRedactor(),
    });
    const cache = createTranscriptionResultCache({ now: this.environment.cacheNow });
    const completionDependencies: TranscriptionCompletionDependencies = {
      cache,
      historyRepository,
      writeClipboardText: this.environment.writeClipboardText,
    };
    const transcribeAudio = createTranscriptionService({
      ...completionDependencies,
      audit: this.environment.voiceAudit,
      ensureBackgroundBrowser: this.environment.ensureBackgroundBrowser,
      getActiveProvider: this.environment.getActiveProvider,
      getRequestedAt: this.environment.getRequestedAt,
      isBackgroundReady: this.environment.isBackgroundReady,
    });
    const streamingTranscriptionService = new StreamingTranscriptionService({
      ...completionDependencies,
      audit: this.environment.voiceAudit,
      createOperationId: this.createStreamingOperationId,
      getActiveProvider: this.environment.getActiveProvider,
      getMonotonicTimeMs: this.environment.getMonotonicTimeMs,
      getRequestedAt: this.environment.getRequestedAt,
      reportDiagnostic: this.environment.reportStreamingDiagnostic,
      resolveCapability: this.environment.resolveStreamingCapability,
    });
    const historyController = new TranscriptionHistoryIpcController(historyRepository, {
      logger: this.environment.historyLogger,
      writeClipboardText: this.environment.writeClipboardText,
    });

    return new MainProcessRuntimeGraph({
      database,
      diagnosticStorage,
      historyController,
      registerIpcHandlers: this.environment.registerIpcHandlers,
      streamingTranscriptionService,
      transcribeAudio,
    });
  };
}
