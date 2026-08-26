export type SelectedTextAction = 'translate' | 'prettify';

/** Owns cross-action serialization for one main-process composition graph. */
export class SelectedTextActionGate {
  private activeAction: SelectedTextAction | null = null;
  private readonly listeners = new Set<(action: SelectedTextAction | null) => void>();

  public tryBegin(action: SelectedTextAction): boolean {
    if (this.activeAction) return false;
    this.activeAction = action;
    this.publish();
    return true;
  }

  public finish(action: SelectedTextAction): void {
    if (this.activeAction !== action) return;
    this.activeAction = null;
    this.publish();
  }

  public getActive(): SelectedTextAction | null {
    return this.activeAction;
  }

  public reset(): void {
    if (this.activeAction === null) return;
    this.activeAction = null;
    this.publish();
  }

  public subscribe(listener: (action: SelectedTextAction | null) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  private publish(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.activeAction);
      } catch {
        // Activity presentation must never affect the selected-text operation.
      }
    }
  }
}
