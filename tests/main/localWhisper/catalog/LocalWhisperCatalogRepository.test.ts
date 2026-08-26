import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import type {
  LocalWhisperCatalogModelEntry,
  LocalWhisperCatalogOrigin,
  LocalWhisperCatalogRuntimeEntry,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import type { LocalWhisperLanguageCatalogEntry, LocalWhisperMemoryEstimateRecord } from '@shared/localWhisper';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId } from '@shared/localWhisper';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';
import {
  createQualificationCatalogPayload,
  createQualificationCatalogTrustPolicy,
  QUALIFICATION_MODEL_ORIGIN,
  signQualificationCatalog,
} from '../../../fixtures/local-whisper/catalog/qualificationCatalogSigner';

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

function createRepository(document: Uint8Array, trustPolicy = createFixtureCatalogTrustPolicy()) {
  return new LocalWhisperCatalogRepository({ readDocument: () => document, trustPolicy });
}

function createQualificationRepository(document: Uint8Array, trustPolicy = createQualificationCatalogTrustPolicy()) {
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

    const unexpectedDimension = createFixtureCatalogPayload();
    (unexpectedDimension.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord> & Record<string, unknown>)[
      'legacyDimension'
    ] = 'unexpected';

    const cpuVramMismatch = createFixtureCatalogPayload();
    (cpuVramMismatch.memoryEstimates[0] as Mutable<LocalWhisperMemoryEstimateRecord>).estimatedPeakVramBytes =
      1_000_000_000;

    for (const payload of [
      duplicate,
      missingEstimate,
      unsafeEstimate,
      staleEstimate,
      unexpectedDimension,
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
    (languageAlias.languages[1] as Mutable<LocalWhisperLanguageCatalogEntry> & Record<string, unknown>)[
      'legacyMapping'
    ] = null;

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

  it('accepts only a schema-v2 qualification catalog with the closed six-model release matrix', () => {
    const payload = createQualificationCatalogPayload();
    const loaded = createQualificationRepository(signQualificationCatalog(payload)).load();

    assert.equal(loaded.success, true);
    if (!loaded.success) return;
    assert.equal(loaded.catalog.payload.schemaVersion, 2);
    assert.equal(loaded.catalog.payload.purpose, 'qualification');
    assert.deepEqual(
      loaded.catalog.payload.models.map(({ identity }) => `${identity.logicalModel}/${identity.variant}`),
      ['tiny/full', 'base/full', 'small/full', 'medium/full', 'large-v3/q5_0', 'large-v3-turbo/q5_0'],
    );
  });

  it('rejects CUDA targets and applicability rows outside the single RTX 50 contract', () => {
    const sm86 = createQualificationCatalogPayload();
    const sm89 = createQualificationCatalogPayload();
    const missingApplicability = createQualificationCatalogPayload();
    const crossPlatform = createQualificationCatalogPayload();
    const duplicateCuda = createQualificationCatalogPayload();
    const cuda86 = sm86.runtimes.find(({ identity }) => identity.backend === 'cuda');
    const cuda89 = sm89.runtimes.find(({ identity }) => identity.backend === 'cuda');
    const missing = missingApplicability.runtimes.find(({ identity }) => identity.backend === 'cuda');
    const cross = crossPlatform.runtimes.find(({ identity }) => identity.backend === 'cuda');
    const duplicate = duplicateCuda.runtimes.find(({ identity }) => identity.backend === 'cuda');
    assert.ok(cuda86 && cuda89 && missing && cross && duplicate);
    (cuda86.identity.computeTargets as string[])[0] = 'sm_86-real';
    (cuda89.identity.computeTargets as string[])[0] = 'sm_89-real';
    delete (missing as Partial<Mutable<LocalWhisperCatalogRuntimeEntry>>).applicability;
    (cross.identity as Mutable<typeof cross.identity>).platform = 'win32';
    (duplicateCuda.runtimes as LocalWhisperCatalogRuntimeEntry[]).push(structuredClone(duplicate));

    for (const payload of [sm86, sm89, missingApplicability, crossPlatform, duplicateCuda]) {
      assert.deepEqual(createQualificationRepository(signQualificationCatalog(payload)).load(), {
        success: false,
        code: 'CATALOG_INVALID',
      });
    }
  });

  it('rejects schema, purpose, keyring, and origin substitution across catalog trust domains', () => {
    const v2FixturePurpose = createQualificationCatalogPayload();
    (v2FixturePurpose as Mutable<typeof v2FixturePurpose>).purpose = 'fixture';
    const v1QualificationPurpose = createFixtureCatalogPayload();
    (v1QualificationPurpose as Mutable<typeof v1QualificationPurpose>).purpose = 'qualification';
    const productionTrust = { ...createQualificationCatalogTrustPolicy(), purpose: 'production' as const };
    const substitutedOriginTrust = {
      ...createQualificationCatalogTrustPolicy(),
      origins: createQualificationCatalogTrustPolicy().origins.map((entry) =>
        entry.origin === QUALIFICATION_MODEL_ORIGIN ? { ...entry, origin: 'https://example.invalid' } : entry,
      ),
    };

    assert.deepEqual(createQualificationRepository(signQualificationCatalog(v2FixturePurpose)).load(), {
      success: false,
      code: 'CATALOG_INVALID',
    });
    assert.deepEqual(createQualificationRepository(signQualificationCatalog(v1QualificationPurpose)).load(), {
      success: false,
      code: 'CATALOG_INVALID',
    });
    assert.deepEqual(
      createQualificationRepository(
        signQualificationCatalog(createQualificationCatalogPayload()),
        productionTrust,
      ).load(),
      { success: false, code: 'CATALOG_INVALID' },
    );
    assert.deepEqual(
      createQualificationRepository(
        signQualificationCatalog(createQualificationCatalogPayload(), toLocalWhisperArtifactId('other-key')!),
      ).load(),
      { success: false, code: 'SIGNATURE_INVALID' },
    );
    assert.deepEqual(
      createQualificationRepository(
        signQualificationCatalog(createQualificationCatalogPayload()),
        substitutedOriginTrust,
      ).load(),
      { success: false, code: 'CATALOG_INVALID' },
    );
  });

  it('rejects every mutation of the exact model matrix or signed redirect policy', () => {
    const missingModel = createQualificationCatalogPayload();
    (missingModel.models as LocalWhisperCatalogModelEntry[]).pop();

    const wrongModelDigest = createQualificationCatalogPayload();
    (wrongModelDigest.models[0] as Mutable<LocalWhisperCatalogModelEntry>).transferSha256 = 'f'.repeat(64);

    const wrongModelSource = createQualificationCatalogPayload();
    const source = wrongModelSource.models[0].source;
    assert.ok(source);
    (source as Mutable<typeof source>).url = source.url.replace('ggml-tiny.bin', 'ggml-base.bin');

    const redirectedRuntime = createQualificationCatalogPayload();
    const runtimePolicy = redirectedRuntime.redirectPolicies?.[0];
    assert.ok(runtimePolicy);
    (runtimePolicy as Mutable<typeof runtimePolicy>).maxRedirects = 1;

    const credentialForwarding = createQualificationCatalogPayload();
    const modelPolicy = credentialForwarding.redirectPolicies?.[1];
    assert.ok(modelPolicy);
    (modelPolicy as unknown as { credentialForwarding: boolean }).credentialForwarding = true;

    for (const payload of [missingModel, wrongModelDigest, wrongModelSource, redirectedRuntime, credentialForwarding]) {
      assert.deepEqual(createQualificationRepository(signQualificationCatalog(payload)).load(), {
        success: false,
        code: 'CATALOG_INVALID',
      });
    }
  });
});
