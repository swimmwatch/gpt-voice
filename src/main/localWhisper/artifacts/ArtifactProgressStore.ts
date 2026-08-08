import {
  LOCAL_WHISPER_ARTIFACT_ACTIONS,
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactId,
  type LocalWhisperRendererSafeFailure,
} from '@shared/localWhisper';

import {
  ARTIFACT_PROGRESS_MIN_INTERVAL_MS,
  type ArtifactClock,
  type LocalWhisperArtifactOperationId,
  type LocalWhisperArtifactOperationState,
  type LocalWhisperArtifactProgressSnapshot,
} from './ArtifactLifecycleTypes';

export interface ArtifactProgressUpdate {
  readonly operationId: LocalWhisperArtifactOperationId;
  readonly artifactId: LocalWhisperArtifactId;
  readonly action: LocalWhisperArtifactAction;
  readonly state: LocalWhisperArtifactOperationState;
  readonly receivedBytes: number;
  readonly totalBytes: number;
  readonly queuedPosition?: number | null;
  readonly failure?: LocalWhisperRendererSafeFailure | null;
}

/** Owns immutable, renderer-safe progress with chunk-update rate limiting. */
export class ArtifactProgressStore {
  private readonly snapshots = new Map<LocalWhisperArtifactOperationId, LocalWhisperArtifactProgressSnapshot>();
  private readonly listeners = new Set<(snapshots: readonly LocalWhisperArtifactProgressSnapshot[]) => void>();

  public constructor(private readonly clock: ArtifactClock) {}

  public publish(update: ArtifactProgressUpdate, force = false): LocalWhisperArtifactProgressSnapshot {
    this.assertUpdate(update);
    const previous = this.snapshots.get(update.operationId);
    const now = this.clock.now();
    if (
      previous &&
      !force &&
      previous.state === update.state &&
      now - previous.updatedAtMs < ARTIFACT_PROGRESS_MIN_INTERVAL_MS
    ) {
      return previous;
    }
    const snapshot = Object.freeze({
      operationId: update.operationId,
      artifactId: update.artifactId,
      action: update.action,
      state: update.state,
      receivedBytes: update.receivedBytes,
      totalBytes: update.totalBytes,
      queuedPosition: update.queuedPosition ?? null,
      updatedAtMs: now,
      failure: update.failure ?? null,
    });
    this.snapshots.set(update.operationId, snapshot);
    const snapshots = this.list();
    for (const listener of [...this.listeners]) listener(snapshots);
    return snapshot;
  }

  public get(operationId: LocalWhisperArtifactOperationId): LocalWhisperArtifactProgressSnapshot | null {
    return this.snapshots.get(operationId) ?? null;
  }

  public list(): readonly LocalWhisperArtifactProgressSnapshot[] {
    return Object.freeze([...this.snapshots.values()]);
  }

  public subscribe(listener: (snapshots: readonly LocalWhisperArtifactProgressSnapshot[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private assertUpdate(update: ArtifactProgressUpdate): void {
    if (
      !Number.isSafeInteger(update.receivedBytes) ||
      !LOCAL_WHISPER_ARTIFACT_ACTIONS.includes(update.action) ||
      update.receivedBytes < 0 ||
      !Number.isSafeInteger(update.totalBytes) ||
      update.totalBytes <= 0 ||
      update.receivedBytes > update.totalBytes ||
      (update.queuedPosition !== undefined &&
        update.queuedPosition !== null &&
        (!Number.isSafeInteger(update.queuedPosition) || update.queuedPosition <= 0))
    ) {
      throw new TypeError('Invalid Local Whisper artifact progress');
    }
  }
}
