import {
  getLocalWhisperModelIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  createManagedModelDescriptor,
  type ManagedArtifactDescriptor,
  type ManagedModelPathLoadLease,
} from '../filesystem/ManagedArtifactStore';
import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';

export interface LocalWhisperModelPathLoadLeasePort {
  leaseInstalledModelPathForLoad(descriptor: ManagedArtifactDescriptor): Promise<ManagedModelPathLoadLease>;
}

export interface LocalWhisperModelPathLoadAuthority {
  readonly modelFilePath: string;
  readonly modelFileSizeBytes: number;
  readonly modelLease: ManagedArtifactLease;
  readonly operationNonce: Uint8Array;
  readonly revalidate: () => Promise<void>;
}

export interface LocalWhisperModelPathLoadAuthorityFactoryDependencies {
  readonly randomBytes: (size: number) => Uint8Array;
  readonly store: LocalWhisperModelPathLoadLeasePort;
}

/** Owns catalog selection and a metadata-only managed lease for one standard model-path load. */
export class LocalWhisperModelPathLoadAuthorityFactory {
  public constructor(private readonly dependencies: LocalWhisperModelPathLoadAuthorityFactoryDependencies) {}

  public async acquire(
    catalog: LocalWhisperAuthenticatedCatalog,
    model: LocalWhisperCatalogModelEntry,
  ): Promise<LocalWhisperModelPathLoadAuthority> {
    if (
      model.identity.engine !== 'whisperCpp' ||
      model.identity.nativeFormat !== 'ggml' ||
      catalog.isModelDenylisted(getLocalWhisperModelIdentityKey(model.identity))
    ) {
      throw new Error('Local Whisper model load identity invalid');
    }
    const operationNonce = Uint8Array.from(this.dependencies.randomBytes(16));
    if (operationNonce.byteLength !== 16 || operationNonce.every((value) => value === 0)) {
      throw new Error('Local Whisper model operation nonce invalid');
    }
    const leased = await this.dependencies.store.leaseInstalledModelPathForLoad(
      createManagedModelDescriptor(catalog, model),
    );
    return Object.freeze({
      modelFilePath: leased.modelFilePath,
      modelFileSizeBytes: leased.modelFileSizeBytes,
      modelLease: leased.modelLease,
      operationNonce,
      revalidate: leased.revalidate,
    });
  }
}
