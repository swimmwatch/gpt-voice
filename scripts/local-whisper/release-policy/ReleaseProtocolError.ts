/** Fail-closed error code that is safe to expose in deterministic policy checks. */
export class ReleaseProtocolError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'ReleaseProtocolError';
  }
}
