import { generateKeyPairSync, sign } from 'node:crypto';
import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  LOCAL_WHISPER_MODEL_FAMILIES,
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryConfigurationIdentity,
} from '@shared/localWhisper';
import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_FIXTURE_CATALOG_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
  type LocalWhisperCatalogPayload,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';

import {
  LOCAL_WHISPER_FIXTURE_KEY_PREFIX,
  LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
  type LocalWhisperBundleManifest,
  type LocalWhisperKeyringDocument,
  type LocalWhisperPackManifest,
} from './contracts';
import { inspectFlatDirectory, sha256Bytes, writeCanonicalJson } from './fileIntegrity';

const FIXTURE_CATALOG_KEY_ID = `${LOCAL_WHISPER_FIXTURE_KEY_PREFIX}catalog-key-v1`;
const FIXTURE_ORIGIN_ID = 'fixture-origin-v1';
const FIXTURE_ORIGIN = 'https://local-whisper-fixture.invalid';
const FIXTURE_APP_REVISION = 'fixture-app-v1';
const FIXTURE_CATALOG_REVISION = 'fixture-catalog-v1';
const FIXTURE_RUNTIME_REVISION = 'fixture-runtime-v1';
const FIXTURE_MODEL_REVISION = 'fixture-model-v1';
const FIXTURE_RUNTIME_FILE = 'synthetic-runtime.pack';
const FIXTURE_MODEL_FILE = 'synthetic-model.pack';
const RUNTIME_BYTES = Buffer.from('LOCAL_WHISPER_SYNTHETIC_NON_INFERENCE_RUNTIME_FIXTURE_V1\n', 'utf8');
const MODEL_BYTES = Buffer.from('LOCAL_WHISPER_SYNTHETIC_NON_INFERENCE_MODEL_FIXTURE_V1\n', 'utf8');

const MODEL_CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = {
  target: 'cpu',
  backend: 'cpu',
  runtimePackRevision: toLocalWhisperRevisionId(FIXTURE_RUNTIME_REVISION)!,
  model: {
    engine: 'whisperCpp',
    logicalModel: 'tiny',
    sourceCheckpointRevision: toLocalWhisperRevisionId('fixture-checkpoint-v1')!,
    artifactRevision: toLocalWhisperRevisionId(FIXTURE_MODEL_REVISION)!,
    nativeFormat: 'ggml',
    variant: 'full',
  },
};

export interface FixtureBundleProductionResult {
  readonly bundleDirectory: string;
  readonly bundleManifestSha256: string;
  readonly catalogSha256: string;
  readonly keyId: string;
}

function fixtureMemoryEstimates(): LocalWhisperPackManifest['memoryEstimates'] {
  const gib = 1024 ** 3;
  return [
    ['tiny', 1 * gib],
    ['base', 2 * gib],
    ['small', 3 * gib],
    ['medium', 6 * gib],
    ['large', 10 * gib],
    ['turbo', 8 * gib],
  ].map(([modelFamily, ramBytes]) => ({
    modelFamily: String(modelFamily),
    ramBytes: Number(ramBytes),
    vramBytes: 'notApplicable' as const,
  }));
}

function createPackManifest(input: {
  readonly artifactKind: 'model' | 'runtime';
  readonly artifactId: string;
  readonly artifactRevision: string;
  readonly artifactPath: string;
  readonly bytes: Uint8Array;
  readonly signatureBase64: string;
}): LocalWhisperPackManifest {
  const digest = sha256Bytes(input.bytes);
  return {
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    purpose: 'fixture',
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    platform: input.artifactKind === 'runtime' ? 'linux' : 'portable',
    architecture: input.artifactKind === 'runtime' ? 'x64' : 'portable',
    engine: 'whisperCpp',
    target: input.artifactKind === 'runtime' ? 'cpu' : 'portable',
    backend: input.artifactKind === 'runtime' ? 'cpu' : 'notApplicable',
    protocolVersion: 1,
    appRevision: FIXTURE_APP_REVISION,
    catalogRevision: FIXTURE_CATALOG_REVISION,
    artifactRevision: input.artifactRevision,
    sizeBytes: input.bytes.byteLength,
    sha256: digest,
    signatureBase64: input.signatureBase64,
    signingKeyId: FIXTURE_CATALOG_KEY_ID,
    expectedFiles: [{ path: input.artifactPath, sizeBytes: input.bytes.byteLength, sha256: digest }],
    dynamicDependencies: input.artifactKind === 'runtime' ? ['fixture-libc-v1'] : [],
    compatibilityRows: [input.artifactKind === 'runtime' ? 'fixture-linux-x64-cpu-v1' : 'fixture-ggml-v1'],
    memoryEstimates: fixtureMemoryEstimates(),
    source: {
      lockId: input.artifactKind === 'runtime' ? 'whisper-cpp-v1.9.1-f049fff' : 'fixture-model-source-lock-v1',
      commit: 'fixture-commit-v1',
      tree: 'fixture-tree-v1',
      subset: 'fixture-subset-v1',
      patch: 'fixture-no-patch-v1',
    },
    build: {
      packDefinitionId:
        input.artifactKind === 'runtime' ? 'fixture-runtime-pack-definition-v1' : 'fixture-model-pack-definition-v1',
      toolchain: 'fixture-toolchain-v1',
      options: ['disconnected', 'synthetic-non-inference'],
      acceleratorArchitectures: [],
    },
    licenseIds: ['fixture-license-v1'],
    noticeIds: ['fixture-notice-v1'],
    sbomId: 'fixture-sbom-v1',
    provenanceId: 'fixture-provenance-v1',
    supportTier: 'planned',
    redistributionReview: 'fixture-only',
  };
}

function createCatalogPayload(input: {
  readonly runtimeSignature: string;
  readonly modelSignature: string;
}): LocalWhisperCatalogPayload {
  const runtimeDigest = sha256Bytes(RUNTIME_BYTES);
  const modelDigest = sha256Bytes(MODEL_BYTES);
  const appRevision = toLocalWhisperRevisionId(FIXTURE_APP_REVISION)!;
  const catalogRevision = toLocalWhisperRevisionId(FIXTURE_CATALOG_REVISION)!;
  return {
    schemaVersion: LOCAL_WHISPER_FIXTURE_CATALOG_SCHEMA_VERSION,
    purpose: 'fixture',
    catalogRevision,
    displayMetadata: {
      title: 'Synthetic Local Whisper CI fixture',
      summary: 'Bounded non-inference catalog for packaging trust and integrity checks only.',
    },
    compatibleAppRevisions: [appRevision],
    workerProtocolVersion: 1,
    languageCatalogRevision: LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
    languages: LOCAL_WHISPER_LANGUAGE_CATALOG,
    modelFamilies: LOCAL_WHISPER_MODEL_FAMILIES,
    origins: [{ id: toLocalWhisperArtifactId(FIXTURE_ORIGIN_ID)!, origin: FIXTURE_ORIGIN }],
    runtimes: [
      {
        identity: {
          engine: 'whisperCpp',
          platform: 'linux',
          architecture: 'x64',
          target: 'cpu',
          backend: 'cpu',
          dependencyFamily: 'fixture-libc-v1',
          upstreamRevision: toLocalWhisperRevisionId('fixture-upstream-v1')!,
          buildRevision: toLocalWhisperRevisionId('fixture-build-v1')!,
          computeTargets: ['fixture-x64'],
          protocolVersion: 1,
          packRevision: toLocalWhisperRevisionId(FIXTURE_RUNTIME_REVISION)!,
          catalogRevision,
          appRevision,
          signingKeyId: toLocalWhisperArtifactId(FIXTURE_CATALOG_KEY_ID)!,
          archiveSizeBytes: RUNTIME_BYTES.byteLength,
          archiveSha256: runtimeDigest,
          archiveSignature: input.runtimeSignature,
          originId: toLocalWhisperArtifactId(FIXTURE_ORIGIN_ID)!,
          expectedFiles: [
            {
              fileId: toLocalWhisperArtifactId('fixture-runtime-notice')!,
              kind: 'notice',
              mode: 0o600,
              sizeBytes: RUNTIME_BYTES.byteLength,
              sha256: runtimeDigest,
            },
          ],
          prerequisites: ['fixture-libc-v1'],
          provenanceId: toLocalWhisperArtifactId('fixture-provenance-v1')!,
          sbomRevision: toLocalWhisperRevisionId('fixture-sbom-v1')!,
          noticeIds: [toLocalWhisperArtifactId('fixture-notice-v1')!],
        },
        recommended: true,
        qualificationStatus: 'planned',
        licenseIds: [toLocalWhisperArtifactId('fixture-license-v1')!],
      },
    ],
    models: [
      {
        identity: MODEL_CONFIGURATION.model,
        originId: toLocalWhisperArtifactId(FIXTURE_ORIGIN_ID)!,
        expectedFiles: [
          {
            fileId: toLocalWhisperArtifactId('fixture-model-data')!,
            kind: 'data',
            mode: 0o600,
            sizeBytes: MODEL_BYTES.byteLength,
            sha256: modelDigest,
          },
        ],
        transferSizeBytes: MODEL_BYTES.byteLength,
        transferSha256: modelDigest,
        transferSignature: input.modelSignature,
        signingKeyId: toLocalWhisperArtifactId(FIXTURE_CATALOG_KEY_ID)!,
        installedSizeBytes: MODEL_BYTES.byteLength,
        compatibleRuntimePackRevisions: [toLocalWhisperRevisionId(FIXTURE_RUNTIME_REVISION)!],
        recommended: true,
        qualificationStatus: 'planned',
        provenanceId: toLocalWhisperArtifactId('fixture-provenance-v1')!,
        licenseIds: [toLocalWhisperArtifactId('fixture-license-v1')!],
        noticeIds: [toLocalWhisperArtifactId('fixture-notice-v1')!],
      },
    ],
    memoryEstimates: [
      {
        ...MODEL_CONFIGURATION,
        estimatedPeakRamBytes: 1024 ** 3,
        estimatedPeakVramBytes: 'notApplicable',
        evidenceBasis: 'derived',
        sourceBuildRevision: toLocalWhisperRevisionId('fixture-build-v1')!,
        methodologyLabel: 'Synthetic fixture estimate',
      },
    ],
    qualifiedMemoryPeaks: [],
    denylist: { runtimes: [], models: [] },
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function destroyPrivateKey(privateKeyPath: string, byteLength: number): Promise<void> {
  if (await pathExists(privateKeyPath)) {
    await writeFile(privateKeyPath, Buffer.alloc(byteLength), { flag: 'r+', mode: 0o600 });
    await rm(privateKeyPath, { force: true });
  }
}

/** Creates one public-only synthetic fixture bundle and refuses to overwrite or regenerate it. */
export class FixtureBundleProducer {
  public async produce(outputDirectory: string): Promise<FixtureBundleProductionResult> {
    const resolvedOutput = path.resolve(outputDirectory);
    if (await pathExists(resolvedOutput)) throw new Error('Fixture bundle output already exists');
    const outputParent = path.dirname(resolvedOutput);
    await mkdir(outputParent, { mode: 0o700, recursive: true });
    const stagingDirectory = await mkdtemp(path.join(outputParent, '.local-whisper-fixture-'));
    const privateRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-private-'));
    const privateKeyPath = path.join(privateRoot, 'ephemeral-ed25519.pem');

    try {
      const keyPair = generateKeyPairSync('ed25519');
      const privatePem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
      const publicPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
      await writeFile(privateKeyPath, privatePem, { encoding: 'utf8', mode: 0o600 });

      const runtimeSignature = sign(null, RUNTIME_BYTES, privatePem).toString('base64');
      const modelSignature = sign(null, MODEL_BYTES, privatePem).toString('base64');
      const runtimeDigest = sha256Bytes(RUNTIME_BYTES);
      const modelDigest = sha256Bytes(MODEL_BYTES);
      const payload = createCatalogPayload({ runtimeSignature, modelSignature });
      const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload), 'utf8');
      const catalogDocument = {
        schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
        algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
        keyId: FIXTURE_CATALOG_KEY_ID,
        payloadBase64: payloadBytes.toString('base64'),
        signatureBase64: sign(null, payloadBytes, privatePem).toString('base64'),
      };
      const catalogBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(catalogDocument), 'utf8');
      const catalogSha256 = sha256Bytes(catalogBytes);
      const keyring: LocalWhisperKeyringDocument = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'fixture',
        appRevision: FIXTURE_APP_REVISION,
        workerProtocolVersion: 1,
        publicKeys: [{ keyId: FIXTURE_CATALOG_KEY_ID, publicKeyPem: publicPem }],
        origins: [{ id: FIXTURE_ORIGIN_ID, origin: FIXTURE_ORIGIN }],
      };

      await Promise.all([
        writeFile(path.join(stagingDirectory, 'catalog.json'), catalogBytes, { mode: 0o600 }),
        writeFile(path.join(stagingDirectory, 'catalog.sha256'), `${catalogSha256}\n`, { mode: 0o600 }),
        writeCanonicalJson(path.join(stagingDirectory, 'keyring.json'), keyring),
        writeFile(path.join(stagingDirectory, FIXTURE_RUNTIME_FILE), RUNTIME_BYTES, { mode: 0o600 }),
        writeFile(path.join(stagingDirectory, FIXTURE_MODEL_FILE), MODEL_BYTES, { mode: 0o600 }),
        writeCanonicalJson(
          path.join(stagingDirectory, 'runtime-pack.manifest.json'),
          createPackManifest({
            artifactKind: 'runtime',
            artifactId: 'fixture-runtime-v1',
            artifactRevision: FIXTURE_RUNTIME_REVISION,
            artifactPath: FIXTURE_RUNTIME_FILE,
            bytes: RUNTIME_BYTES,
            signatureBase64: runtimeSignature,
          }),
        ),
        writeCanonicalJson(
          path.join(stagingDirectory, 'model-pack.manifest.json'),
          createPackManifest({
            artifactKind: 'model',
            artifactId: 'fixture-model-v1',
            artifactRevision: FIXTURE_MODEL_REVISION,
            artifactPath: FIXTURE_MODEL_FILE,
            bytes: MODEL_BYTES,
            signatureBase64: modelSignature,
          }),
        ),
        writeCanonicalJson(path.join(stagingDirectory, 'licenses.json'), {
          schemaVersion: 1,
          purpose: 'fixture',
          components: [
            {
              id: 'fixture-license-v1',
              component: 'synthetic-non-inference-fixture',
              licenseId: 'LicenseRef-Fixture-Only',
              redistributionReview: 'fixture-only',
            },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'notices.json'), {
          schemaVersion: 1,
          purpose: 'fixture',
          notices: [
            {
              id: 'fixture-notice-v1',
              component: 'synthetic-non-inference-fixture',
              text: 'Synthetic CI fixture. Not an inference runtime or model.',
            },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'provenance.json'), {
          schemaVersion: 1,
          purpose: 'fixture',
          records: [
            {
              id: 'fixture-provenance-v1',
              sourceCommit: 'fixture-commit-v1',
              sourceLockId: 'whisper-cpp-v1.9.1-f049fff',
              sourceTree: 'fixture-tree-v1',
              sourceSubset: 'fixture-subset-v1',
              patch: 'fixture-no-patch-v1',
              toolchain: 'fixture-toolchain-v1',
              packDefinitionIds: ['fixture-runtime-pack-definition-v1', 'fixture-model-pack-definition-v1'],
              buildOptions: ['disconnected', 'synthetic-non-inference'],
              acceleratorArchitectures: [],
              dynamicDependencies: ['fixture-libc-v1'],
              artifactSha256: [runtimeDigest, modelDigest],
            },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'sbom.spdx.json'), {
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: 'local-whisper-synthetic-fixture',
          documentNamespace: `https://local-whisper-fixture.invalid/spdx/${catalogSha256}`,
          packages: [
            {
              SPDXID: 'SPDXRef-Package-SyntheticFixture',
              name: 'local-whisper-synthetic-fixture',
              versionInfo: '1',
              licenseConcluded: 'NOASSERTION',
              checksums: [
                { algorithm: 'SHA256', checksumValue: runtimeDigest },
                { algorithm: 'SHA256', checksumValue: modelDigest },
              ],
            },
          ],
        }),
      ]);

      await destroyPrivateKey(privateKeyPath, Buffer.byteLength(privatePem));
      const files = await inspectFlatDirectory(stagingDirectory, ['bundle-manifest.json']);
      const manifest: LocalWhisperBundleManifest = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'fixture',
        keyId: FIXTURE_CATALOG_KEY_ID,
        catalogSha256,
        createdBy: 'local-whisper-fixture-producer',
        synthetic: true,
        files,
      };
      await writeCanonicalJson(path.join(stagingDirectory, 'bundle-manifest.json'), manifest);
      const bundleManifestSha256 = sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(manifest));
      await rename(stagingDirectory, resolvedOutput);
      return Object.freeze({
        bundleDirectory: resolvedOutput,
        bundleManifestSha256,
        catalogSha256,
        keyId: FIXTURE_CATALOG_KEY_ID,
      });
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    } finally {
      await destroyPrivateKey(privateKeyPath, 4096);
      await rm(privateRoot, { recursive: true, force: true });
    }
  }
}
