import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import { ManagedArtifactLeaseError } from './ManagedArtifactLeaseError';

export type ManagedArtifactKind = 'model' | 'runtime';
export type ManagedArtifactLeasePurpose =
  'delete' | 'integrity' | 'load' | 'promote' | 'quarantine' | 'staging' | 'verify';

export interface ManagedArtifactIdentitySnapshot {
  readonly deviceOrVolumeId: string;
  readonly fileId: string;
  readonly linkCount: number;
  readonly mode: number;
  readonly parentFileId: string;
  readonly sizeBytes: number;
  readonly type: 'directory' | 'regular';
}

export interface ManagedArtifactLeaseMetadata {
  readonly artifactId: LocalWhisperArtifactId;
  readonly artifactKind: ManagedArtifactKind;
  readonly canonicalName: string;
  readonly catalogDigest: string;
  readonly identity: ManagedArtifactIdentitySnapshot;
  readonly purpose: ManagedArtifactLeasePurpose;
}

/**
 * Main-owned authority tied to a held native descriptor/handle. The native
 * token and release callback are ECMAScript-private, and serialization is
 * deliberately rejected so renderer/worker messages cannot manufacture or
 * persist authority.
 */
export class ManagedArtifactLease {
  readonly #nativeToken: string;
  readonly #release: (token: string) => Promise<void>;
  #released = false;

  public constructor(
    public readonly metadata: ManagedArtifactLeaseMetadata,
    nativeToken: string,
    release: (token: string) => Promise<void>,
  ) {
    this.#nativeToken = nativeToken;
    this.#release = release;
  }

  public get released(): boolean {
    return this.#released;
  }

  public assertActive(): void {
    if (this.#released) throw new ManagedArtifactLeaseError('LEASE_RELEASED');
  }

  public nativeToken(owner: symbol, expectedOwner: symbol): string {
    this.assertActive();
    if (owner !== expectedOwner) throw new ManagedArtifactLeaseError('LEASE_OWNER_MISMATCH');
    return this.#nativeToken;
  }

  public async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    await this.#release(this.#nativeToken);
  }

  public toJSON(): never {
    throw new ManagedArtifactLeaseError('LEASE_NOT_SERIALIZABLE');
  }
}
