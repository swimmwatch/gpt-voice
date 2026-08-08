import type { LocalWhisperSnapshotFacts, LocalWhisperSnapshotFactsPort } from '../ipc/LocalWhisperSnapshotService';

/** Owns renderer-safe catalog and inventory facts for one main-process graph. */
export class LocalWhisperDynamicSnapshotFacts implements LocalWhisperSnapshotFactsPort {
  private readonly listeners = new Set<(facts: LocalWhisperSnapshotFacts) => void>();
  private snapshotValue: LocalWhisperSnapshotFacts;
  private disposed = false;

  public constructor(initial: LocalWhisperSnapshotFacts) {
    this.snapshotValue = initial;
  }

  public get snapshot(): LocalWhisperSnapshotFacts {
    return this.snapshotValue;
  }

  public subscribe(listener: (facts: LocalWhisperSnapshotFacts) => void): () => void {
    if (this.disposed) throw new Error('Local Whisper facts disposed');
    this.listeners.add(listener);
    listener(this.snapshotValue);
    return () => this.listeners.delete(listener);
  }

  public update(snapshot: LocalWhisperSnapshotFacts): void {
    if (this.disposed) throw new Error('Local Whisper facts disposed');
    this.snapshotValue = snapshot;
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
  }
}
