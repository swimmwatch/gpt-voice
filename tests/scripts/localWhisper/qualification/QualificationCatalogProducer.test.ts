import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { ArtifactCatalogResolver } from '@main/localWhisper/artifacts/ArtifactCatalogResolver';
import {
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';
import {
  LocalWhisperQualificationCatalogProducer,
  type QualificationRuntimeCatalogSeed,
} from '../../../../scripts/local-whisper/qualification/QualificationCatalogProducer';

const sha = (digit: string): string => digit.repeat(64);

function runtime(backend: 'cpu' | 'cuda', platform: 'linux' | 'win32' = 'linux'): QualificationRuntimeCatalogSeed {
  const cpu = backend === 'cpu';
  return {
    backend,
    platform,
    architecture: 'x64',
    archiveFileName: `runtime-${backend}.tar.gz`,
    archiveSizeBytes: cpu ? 100 : 200,
    archiveSha256: cpu ? sha('1') : sha('2'),
    archiveSignature: Buffer.from(`signature-${backend}`).toString('base64'),
    buildRevision: cpu ? sha('3') : sha('4'),
    packRevision:
      platform === 'linux'
        ? cpu
          ? 'whisper-cpp-linux-x64-cpu-baseline-v1'
          : 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1'
        : cpu
          ? 'whisper-cpp-windows-x64-cpu-v1'
          : 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
    expectedFiles: [
      {
        fileId: toLocalWhisperArtifactId('worker')!,
        kind: 'executable',
        mode: 0o500,
        sizeBytes: 10,
        sha256: cpu ? sha('7') : sha('8'),
      },
    ],
    prerequisites: [cpu ? 'glibc-2.31' : 'nvidia-driver-r570'],
    provenanceId: `qualification-${backend}-provenance`,
    sbomRevision: `qualification-${backend}-sbom-v1`,
    noticeIds: [`qualification-${backend}-notice`],
    licenseIds: ['mit-license'],
  };
}

describe('LocalWhisperQualificationCatalogProducer', () => {
  it('produces an authenticated closed six-model/two-runtime qualification payload', () => {
    const payload = new LocalWhisperQualificationCatalogProducer().produce({
      platform: 'linux',
      candidateSemVer: '2.4.0',
      catalogRevision: 'qualification-catalog-v2.4.0',
      qualificationKeyId: 'qualification-key-v1',
      runtimeOriginId: 'qualification-runtime-origin',
      runtimeOrigin: 'https://127.0.0.1:39443',
      sourceCommit: 'a'.repeat(40),
      runtimes: [runtime('cuda'), runtime('cpu')],
    });
    const keys = generateKeyPairSync('ed25519');
    const privatePem = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicPem = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const bytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload));
    const document = Buffer.from(
      serializeCanonicalLocalWhisperCatalogJson({
        schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
        algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
        keyId: 'qualification-key-v1',
        payloadBase64: bytes.toString('base64'),
        signatureBase64: sign(null, bytes, privatePem).toString('base64'),
      }),
    );
    const loaded = new LocalWhisperCatalogRepository({
      readDocument: () => document,
      trustPolicy: {
        purpose: 'qualification',
        publicKeys: [{ keyId: toLocalWhisperArtifactId('qualification-key-v1')!, publicKeyPem: publicPem }],
        origins: payload.origins,
        appRevision: toLocalWhisperRevisionId('app-v2.4.0')!,
        workerProtocolVersion: 1,
      },
    }).load();
    if (!loaded.success) assert.fail(loaded.code);
    assert.equal(payload.models.length, 6);
    assert.equal(payload.runtimes.length, 2);
    assert.equal(payload.memoryEstimates.length, 12);
    assert.equal(payload.runtimes[0].identity.backend, 'cpu');
    assert.equal(payload.runtimes[0].qualificationProfileDigest, undefined);
    assert.equal(payload.models[0].qualificationProfileDigest, undefined);
    const resolver = new ArtifactCatalogResolver({ getCatalog: () => loaded.catalog });
    assert.doesNotThrow(() =>
      resolver.resolve(createManagedRuntimeDescriptor(loaded.catalog, loaded.catalog.payload.runtimes[0]).artifactId),
    );
    assert.doesNotThrow(() =>
      resolver.resolve(createManagedModelDescriptor(loaded.catalog, loaded.catalog.payload.models[0]).artifactId),
    );
    const productionResolver = new ArtifactCatalogResolver({
      getCatalog: () => ({
        ...loaded.catalog,
        payload: { ...loaded.catalog.payload, purpose: 'production' as const },
      }),
    });
    assert.throws(
      () =>
        productionResolver.resolve(
          createManagedRuntimeDescriptor(loaded.catalog, loaded.catalog.payload.runtimes[0]).artifactId,
        ),
      /RUNTIME_INCOMPATIBLE/u,
    );
    assert.throws(
      () =>
        productionResolver.resolve(
          createManagedModelDescriptor(loaded.catalog, loaded.catalog.payload.models[0]).artifactId,
        ),
      /MODEL_INCOMPATIBLE/u,
    );
  });

  it('rejects non-loopback runtime origins and incomplete runtime matrices', () => {
    const producer = new LocalWhisperQualificationCatalogProducer();
    const seed = {
      platform: 'linux',
      candidateSemVer: '2.4.0',
      catalogRevision: 'qualification-catalog-v2.4.0',
      qualificationKeyId: 'qualification-key-v1',
      runtimeOriginId: 'qualification-runtime-origin',
      runtimeOrigin: 'https://127.0.0.1:39443',
      sourceCommit: 'a'.repeat(40),
      runtimes: [runtime('cpu'), runtime('cuda')],
    } as const;
    assert.throws(() => producer.produce({ ...seed, runtimeOrigin: 'https://example.com' }), /loopback/u);
    assert.throws(() => producer.produce({ ...seed, runtimes: [runtime('cpu')] }), /runtime matrix invalid/u);
    assert.throws(
      () => producer.produce({ ...seed, runtimes: [runtime('cpu'), runtime('cuda', 'win32')] }),
      /platform contract/u,
    );
  });

  it('produces only the executable Windows x64 CPU row', () => {
    const payload = new LocalWhisperQualificationCatalogProducer().produce({
      platform: 'win32',
      candidateSemVer: '2.4.0',
      catalogRevision: 'windows-development-catalog-v2.4.0',
      qualificationKeyId: 'qualification-key-v1',
      runtimeOriginId: 'qualification-runtime-origin',
      runtimeOrigin: 'https://127.0.0.1:39443',
      sourceCommit: 'a'.repeat(40),
      runtimes: [runtime('cpu', 'win32')],
      qualificationStatus: 'estimateOnly',
    });
    assert.deepEqual(
      payload.runtimes.map(({ identity }) => ({
        platform: identity.platform,
        architecture: identity.architecture,
        backend: identity.backend,
        packRevision: identity.packRevision,
        computeTargets: identity.computeTargets,
      })),
      [
        {
          platform: 'win32',
          architecture: 'x64',
          backend: 'cpu',
          packRevision: 'whisper-cpp-windows-x64-cpu-v1',
          computeTargets: ['x86-64-sse2'],
        },
      ],
    );
    assert.equal(
      payload.models.every(({ compatibleRuntimePackRevisions }) => compatibleRuntimePackRevisions.length === 1),
      true,
    );
    const keys = generateKeyPairSync('ed25519');
    const bytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload));
    const document = Buffer.from(
      serializeCanonicalLocalWhisperCatalogJson({
        schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
        algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
        keyId: 'qualification-key-v1',
        payloadBase64: bytes.toString('base64'),
        signatureBase64: sign(null, bytes, keys.privateKey).toString('base64'),
      }),
    );
    const loaded = new LocalWhisperCatalogRepository({
      readDocument: () => document,
      trustPolicy: {
        purpose: 'qualification',
        publicKeys: [
          {
            keyId: toLocalWhisperArtifactId('qualification-key-v1')!,
            publicKeyPem: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
          },
        ],
        origins: payload.origins,
        appRevision: toLocalWhisperRevisionId('app-v2.4.0')!,
        workerProtocolVersion: 1,
      },
    }).load();
    if (!loaded.success) assert.fail(loaded.code);
    assert.equal(loaded.catalog.payload.runtimes.length, 1);
    assert.throws(
      () =>
        new LocalWhisperQualificationCatalogProducer().produce({
          platform: 'win32',
          candidateSemVer: '2.4.0',
          catalogRevision: 'windows-development-catalog-v2.4.0',
          qualificationKeyId: 'qualification-key-v1',
          runtimeOriginId: 'qualification-runtime-origin',
          runtimeOrigin: 'https://127.0.0.1:39443',
          sourceCommit: 'a'.repeat(40),
          runtimes: [runtime('cpu', 'win32'), runtime('cuda', 'win32')],
        }),
      /runtime matrix invalid/u,
    );
  });
});
