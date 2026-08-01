import type { LocalWhisperArtifactId, LocalWhisperRendererSafeFailure } from '@shared/localWhisper';

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
  readonly state: LocalWhisperArtifactOperationState;
  readonly receivedBytes: number;
  readonly totalBytes: number;
  readonly queuedPosition?: number | null;
  readonly failure?: LocalWhisperRendererSafeFailure | null;
}

/** Owns immutable, renderer-safe progress with chunk-update rate limiting. */
export class ArtifactProgressStore {
  private readonly snapshots = new Map<LocalWhisperArtifactOperationId, LocalWhisperArtifactProgressSnapshot>();

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
      state: update.state,
      receivedBytes: update.receivedBytes,
      totalBytes: update.totalBytes,
      queuedPosition: update.queuedPosition ?? null,
      updatedAtMs: now,
      failure: update.failure ?? null,
    });
    this.snapshots.set(update.operationId, snapshot);
    return snapshot;
  }

  public get(operationId: LocalWhisperArtifactOperationId): LocalWhisperArtifactProgressSnapshot | null {
    return this.snapshots.get(operationId) ?? null;
  }

  public list(): readonly LocalWhisperArtifactProgressSnapshot[] {
    return Object.freeze([...this.snapshots.values()]);
  }

  private assertUpdate(update: ArtifactProgressUpdate): void {
    if (
      !Number.isSafeInteger(update.receivedBytes) ||
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
