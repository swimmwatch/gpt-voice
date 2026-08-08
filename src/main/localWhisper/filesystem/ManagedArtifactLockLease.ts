import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLeasePurpose } from './ManagedArtifactLease';
import { ManagedArtifactLockError } from './ManagedArtifactLockError';

/** Non-serializable cross-process artifact lock backed by a held native file identity. */
export class ManagedArtifactLockLease {
  readonly #releaseNative: () => Promise<void>;
  #released = false;

  public constructor(
    public readonly artifactId: LocalWhisperArtifactId,
    public readonly purpose: ManagedArtifactLeasePurpose,
    releaseNative: () => Promise<void>,
  ) {
    this.#releaseNative = releaseNative;
  }

  public get released(): boolean {
    return this.#released;
  }

  public async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    await this.#releaseNative();
  }

  public toJSON(): never {
    throw new ManagedArtifactLockError('LOCK_NOT_SERIALIZABLE');
  }
}
