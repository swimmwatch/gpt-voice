import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import type {
  LocalWhisperCatalogModelEntry,
  LocalWhisperCatalogOrigin,
  LocalWhisperCatalogRuntimeEntry,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import type { LocalWhisperLanguageCatalogEntry, LocalWhisperMemoryEstimateRecord } from '@shared/localWhisper';
import { toLocalWhisperRevisionId } from '@shared/localWhisper';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

function createRepository(document: Uint8Array, trustPolicy = createFixtureCatalogTrustPolicy()) {
  return new LocalWhisperCatalogRepository({ readDocument: () => document, trustPolicy });
}

function mutateEnvelope(document: Uint8Array, mutate: (envelope: Record<string, unknown>) => void): Uint8Array {
  const envelope = JSON.parse(Buffer.from(document).toString('utf8')) as Record<string, unknown>;
  mutate(envelope);
  return Buffer.from(JSON.stringify(envelope), 'utf8');
}

describe('LocalWhisperCatalogRepository', () => {
  it('loads deterministic canonical payload bytes only after Ed25519 authentication', () => {
    const payload = createFixtureCatalogPayload();
    const first = signFixtureCatalog(payload);
    const second = signFixtureCatalog(payload);
    assert.deepEqual(first, second);

    const loaded = createRepository(first).load();

    assert.equal(loaded.success, true);
    if (!loaded.success) return;
    assert.equal(loaded.catalog.payload.catalogRevision, 'fixture-catalog-v1');
    assert.equal(loaded.catalog.payload.runtimes.length, 1);
    assert.equal(loaded.catalog.payload.models.length, 1);
    assert.equal(loaded.catalog.payload.memoryEstimates[0].estimatedPeakRamBytes, 2_000_000_000);
  });

  it('rejects payload mutation, signature mutation, unknown key IDs, and document-supplied trust roots', () => {
    const document = signFixtureCatalog(createFixtureCatalogPayload());
    const payloadMutation = mutateEnvelope(document, (envelope) => {
      const bytes = Buffer.from(envelope.payloadBase64 as string, 'base64');
      bytes[bytes.length - 2] ^= 1;
      envelope.payloadBase64 = bytes.toString('base64');
    });
    const signatureMutation = mutateEnvelope(document, (envelope) => {
      const bytes = Buffer.from(envelope.signatureBase64 as string, 'base64');
      bytes[0] ^= 1;
      envelope.signatureBase64 = bytes.toString('base64');
    });
    const unknownKey = mutateEnvelope(document, (envelope) => {
      envelope.keyId = 'unknown-catalog-key';
    });
    const embeddedKeyPayload = {
      ...createFixtureCatalogPayload(),
      publicKeys: [{ keyId: 'document-key', publicKeyPem: 'untrusted' }],
    };

    assert.deepEqual(createRepository(payloadMutation).load(), { success: false, code: 'SIGNATURE_INVALID' });
    assert.deepEqual(createRepository(signatureMutation).load(), { success: false, code: 'SIGNATURE_INVALID' });
    assert.deepEqual(createRepository(unknownKey).load(), { success: false, code: 'SIGNATURE_INVALID' });
    assert.deepEqual(createRepository(signFixtureCatalog(embeddedKeyPayload)).load(), {
      success: false,
      code: 'CATALOG_INVALID',
    });
  });

  it('rejects duplicate identities, incomplete memory matrices, unsafe estimates, and stale configuration keys', () => {
    const duplicate = createFixtureCatalogPayload();
    (duplicate.runtimes as LocalWhisperCatalogRuntimeEntry[]).push(structuredClone(duplicate.runtimes[0]));

    const missingEstimate = createFixtureCatalogPayload();
    (missingEstimate.memoryEstimates as LocalWhisperMemoryEstimateRecord[]).length = 0;

    const unsafeEstimate = createFixtureCatalogPayload();
    (unsafeEstimate.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord>).estimatedPeakRamBytes = -1;

    const staleEstimate = createFixtureCatalogPayload();
    (staleEstimate.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord>).runtimePackRevision =
      toLocalWhisperRevisionId('different-runtime-revision')!;

    const precisionMismatch = createFixtureCatalogPayload();
    (precisionMismatch.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord>).precision = 'float16';

    const cpuVramMismatch = createFixtureCatalogPayload();
    (cpuVramMismatch.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord>).estimatedPeakVramBytes =
      1_000_000_000;

    for (const payload of [
      duplicate,
      missingEstimate,
      unsafeEstimate,
      staleEstimate,
      precisionMismatch,
      cpuVramMismatch,
    ]) {
      assert.deepEqual(createRepository(signFixtureCatalog(payload)).load(), {
        success: false,
        code: 'CATALOG_INVALID',
      });
    }
  });

  it('requires the exact language mapping and a separately allowlisted canonical HTTPS origin', () => {
    const languageAlias = createFixtureCatalogPayload();
    (languageAlias.languages[1] as Mutable<LocalWhisperLanguageCatalogEntry>).fasterWhisper = null;

    const unallowlistedOrigin = createFixtureCatalogPayload();
    (unallowlistedOrigin.origins[0] as Mutable<LocalWhisperCatalogOrigin>).origin = 'https://other-fixture.invalid';

    const actionablePath = createFixtureCatalogPayload();
    (actionablePath.origins[0] as Mutable<LocalWhisperCatalogOrigin>).origin =
      'https://local-whisper-fixtures.invalid/downloads';

    for (const payload of [languageAlias, unallowlistedOrigin, actionablePath]) {
      assert.deepEqual(createRepository(signFixtureCatalog(payload)).load(), {
        success: false,
        code: 'CATALOG_INVALID',
      });
    }
  });

  it('requires an exact lowercase SHA-256 transfer digest for every model artifact', () => {
    const missing = createFixtureCatalogPayload();
    delete (missing.models[0] as Partial<Mutable<LocalWhisperCatalogModelEntry>>).transferSha256;

    const malformed = createFixtureCatalogPayload();
    (malformed.models[0] as Mutable<LocalWhisperCatalogModelEntry>).transferSha256 = 'A'.repeat(64);

    for (const payload of [missing, malformed]) {
      assert.deepEqual(createRepository(signFixtureCatalog(payload)).load(), {
        success: false,
        code: 'CATALOG_INVALID',
      });
    }
  });

  it('fails closed when the app-shipped document is unavailable or the production key ring is empty', () => {
    const unavailable = new LocalWhisperCatalogRepository({
      readDocument: () => {
        throw new Error('native detail must not escape');
      },
      trustPolicy: createFixtureCatalogTrustPolicy(),
    });
    const noProductionTrust = createRepository(signFixtureCatalog(createFixtureCatalogPayload()), {
      ...createFixtureCatalogTrustPolicy(),
      publicKeys: [],
      origins: [],
    });

    assert.deepEqual(unavailable.load(), { success: false, code: 'CATALOG_UNAVAILABLE' });
    assert.deepEqual(noProductionTrust.load(), { success: false, code: 'SIGNATURE_INVALID' });
  });
});
