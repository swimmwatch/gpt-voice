import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  PRODUCTION_SIGNING_ENVIRONMENT,
  ProductionSigningAuthority,
} from '@scripts/local-whisper/release-policy/ProductionSigningAuthority';

function keyPair(): Readonly<{ privateKeyPem: string; publicKeyPem: string }> {
  const pair = generateKeyPairSync('ed25519');
  return Object.freeze({
    privateKeyPem: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  });
}

describe('ProductionSigningAuthority', () => {
  it('loads the protected environment pair and signs catalog and artifact inputs with distinct contracts', () => {
    const pair = keyPair();
    const authority = ProductionSigningAuthority.fromEnvironment({
      [PRODUCTION_SIGNING_ENVIRONMENT.keyId]: 'production-ed25519-v1',
      [PRODUCTION_SIGNING_ENVIRONMENT.privateKeyPem]: pair.privateKeyPem,
      [PRODUCTION_SIGNING_ENVIRONMENT.publicKeyPem]: pair.publicKeyPem,
    });
    const bytes = Buffer.from('candidate bytes', 'utf8');
    const catalog = authority.signCatalogPayload(bytes);
    const artifact = authority.signArtifact(bytes);
    const artifactFromDigest = authority.signArtifactDigestSha256(createHash('sha256').update(bytes).digest('hex'));

    assert.equal(catalog.keyId, 'production-ed25519-v1');
    assert.equal(catalog.algorithm, 'Ed25519');
    assert.equal(verify(null, bytes, pair.publicKeyPem, Buffer.from(catalog.signatureBase64, 'base64')), true);
    assert.equal(
      verify(
        null,
        createHash('sha256').update(bytes).digest(),
        pair.publicKeyPem,
        Buffer.from(artifact.signatureBase64, 'base64'),
      ),
      true,
    );
    assert.equal(artifactFromDigest.signatureBase64, artifact.signatureBase64);
    assert.notEqual(catalog.signatureBase64, artifact.signatureBase64);
    assert.equal(authority.exportPublicKeyPem(), pair.publicKeyPem);
  });

  it('rejects missing, malformed, non-Ed25519, and mismatched signing inputs', () => {
    const left = keyPair();
    const right = keyPair();
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });

    assert.throws(() => ProductionSigningAuthority.fromEnvironment({}), /unavailable/u);
    assert.throws(
      () => new ProductionSigningAuthority('../invalid', left.privateKeyPem, left.publicKeyPem),
      /identity/u,
    );
    assert.throws(
      () => new ProductionSigningAuthority('production-ed25519-v1', 'not a key', left.publicKeyPem),
      /material/u,
    );
    assert.throws(
      () =>
        new ProductionSigningAuthority(
          'production-rsa-v1',
          rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
          rsa.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        ),
      /Ed25519/u,
    );
    assert.throws(
      () => new ProductionSigningAuthority('production-ed25519-v1', left.privateKeyPem, right.publicKeyPem),
      /does not match/u,
    );
  });
});
