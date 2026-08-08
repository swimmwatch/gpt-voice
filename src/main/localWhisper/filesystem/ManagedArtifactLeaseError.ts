/** Stable content-free error for invalid lease use. */
export class ManagedArtifactLeaseError extends Error {
  public constructor(public readonly code: 'LEASE_NOT_SERIALIZABLE' | 'LEASE_OWNER_MISMATCH' | 'LEASE_RELEASED') {
    super(code);
    this.name = 'ManagedArtifactLeaseError';
  }
}
