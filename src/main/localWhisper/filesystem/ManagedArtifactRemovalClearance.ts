import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import { MANAGED_ARTIFACT_REMOVAL_CLEARANCE_AUTHORITY } from './ManagedArtifactRemovalClearanceAuthority';
import { ManagedArtifactStoreError } from './ManagedArtifactStoreError';

/** Coordinator-issued exact removal clearance; no renderer input can satisfy the private brand. */
export class ManagedArtifactRemovalClearance {
  readonly #clearance: boolean;

  public constructor(
    authority: symbol,
    public readonly artifactId: LocalWhisperArtifactId,
  ) {
    this.#clearance = authority === MANAGED_ARTIFACT_REMOVAL_CLEARANCE_AUTHORITY;
    if (!this.#clearance) throw new ManagedArtifactStoreError('INVALID_CLEARANCE');
  }

  public authorizes(artifactId: LocalWhisperArtifactId): boolean {
    return this.#clearance && artifactId === this.artifactId;
  }

  public toJSON(): never {
    throw new ManagedArtifactStoreError('INVALID_CLEARANCE');
  }
}
