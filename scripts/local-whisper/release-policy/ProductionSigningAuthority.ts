import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';

const PRODUCTION_SIGNING_KEY_ID_PATTERN = /^[\dA-Za-z][\w.-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f\d]{64}$/u;

export const PRODUCTION_SIGNING_ENVIRONMENT = Object.freeze({
  keyId: 'CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_ID',
  privateKeyPem: 'CI_LOCAL_WHISPER_PRODUCTION_SIGNING_KEY_PEM',
  publicKeyPem: 'CI_LOCAL_WHISPER_PRODUCTION_SIGNING_PUBLIC_KEY_PEM',
});

export interface ProductionDetachedSignature {
  readonly algorithm: 'Ed25519';
  readonly keyId: string;
  readonly signatureBase64: string;
}

function requiredEnvironmentValue(environment: Readonly<NodeJS.ProcessEnv>, name: string): string {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Production signing authority is unavailable');
  }
  return value;
}

/** Owns the protected production signing capability without retaining PEM text. */
export class ProductionSigningAuthority {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  public constructor(
    public readonly keyId: string,
    privateKeyPem: string,
    publicKeyPem: string,
  ) {
    if (!PRODUCTION_SIGNING_KEY_ID_PATTERN.test(keyId)) {
      throw new Error('Production signing key identity is invalid');
    }

    try {
      this.privateKey = createPrivateKey(privateKeyPem);
      this.publicKey = createPublicKey(publicKeyPem);
    } catch {
      throw new Error('Production signing key material is invalid');
    }

    if (this.privateKey.asymmetricKeyType !== 'ed25519' || this.publicKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('Production signing authority requires Ed25519 keys');
    }

    const derivedPublicKey = createPublicKey(this.privateKey).export({ format: 'der', type: 'spki' });
    const declaredPublicKey = this.publicKey.export({ format: 'der', type: 'spki' });
    if (!Buffer.from(derivedPublicKey).equals(Buffer.from(declaredPublicKey))) {
      throw new Error('Production signing key pair does not match');
    }
  }

  public static fromEnvironment(environment: Readonly<NodeJS.ProcessEnv>): ProductionSigningAuthority {
    return new ProductionSigningAuthority(
      requiredEnvironmentValue(environment, PRODUCTION_SIGNING_ENVIRONMENT.keyId),
      requiredEnvironmentValue(environment, PRODUCTION_SIGNING_ENVIRONMENT.privateKeyPem),
      requiredEnvironmentValue(environment, PRODUCTION_SIGNING_ENVIRONMENT.publicKeyPem),
    );
  }

  /** Catalog envelopes sign their canonical payload bytes directly. */
  public signCatalogPayload(payload: Uint8Array): ProductionDetachedSignature {
    return this.signBytes(payload);
  }

  /** Release assets sign the SHA-256 digest bytes bound by their manifests. */
  public signArtifact(artifact: Uint8Array): ProductionDetachedSignature {
    return this.signBytes(createHash('sha256').update(artifact).digest());
  }

  /** Signs a previously streamed and verified artifact digest without buffering release-sized bytes. */
  public signArtifactDigestSha256(sha256: string): ProductionDetachedSignature {
    if (!SHA256_PATTERN.test(sha256)) throw new Error('Production artifact digest is invalid');
    return this.signBytes(Buffer.from(sha256, 'hex'));
  }

  public exportPublicKeyPem(): string {
    return this.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  }

  private signBytes(bytes: Uint8Array): ProductionDetachedSignature {
    return Object.freeze({
      algorithm: 'Ed25519',
      keyId: this.keyId,
      signatureBase64: sign(null, bytes, this.privateKey).toString('base64'),
    });
  }
}
