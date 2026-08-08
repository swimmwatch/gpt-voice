import { verify } from 'node:crypto';

import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { LocalWhisperCatalogPublicKey } from '../catalog/LocalWhisperCatalogTypes';
import type { ArtifactSignatureVerifier } from './ArtifactLifecycleTypes';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

/** Verifies runtime signatures over the authenticated 32-byte SHA-256 signature input. */
export class CatalogArtifactSignatureVerifier implements ArtifactSignatureVerifier {
  private readonly keys: ReadonlyMap<LocalWhisperArtifactId, string>;

  public constructor(publicKeys: readonly LocalWhisperCatalogPublicKey[]) {
    this.keys = new Map(publicKeys.map(({ keyId, publicKeyPem }) => [keyId, publicKeyPem]));
  }

  public async verify(input: {
    readonly digest: string;
    readonly keyId: LocalWhisperArtifactId;
    readonly signatureBase64: string;
  }): Promise<boolean> {
    const publicKey = this.keys.get(input.keyId);
    if (!publicKey || !SHA256_PATTERN.test(input.digest)) return false;
    try {
      const signature = Buffer.from(input.signatureBase64, 'base64');
      if (signature.toString('base64') !== input.signatureBase64) return false;
      return verify(null, Buffer.from(input.digest, 'hex'), publicKey, signature);
    } catch {
      return false;
    }
  }
}
