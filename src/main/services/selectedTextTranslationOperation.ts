/** Owns the caller abort signal for one selected-text translation workflow. */
export class SelectedTextTranslationOperation {
  public readonly controller = new AbortController();
  private providerRunStarted = false;

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

  /** Claims the one observer notification for a real provider run. */
  public markProviderRunStarted(): boolean {
    if (this.cancelled || this.providerRunStarted) return false;
    this.providerRunStarted = true;
    return true;
  }
}
