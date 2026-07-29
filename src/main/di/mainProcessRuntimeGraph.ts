import type { MainIpcController } from '../ipc';
import type { MainProcessOwnedRuntime } from '../mainProcessApplication';
import type { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import type { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import type { DiagnosticsArchiveService } from '../services/diagnosticsArchive';

export interface MainProcessRuntimeGraphDependencies {
  readonly database: AppDatabaseCoordinator;
  readonly diagnosticStorage: DiagnosticCaptureStorage;
  readonly diagnosticsArchive: DiagnosticsArchiveService;
  readonly ipcController: MainIpcController;
}

/** Owns the private Task 07 runtime graph after composition. */
export class MainProcessRuntimeGraph implements MainProcessOwnedRuntime {
  private databaseClosed = false;

  public constructor(private readonly dependencies: MainProcessRuntimeGraphDependencies) {}

  public pruneDiagnostics(): Promise<void> {
    return this.dependencies.diagnosticStorage.pruneOnStartup();
  }

  public registerIpc(): void {
    this.dependencies.ipcController.register();
  }

  public disposeIpc(): Promise<void> {
    return this.dependencies.ipcController.dispose();
  }

  public shutdownDiagnostics() {
    return this.dependencies.diagnosticStorage.shutdown();
  }

  public shutdownDiagnosticsArchive(): Promise<void> {
    return this.dependencies.diagnosticsArchive.shutdown();
  }

  public closeDatabase(): void {
    if (this.databaseClosed) return;
    this.databaseClosed = true;
    this.dependencies.database.close();
  }
}
