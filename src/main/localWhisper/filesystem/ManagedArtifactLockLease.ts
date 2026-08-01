import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLeasePurpose } from './ManagedArtifactLease';
import { ManagedArtifactLockError } from './ManagedArtifactLockError';
import type { ManagedFilesystemOpenResult, ManagedFilesystemPlatformAdapter } from './ManagedFilesystemPlatformAdapter';

/** Non-serializable cross-process artifact lock backed by a held native file identity. */
export class ManagedArtifactLockLease {
  readonly #adapter: ManagedFilesystemPlatformAdapter;
  readonly #nativeToken: string;
  #released = false;

  public constructor(
    adapter: ManagedFilesystemPlatformAdapter,
    native: ManagedFilesystemOpenResult,
    public readonly artifactId: LocalWhisperArtifactId,
    public readonly purpose: ManagedArtifactLeasePurpose,
  ) {
    this.#adapter = adapter;
    this.#nativeToken = native.token;
  }

  public get released(): boolean {
    return this.#released;
  }

  public async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    await this.#adapter.release(this.#nativeToken);
  }

  public toJSON(): never {
    throw new ManagedArtifactLockError('LOCK_NOT_SERIALIZABLE');
  }
}
