/** Owns the caller abort signal for one selected-text translation workflow. */
export class SelectedTextTranslationOperation {
  public readonly controller = new AbortController();

  public get cancelled(): boolean {
    return this.controller.signal.aborted;
  }

  public cancel(): boolean {
    if (this.cancelled) return false;
    try {
      this.controller.abort();
      return true;
    } catch {
      return false;
    }
  }
}
