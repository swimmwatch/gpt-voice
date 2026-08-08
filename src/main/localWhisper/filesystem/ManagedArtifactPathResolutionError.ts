/** Stable content-free failure for an unprovable environment-derived storage base. */
export class ManagedArtifactPathResolutionError extends Error {
  public constructor(public readonly code: 'INVALID_STORAGE_BASE') {
    super(code);
    this.name = 'ManagedArtifactPathResolutionError';
  }
}
