import {
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
  type LocalWhisperArtifactProgress,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';
import { LocalWhisperRendererService } from './LocalWhisperRendererService';
import {
  formatLocalWhisperFailureCode,
  formatLocalWhisperRecoveryAction,
  isLocalWhisperArtifactProgressActive,
} from './LocalWhisperPresentation';

const MAX_CLOSE_CANCELLATION_OPERATIONS = 2;
const ARTIFACT_CANCELLATION_SETTLE_TIMEOUT_MS = 30_000;
const CANCELLABLE_ARTIFACT_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set(
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
);

interface ArtifactOperationWaiter {
  readonly operationIds: ReadonlySet<string>;
  readonly resolve: (settled: boolean) => void;
  cancelTimeout: () => void;
}

export interface LocalWhisperSettingsLifecyclePublisher {
  publishActionError(message: string): void;
  publishPendingAction(action: string | null): void;
  publishSettingsLoadFailure(): void;
  publishSnapshot(snapshot: LocalWhisperRendererSnapshot, resetDraft: boolean): void;
}

export interface LocalWhisperSettingsLifecycleScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

export type LocalWhisperSettingsLifecycleService = Pick<
  LocalWhisperRendererService,
  'cancelArtifact' | 'dispose' | 'startSettings' | 'subscribeSettings'
>;

const DEFAULT_SCHEDULER: LocalWhisperSettingsLifecycleScheduler = Object.freeze({
  schedule: (callback: () => void, delayMs: number): (() => void) => {
    const timeout = globalThis.setTimeout(() => callback(), delayMs);
    return () => globalThis.clearTimeout(timeout);
  },
});

function safeActionError(result: { readonly error: LocalWhisperRendererSafeFailure }): string {
  return `${formatLocalWhisperFailureCode(result.error.code)}. Recovery: ${formatLocalWhisperRecoveryAction(
    result.error.recoveryAction,
  )}.`;
}

function areArtifactOperationsTerminal(
  snapshot: LocalWhisperRendererSnapshot,
  operationIds: ReadonlySet<string>,
): boolean {
  return !snapshot.progress.some(
    (progress) => operationIds.has(progress.operationId) && isLocalWhisperArtifactProgressActive(progress),
  );
}

/** Owns renderer-local command admission, publication, cancellation waiters, and teardown for one settings page. */
export class LocalWhisperSettingsLifecycle {
  private commandPending = false;
  private disposed = false;
  private started = false;
  private latestSnapshot: LocalWhisperRendererSnapshot | null = null;
  private removeSettingsListener: (() => void) | null = null;
  private readonly operationWaiters = new Set<ArtifactOperationWaiter>();

  public constructor(
    private readonly service: LocalWhisperSettingsLifecycleService,
    private readonly publisher: LocalWhisperSettingsLifecyclePublisher,
    private readonly scheduler: LocalWhisperSettingsLifecycleScheduler = DEFAULT_SCHEDULER,
  ) {}

  public get isCommandPending(): boolean {
    return this.commandPending;
  }

  public get snapshot(): LocalWhisperRendererSnapshot | null {
    return this.latestSnapshot;
  }

  public start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    try {
      this.removeSettingsListener = this.service.subscribeSettings((snapshot) => this.acceptSnapshot(snapshot, false));
    } catch {
      this.publish(() => this.publisher.publishSettingsLoadFailure());
      return;
    }
    void this.service
      .startSettings()
      .then((snapshot) => this.acceptSnapshot(snapshot, false))
      .catch(() => this.publish(() => this.publisher.publishSettingsLoadFailure()));
  }

  public async run(
    action: string,
    operation: () => Promise<LocalWhisperSettingsCommandResult>,
    resetDraft: boolean,
  ): Promise<boolean> {
    if (this.disposed || this.commandPending) return false;
    this.commandPending = true;
    this.publish(() => this.publisher.publishPendingAction(action));
    try {
      const result = await operation();
      if (result.success) {
        this.acceptSnapshot(result.snapshot, resetDraft);
        return true;
      }
      this.publish(() => this.publisher.publishActionError(safeActionError(result)));
      return false;
    } catch {
      this.publish(() => this.publisher.publishActionError('The Local Whisper action could not be completed.'));
      return false;
    } finally {
      this.commandPending = false;
      this.publish(() => this.publisher.publishPendingAction(null));
    }
  }

  public async cancelArtifactOperations(operationIds: readonly string[]): Promise<boolean> {
    const uniqueOperationIds = [...new Set(operationIds)];
    if (this.disposed || this.commandPending) return false;
    if (uniqueOperationIds.length > MAX_CLOSE_CANCELLATION_OPERATIONS) {
      this.publish(() =>
        this.publisher.publishActionError('Local Whisper artifact cancellation could not be completed.'),
      );
      return false;
    }

    this.commandPending = true;
    this.publish(() => this.publisher.publishPendingAction('cancel'));
    try {
      for (const operationId of uniqueOperationIds) {
        if (this.disposed) return false;
        const currentProgress = this.latestSnapshot?.progress.find((entry) => entry.operationId === operationId);
        if (!currentProgress || !isLocalWhisperArtifactProgressActive(currentProgress)) continue;
        if (!CANCELLABLE_ARTIFACT_PROGRESS_STATES.has(currentProgress.state)) continue;

        const result = await this.service.cancelArtifact(operationId);
        if (this.disposed) return false;
        this.acceptSnapshot(result.snapshot, false);
        if (!result.success) {
          const latestProgress = result.snapshot.progress.find((entry) => entry.operationId === operationId);
          if (!latestProgress || !isLocalWhisperArtifactProgressActive(latestProgress)) continue;
          this.publish(() => this.publisher.publishActionError(safeActionError(result)));
          return false;
        }
      }
      const settled = await this.waitForArtifactOperations(new Set(uniqueOperationIds));
      if (!settled) {
        this.publish(() =>
          this.publisher.publishActionError('Local Whisper artifact cancellation could not be completed.'),
        );
      }
      return settled;
    } catch {
      this.publish(() =>
        this.publisher.publishActionError('Local Whisper artifact cancellation could not be completed.'),
      );
      return false;
    } finally {
      this.commandPending = false;
      this.publish(() => this.publisher.publishPendingAction(null));
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.commandPending = false;
    for (const waiter of [...this.operationWaiters]) this.settleOperationWaiter(waiter, false);

    const removeListener = this.removeSettingsListener;
    this.removeSettingsListener = null;
    try {
      removeListener?.();
    } catch {
      // Cleanup remains best-effort; renderer publication is already permanently disabled.
    } finally {
      try {
        void this.service.dispose().catch(() => undefined);
      } catch {
        // The service boundary is intentionally non-throwing during renderer teardown.
      }
    }
  }

  private acceptSnapshot(snapshot: LocalWhisperRendererSnapshot, resetDraft: boolean): void {
    const currentSnapshot = this.latestSnapshot;
    if (this.disposed || (currentSnapshot && currentSnapshot.snapshotRevision >= snapshot.snapshotRevision)) return;
    this.latestSnapshot = snapshot;
    this.resolveTerminalOperationWaiters(snapshot);
    this.publish(() => this.publisher.publishSnapshot(snapshot, resetDraft));
  }

  private async waitForArtifactOperations(operationIds: ReadonlySet<string>): Promise<boolean> {
    const currentSnapshot = this.latestSnapshot;
    if (this.disposed || !currentSnapshot) return false;
    if (areArtifactOperationsTerminal(currentSnapshot, operationIds)) return true;

    return new Promise((resolve) => {
      const waiter: ArtifactOperationWaiter = {
        operationIds,
        resolve,
        cancelTimeout: () => undefined,
      };
      this.operationWaiters.add(waiter);
      waiter.cancelTimeout = this.scheduler.schedule(
        () => this.settleOperationWaiter(waiter, false),
        ARTIFACT_CANCELLATION_SETTLE_TIMEOUT_MS,
      );
      const latestSnapshot = this.latestSnapshot;
      if (latestSnapshot && areArtifactOperationsTerminal(latestSnapshot, operationIds)) {
        this.settleOperationWaiter(waiter, true);
      }
    });
  }

  private resolveTerminalOperationWaiters(snapshot: LocalWhisperRendererSnapshot): void {
    for (const waiter of [...this.operationWaiters]) {
      if (areArtifactOperationsTerminal(snapshot, waiter.operationIds)) this.settleOperationWaiter(waiter, true);
    }
  }

  private settleOperationWaiter(waiter: ArtifactOperationWaiter, settled: boolean): void {
    if (!this.operationWaiters.delete(waiter)) return;
    try {
      waiter.cancelTimeout();
    } catch {
      // A scheduler cleanup failure must not retain a waiter or block teardown.
    }
    waiter.resolve(settled);
  }

  private publish(callback: () => void): void {
    if (!this.disposed) callback();
  }
}
