import type { MainIpcController } from '../ipc';
import type { MainProcessOwnedRuntime } from '../mainProcessApplication';
import type { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import type { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import type { DiagnosticsArchiveService } from '../services/diagnosticsArchive';
import type { LocalWhisperCoordinator } from '../localWhisper/coordinator/LocalWhisperCoordinator';
import type { LocalWhisperIpcController } from '../localWhisper/ipc/LocalWhisperIpcController';
import type { LocalWhisperSnapshotService } from '../localWhisper/ipc/LocalWhisperSnapshotService';

export interface MainProcessRuntimeGraphDependencies {
  readonly database: AppDatabaseCoordinator;
  readonly diagnosticStorage: DiagnosticCaptureStorage;
  readonly diagnosticsArchive: DiagnosticsArchiveService;
  readonly ipcController: MainIpcController;
  readonly localWhisperCoordinator: LocalWhisperCoordinator;
  readonly localWhisperIpcController: LocalWhisperIpcController;
  readonly localWhisperSnapshots: LocalWhisperSnapshotService;
}

/** Owns the private Task 07 runtime graph after composition. */
export class MainProcessRuntimeGraph implements MainProcessOwnedRuntime {
  private databaseClosed = false;
  private localWhisperShutdown: Promise<void> | null = null;

  public constructor(private readonly dependencies: MainProcessRuntimeGraphDependencies) {}

  public pruneDiagnostics(): Promise<void> {
    return this.dependencies.diagnosticStorage.pruneOnStartup();
  }

  public registerIpc(): void {
    this.dependencies.localWhisperIpcController.register();
    this.dependencies.ipcController.register();
  }

  public async disposeIpc(): Promise<void> {
    this.dependencies.localWhisperIpcController.dispose();
    await this.dependencies.ipcController.dispose();
  }

  public shutdownLocalWhisper(): Promise<void> {
    this.localWhisperShutdown ??= this.performLocalWhisperShutdown();
    return this.localWhisperShutdown;
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

  private async performLocalWhisperShutdown(): Promise<void> {
    try {
      const result = await this.dependencies.localWhisperCoordinator.shutdown();
      if (!result.success) throw new Error(result.error.code);
    } finally {
      this.dependencies.localWhisperSnapshots.dispose();
    }
  }
}
