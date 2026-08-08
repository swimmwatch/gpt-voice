import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import {
  ARTIFACT_MAX_ACTIVE_TRANSFERS,
  LocalWhisperArtifactLifecycleError,
  type LocalWhisperArtifactOperationId,
  type LocalWhisperArtifactOperationResult,
} from './ArtifactLifecycleTypes';

export interface ArtifactTransferQueueTask {
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly run: (signal: AbortSignal) => Promise<LocalWhisperArtifactOperationResult>;
  readonly cancelledBeforeStart: () => LocalWhisperArtifactOperationResult;
  readonly onQueued: (position: number) => void;
  readonly onStarted: () => void;
}

interface QueuedTask extends ArtifactTransferQueueTask {
  readonly reject: (error: unknown) => void;
  readonly resolve: (result: LocalWhisperArtifactOperationResult) => void;
}

interface ActiveTask {
  readonly artifactId: LocalWhisperArtifactId;
  readonly controller: AbortController;
}

/** Process-owned FIFO with exactly two unrelated active transfer slots. */
export class ArtifactTransferQueue {
  private readonly active = new Map<LocalWhisperArtifactOperationId, ActiveTask>();
  private readonly queued: QueuedTask[] = [];

  public enqueue(task: ArtifactTransferQueueTask): Promise<LocalWhisperArtifactOperationResult> {
    if (
      this.hasArtifact(task.artifactId) ||
      this.active.has(task.operationId) ||
      this.hasQueuedOperation(task.operationId)
    ) {
      throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
    }
    const completion = new Promise<LocalWhisperArtifactOperationResult>((resolve, reject) => {
      this.queued.push({ ...task, resolve, reject });
    });
    this.publishQueuedPositions();
    this.pump();
    return completion;
  }

  public cancel(operationId: LocalWhisperArtifactOperationId): boolean {
    const queuedIndex = this.queued.findIndex((candidate) => candidate.operationId === operationId);
    if (queuedIndex >= 0) {
      const [task] = this.queued.splice(queuedIndex, 1);
      task.resolve(task.cancelledBeforeStart());
      this.publishQueuedPositions();
      return true;
    }
    const active = this.active.get(operationId);
    if (!active) return false;
    active.controller.abort();
    return true;
  }

  public get activeCount(): number {
    return this.active.size;
  }

  public get queuedCount(): number {
    return this.queued.length;
  }

  public isArtifactBusy(artifactId: LocalWhisperArtifactId): boolean {
    return this.hasArtifact(artifactId);
  }

  private hasArtifact(artifactId: LocalWhisperArtifactId): boolean {
    if ([...this.active.values()].some((active) => active.artifactId === artifactId)) return true;
    return this.queued.some((queued) => queued.artifactId === artifactId);
  }

  private hasQueuedOperation(operationId: LocalWhisperArtifactOperationId): boolean {
    return this.queued.some((queued) => queued.operationId === operationId);
  }

  private publishQueuedPositions(): void {
    this.queued.forEach((task, index) => task.onQueued(index + 1));
  }

  private pump(): void {
    while (this.active.size < ARTIFACT_MAX_ACTIVE_TRANSFERS && this.queued.length > 0) {
      const task = this.queued.shift();
      if (!task) return;
      const controller = new AbortController();
      this.active.set(task.operationId, { artifactId: task.artifactId, controller });
      task.onStarted();
      void task
        .run(controller.signal)
        .finally(() => {
          this.active.delete(task.operationId);
          this.publishQueuedPositions();
          this.pump();
        })
        .then(task.resolve, task.reject);
    }
    this.publishQueuedPositions();
  }
}
