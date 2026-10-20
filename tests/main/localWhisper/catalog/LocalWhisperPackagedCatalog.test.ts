import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LocalWhisperPackagedCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperPackagedCatalog';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';
import { createQualificationCatalogPayload } from '../../../fixtures/local-whisper/catalog/qualificationCatalogSigner';

const RESOURCES_ROOT = '/tmp/local-whisper-packaged-catalog-test';
const SHARED_ROOT = path.join(RESOURCES_ROOT, 'local-whisper');
const KEY_ID = 'production-test-packaged-key-v1';

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function document(value: unknown): Buffer {
  return Buffer.from(serializeCanonicalLocalWhisperCatalogJson(value), 'utf8');
}

function packagedCatalog() {
  const pair = generateKeyPairSync('ed25519');
  const source = createQualificationCatalogPayload();
  const payload = document({ ...source, purpose: 'production' });
  const catalog = document({
    algorithm: 'Ed25519',
    keyId: KEY_ID,
    payloadBase64: payload.toString('base64'),
    schemaVersion: 1,
    signatureBase64: sign(null, payload, pair.privateKey).toString('base64'),
  });
  const keyring = {
    appRevision: source.compatibleAppRevisions[0],
    origins: source.origins,
    publicKeys: [{ keyId: KEY_ID, publicKeyPem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString() }],
    purpose: 'production',
    schemaVersion: 1,
    workerProtocolVersion: source.workerProtocolVersion,
  };
  const keyringBytes = document(keyring);
  const manifest = {
    catalogSha256: digest(catalog),
    createdBy: 'external-production-authority',
    files: [
      { path: 'catalog.json', sha256: digest(catalog), sizeBytes: catalog.byteLength },
      { path: 'keyring.json', sha256: digest(keyringBytes), sizeBytes: keyringBytes.byteLength },
    ],
    keyId: KEY_ID,
    purpose: 'production',
    schemaVersion: 1,
    synthetic: false,
  };
  const state = {
    bundleManifestSha256: digest(document(manifest)),
    catalogSha256: digest(catalog),
    executableActionsEnabled: true,
    mode: 'production',
    platform: 'linux',
    purpose: 'production',
    schemaVersion: 1,
    signingKeyId: KEY_ID,
  };
  const files = new Map([
    ['catalog-state.json', document(state)],
    ['bundle-manifest.json', document(manifest)],
    ['keyring.json', keyringBytes],
    ['catalog.json', catalog],
  ]);
  const reads: string[] = [];
  const repository = new LocalWhisperPackagedCatalogRepository({
    bundleManifestSha256: digest(document(manifest)),
    appRevision: String(keyring.appRevision),
    platform: 'linux',
    readFile: (filePath) => {
      reads.push(filePath);
      assert.equal(path.dirname(filePath), SHARED_ROOT);
      const bytes = files.get(path.basename(filePath));
      return bytes ? Promise.resolve(bytes) : Promise.reject(new Error('ENOENT'));
    },
    resourcesPath: RESOURCES_ROOT,
    workerProtocolVersion: source.workerProtocolVersion,
  });
  return { catalog, files, keyring, manifest, reads, repository, state };
}

describe('LocalWhisperPackagedCatalogRepository', () => {
  it('loads production authority from package resources without reading a user profile', async () => {
    const fixture = packagedCatalog();
    const loaded = await fixture.repository.load();
    assert.ok(loaded?.trustPolicy);
    assert.deepEqual(Buffer.from(loaded.document), fixture.catalog);
    assert.equal(loaded.trustPolicy.purpose, 'production');
    assert.equal(loaded.trustPolicy.publicKeys[0]?.keyId, KEY_ID);
    assert.ok(fixture.reads.every((filePath) => path.dirname(filePath) === SHARED_ROOT));
  });

  for (const mode of ['disabled', 'fixture', 'qualification']) {
    it(`rejects ${mode} package authority before reading keys or catalog`, async () => {
      const fixture = packagedCatalog();
      fixture.files.set('catalog-state.json', document({ ...fixture.state, mode, purpose: mode }));
      assert.equal(await fixture.repository.load(), null);
      assert.equal(fixture.reads.length, 1);
    });
  }

  for (const patch of [
    { platform: 'win32' },
    { executableActionsEnabled: false },
    { schemaVersion: 2 },
    { signingKeyId: 'different-key' },
    { bundleManifestSha256: '0'.repeat(64) },
    { catalogSha256: '0'.repeat(64) },
  ]) {
    it(`rejects inconsistent package state ${Object.keys(patch)[0]}`, async () => {
      const fixture = packagedCatalog();
      fixture.files.set('catalog-state.json', document({ ...fixture.state, ...patch }));
      assert.equal(await fixture.repository.load(), null);
    });
  }

  it('rejects missing resources, substituted keyrings, and noncanonical state', async () => {
    const missing = packagedCatalog();
    missing.files.delete('catalog-state.json');
    assert.equal(await missing.repository.load(), null);
    const substituted = packagedCatalog();
    substituted.files.set('keyring.json', document({ ...substituted.keyring, appRevision: 'other-app' }));
    assert.equal(await substituted.repository.load(), null);
    const noncanonical = packagedCatalog();
    noncanonical.files.set('catalog-state.json', Buffer.from(JSON.stringify(noncanonical.state, null, 2)));
    assert.equal(await noncanonical.repository.load(), null);
  });

  it('rejects coordinated replacement of state, manifest, keys and catalog against the independent build pin', async () => {
    const trusted = packagedCatalog();
    const substituted = packagedCatalog();
    for (const [name, bytes] of substituted.files) trusted.files.set(name, bytes);
    assert.equal(await trusted.repository.load(), null);
  });

  it('leaves signature authentication to the existing catalog verifier without granting invalid bytes authority', async () => {
    const fixture = packagedCatalog();
    const envelope = JSON.parse(fixture.catalog.toString('utf8')) as Record<string, unknown>;
    const invalid = document({ ...envelope, signatureBase64: 'AAAA' });
    const loaded = await fixture.repository.load();
    assert.ok(loaded?.trustPolicy);
    const result = new LocalWhisperCatalogRepository({
      readDocument: () => invalid,
      trustPolicy: loaded.trustPolicy,
    }).load();
    assert.equal(result.success, false);
  });
});
