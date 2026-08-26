export type ManagedArtifactStoreErrorCode =
  | 'ARTIFACT_MISSING'
  | 'ARTIFACT_UNPROVABLE'
  | 'DELETE_FAILED'
  | 'INSTALL_FAILED'
  | 'INVALID_ARTIFACT'
  | 'INVALID_CLEARANCE'
  | 'INVALID_LEASE'
  | 'INVALID_NONCE'
  | 'OPERATION_CONFLICT'
  | 'PLANNED_UNAVAILABLE'
  | 'STORAGE_UNAVAILABLE'
  | 'UNSUPPORTED_PLATFORM';

/** Stable content-free store failure; no native path, file ID, or OS message is exposed. */
export class ManagedArtifactStoreError extends Error {
  public constructor(public readonly code: ManagedArtifactStoreErrorCode) {
    super(code);
    this.name = 'ManagedArtifactStoreError';
  }
}
