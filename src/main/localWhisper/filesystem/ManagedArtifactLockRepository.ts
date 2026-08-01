import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLeasePurpose } from './ManagedArtifactLease';
import { ManagedArtifactLockLease } from './ManagedArtifactLockLease';
import type { ManagedFilesystemPlatformAdapter } from './ManagedFilesystemPlatformAdapter';

export { ManagedArtifactLockLease } from './ManagedArtifactLockLease';

export interface ManagedArtifactLockRepositoryDependencies {
  readonly adapter: ManagedFilesystemPlatformAdapter;
  readonly appInstanceNonce: string;
  readonly osProcessStartIdentity: string;
  readonly pid: number;
}

/** Acquires exact per-artifact locks; stale-owner classification remains native and identity-based. */
export class ManagedArtifactLockRepository {
  public constructor(private readonly dependencies: ManagedArtifactLockRepositoryDependencies) {}

  public async acquire(
    rootToken: string,
    artifactId: LocalWhisperArtifactId,
    canonicalArtifactName: string,
    purpose: ManagedArtifactLeasePurpose,
  ): Promise<ManagedArtifactLockLease> {
    const native = await this.dependencies.adapter.acquireArtifactLock(rootToken, canonicalArtifactName, {
      appInstanceNonce: this.dependencies.appInstanceNonce,
      artifactId,
      operation: purpose,
      osProcessStartIdentity: this.dependencies.osProcessStartIdentity,
      pid: this.dependencies.pid,
    });
    return new ManagedArtifactLockLease(this.dependencies.adapter, native, artifactId, purpose);
  }
}
