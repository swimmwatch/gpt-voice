import type { LocalWhisperSnapshotFacts, LocalWhisperSnapshotFactsPort } from './LocalWhisperSnapshotService';

/** Supplies immutable startup facts until authenticated catalog and inventory adapters are composed. */
export class StaticLocalWhisperSnapshotFacts implements LocalWhisperSnapshotFactsPort {
  public constructor(public readonly snapshot: LocalWhisperSnapshotFacts) {}

  /** Replays the immutable facts once; no later revisions exist for this adapter. */
  public subscribe(listener: (facts: LocalWhisperSnapshotFacts) => void): () => void {
    listener(this.snapshot);
    return () => undefined;
  }
}
