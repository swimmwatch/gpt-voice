import type { MainIpcDependencies } from '../ipc';
import type { MainProcessIpcRegistration, MainProcessOwnedRuntime } from '../mainProcessApplication';
import type { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import type { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import type { TranscriptionHistoryIpcController } from '../services/transcriptionHistoryIpcController';

export interface MainProcessRuntimeGraphDependencies {
  readonly database: AppDatabaseCoordinator;
  readonly diagnosticStorage: DiagnosticCaptureStorage;
  readonly historyController: TranscriptionHistoryIpcController;
  readonly registerIpcHandlers: (dependencies: MainIpcDependencies) => MainProcessIpcRegistration;
  readonly streamingTranscriptionService: MainIpcDependencies['streamingTranscriptionService'];
  readonly transcribeAudio: MainIpcDependencies['transcribeAudio'];
}

/** Owns the private Task 07 runtime graph after composition. */
export class MainProcessRuntimeGraph implements MainProcessOwnedRuntime {
  private databaseClosed = false;
  private ipcRegistered = false;

  public constructor(private readonly dependencies: MainProcessRuntimeGraphDependencies) {}

  public pruneDiagnostics(): Promise<void> {
    return this.dependencies.diagnosticStorage.pruneOnStartup();
  }

  public registerIpc(): MainProcessIpcRegistration {
    if (this.ipcRegistered) {
      throw new Error('Main IPC is already registered for this application');
    }
    this.ipcRegistered = true;
    return this.dependencies.registerIpcHandlers({
      historyController: this.dependencies.historyController,
      streamingTranscriptionService: this.dependencies.streamingTranscriptionService,
      transcribeAudio: this.dependencies.transcribeAudio,
    });
  }

  public shutdownDiagnostics() {
    return this.dependencies.diagnosticStorage.shutdown();
  }

  public closeDatabase(): void {
    if (this.databaseClosed) return;
    this.databaseClosed = true;
    this.dependencies.database.close();
  }
}
