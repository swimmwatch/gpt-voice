/** Stable lock API failure. */
export class ManagedArtifactLockError extends Error {
  public constructor(public readonly code: 'LOCK_NOT_SERIALIZABLE') {
    super(code);
    this.name = 'ManagedArtifactLockError';
  }
}
