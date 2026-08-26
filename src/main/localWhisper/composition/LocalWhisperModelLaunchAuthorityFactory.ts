import {
  getLocalWhisperModelIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  createManagedModelDescriptor,
  type ManagedArtifactDescriptor,
  type ManagedModelLaunchLease,
} from '../filesystem/ManagedArtifactStore';
import type { LocalWhisperModelGuardLaunchAuthority } from '../supervisor/WorkerProcessOwnership';

export interface LocalWhisperModelLaunchLeasePort {
  leaseInstalledModelForLaunch(descriptor: ManagedArtifactDescriptor): Promise<ManagedModelLaunchLease>;
}

export interface LocalWhisperModelLaunchAuthorityFactoryDependencies {
  readonly randomBytes: (size: number) => Uint8Array;
  readonly store: LocalWhisperModelLaunchLeasePort;
}

/** @deprecated Retained for rollback/reference tests; production uses metadata-only path load authority. */
export class LocalWhisperModelLaunchAuthorityFactory {
  public constructor(private readonly dependencies: LocalWhisperModelLaunchAuthorityFactoryDependencies) {}

  public async acquire(
    catalog: LocalWhisperAuthenticatedCatalog,
    model: LocalWhisperCatalogModelEntry,
  ): Promise<LocalWhisperModelGuardLaunchAuthority> {
    if (
      model.identity.engine !== 'whisperCpp' ||
      model.identity.nativeFormat !== 'ggml' ||
      catalog.isModelDenylisted(getLocalWhisperModelIdentityKey(model.identity))
    ) {
      throw new Error('Local Whisper model launch identity invalid');
    }
    const operationNonce = Uint8Array.from(this.dependencies.randomBytes(16));
    if (operationNonce.byteLength !== 16 || operationNonce.every((value) => value === 0)) {
      throw new Error('Local Whisper model operation nonce invalid');
    }
    const leased = await this.dependencies.store.leaseInstalledModelForLaunch(
      createManagedModelDescriptor(catalog, model),
    );
    return Object.freeze({
      modelFileIdentity: leased.modelFileIdentity,
      modelFilePath: leased.modelFilePath,
      modelFileSha256: leased.modelFileSha256,
      modelFileSizeBytes: leased.modelFileSizeBytes,
      modelIdentityKey: getLocalWhisperModelIdentityKey(model.identity),
      modelLease: leased.modelLease,
      modelLeaseTokenDigest: leased.modelLeaseTokenDigest,
      operationNonce,
      revalidate: leased.revalidate,
    });
  }
}
