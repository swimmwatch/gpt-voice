export type SelectedTextAction = 'translate' | 'prettify';

/** Owns cross-action serialization for one main-process composition graph. */
export class SelectedTextActionGate {
  private activeAction: SelectedTextAction | null = null;

  public tryBegin(action: SelectedTextAction): boolean {
    if (this.activeAction) return false;
    this.activeAction = action;
    return true;
  }

  public finish(action: SelectedTextAction): void {
    if (this.activeAction === action) this.activeAction = null;
  }

  public getActive(): SelectedTextAction | null {
    return this.activeAction;
  }

  public reset(): void {
    this.activeAction = null;
  }
}
