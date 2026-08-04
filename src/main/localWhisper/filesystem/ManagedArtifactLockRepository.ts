import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLeasePurpose } from './ManagedArtifactLease';
import { ManagedArtifactLockLease } from './ManagedArtifactLockLease';
import type { ManagedFilesystemOpenResult, ManagedFilesystemPlatformAdapter } from './ManagedFilesystemPlatformAdapter';

export { ManagedArtifactLockLease } from './ManagedArtifactLockLease';

export interface ManagedArtifactLockRepositoryDependencies {
  readonly adapter: ManagedFilesystemPlatformAdapter;
  readonly appInstanceNonce: string;
  readonly osProcessStartIdentity: string;
  readonly pid: number;
}

interface SharedReadLock {
  readonly canonicalArtifactName: string;
  readonly native: ManagedFilesystemOpenResult;
  references: number;
}

const SHARED_READ_PURPOSES: ReadonlySet<ManagedArtifactLeasePurpose> = new Set(['integrity', 'load', 'verify']);

/** Acquires exact per-artifact locks; stale-owner classification remains native and identity-based. */
export class ManagedArtifactLockRepository {
  private readonly sharedReadLocks = new Map<LocalWhisperArtifactId, SharedReadLock>();

  public constructor(private readonly dependencies: ManagedArtifactLockRepositoryDependencies) {}

  public async acquire(
    rootToken: string,
    artifactId: LocalWhisperArtifactId,
    canonicalArtifactName: string,
    purpose: ManagedArtifactLeasePurpose,
  ): Promise<ManagedArtifactLockLease> {
    const existing = this.sharedReadLocks.get(artifactId);
    if (existing && existing.canonicalArtifactName === canonicalArtifactName && SHARED_READ_PURPOSES.has(purpose)) {
      existing.references += 1;
      return this.createSharedReadLease(artifactId, purpose, existing);
    }
    const native = await this.dependencies.adapter.acquireArtifactLock(rootToken, canonicalArtifactName, {
      appInstanceNonce: this.dependencies.appInstanceNonce,
      artifactId,
      operation: purpose,
      osProcessStartIdentity: this.dependencies.osProcessStartIdentity,
      pid: this.dependencies.pid,
    });
    if (SHARED_READ_PURPOSES.has(purpose)) {
      const shared: SharedReadLock = { canonicalArtifactName, native, references: 1 };
      this.sharedReadLocks.set(artifactId, shared);
      return this.createSharedReadLease(artifactId, purpose, shared);
    }
    return new ManagedArtifactLockLease(artifactId, purpose, () => this.dependencies.adapter.release(native.token));
  }

  private createSharedReadLease(
    artifactId: LocalWhisperArtifactId,
    purpose: ManagedArtifactLeasePurpose,
    shared: SharedReadLock,
  ): ManagedArtifactLockLease {
    return new ManagedArtifactLockLease(artifactId, purpose, async () => {
      shared.references -= 1;
      if (shared.references > 0) return;
      if (this.sharedReadLocks.get(artifactId) === shared) this.sharedReadLocks.delete(artifactId);
      await this.dependencies.adapter.release(shared.native.token);
    });
  }
}
