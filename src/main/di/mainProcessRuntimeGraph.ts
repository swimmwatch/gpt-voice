import type { MainIpcDependencies } from '../ipc';
import type { MainProcessIpcRegistration, MainProcessOwnedRuntime } from '../mainProcessApplication';
import type { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import type { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import type { TranscriptionHistoryIpcController } from '../services/transcriptionHistoryIpcController';

export interface MainProcessRuntimeGraphDependencies {
  readonly backgroundBrowserService: MainIpcDependencies['backgroundBrowserService'];
  readonly database: AppDatabaseCoordinator;
  readonly desktopRuntimeController: MainIpcDependencies['desktopRuntimeController'];
  readonly diagnosticStorage: DiagnosticCaptureStorage;
  readonly historyController: TranscriptionHistoryIpcController;
  readonly prettifyConnectionCoordinator: MainIpcDependencies['prettifyConnectionCoordinator'];
  readonly prettifyRuntime: MainIpcDependencies['prettifyRuntime'];
  readonly registerIpcHandlers: (dependencies: MainIpcDependencies) => MainProcessIpcRegistration;
  readonly shortcutController: MainIpcDependencies['shortcutController'];
  readonly streamingTranscriptionService: MainIpcDependencies['streamingTranscriptionService'];
  readonly transcriptionService: MainIpcDependencies['transcriptionService'];
  readonly translationRuntime: MainIpcDependencies['translationRuntime'];
  readonly voiceAudit: MainIpcDependencies['voiceAudit'];
  readonly voiceProviderRegistry: MainIpcDependencies['voiceProviderRegistry'];
  readonly windowManager: MainIpcDependencies['windowManager'];
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
      backgroundBrowserService: this.dependencies.backgroundBrowserService,
      desktopRuntimeController: this.dependencies.desktopRuntimeController,
      historyController: this.dependencies.historyController,
      prettifyConnectionCoordinator: this.dependencies.prettifyConnectionCoordinator,
      prettifyRuntime: this.dependencies.prettifyRuntime,
      shortcutController: this.dependencies.shortcutController,
      streamingTranscriptionService: this.dependencies.streamingTranscriptionService,
      transcriptionService: this.dependencies.transcriptionService,
      translationRuntime: this.dependencies.translationRuntime,
      voiceAudit: this.dependencies.voiceAudit,
      voiceProviderRegistry: this.dependencies.voiceProviderRegistry,
      windowManager: this.dependencies.windowManager,
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
