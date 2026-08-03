import { generateKeyPairSync, sign } from 'node:crypto';
import { access, chmod, copyFile, lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { localWhisperPackSignatureInput } from '../packaging/BundleVerifier';
import {
  LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
  type LocalWhisperBundleManifest,
  type LocalWhisperKeyringDocument,
  type LocalWhisperPackManifest,
} from '../packaging/contracts';
import { inspectFlatDirectory, sha256Bytes, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';
import {
  LocalWhisperQualificationCatalogProducer,
  type QualificationCatalogSeed,
  type QualificationRuntimeCatalogSeed,
} from './QualificationCatalogProducer';

const MODEL_MEMORY_ESTIMATES = Object.freeze([
  Object.freeze({ modelFamily: 'tiny', ramBytes: 4 * 1024 ** 3, vramBytes: 2 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'base', ramBytes: 4 * 1024 ** 3, vramBytes: 2 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'small', ramBytes: 6 * 1024 ** 3, vramBytes: 3 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'medium', ramBytes: 10 * 1024 ** 3, vramBytes: 6 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'large-v3', ramBytes: 16 * 1024 ** 3, vramBytes: 8 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'large-v3-turbo', ramBytes: 10 * 1024 ** 3, vramBytes: 6 * 1024 ** 3 }),
]);

export interface QualificationRuntimeBundleInput {
  readonly archivePath: string;
  readonly catalog: Omit<
    QualificationRuntimeCatalogSeed,
    'archiveFileName' | 'archiveSizeBytes' | 'archiveSha256' | 'archiveSignature'
  >;
}

export interface QualificationModelBundleInput {
  readonly filePath: string;
  readonly artifactId: string;
  readonly artifactRevision: string;
  readonly expectedSha256: string;
  readonly expectedSizeBytes: number;
}

export interface QualificationBundleInput {
  readonly outputDirectory: string;
  readonly catalog: Omit<QualificationCatalogSeed, 'qualificationKeyId' | 'runtimes'>;
  readonly runtimes: readonly QualificationRuntimeBundleInput[];
  readonly model: QualificationModelBundleInput;
}

export interface QualificationBundleProductionResult {
  readonly bundleDirectory: string;
  readonly bundleManifestSha256: string;
  readonly catalogSha256: string;
  readonly keyId: string;
  readonly keyringSha256: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertFile(
  filePath: string,
  expectedSizeBytes?: number,
  expectedSha256?: string,
): Promise<{
  readonly sizeBytes: number;
  readonly sha256: string;
}> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0) {
    throw new Error('Qualification bundle input is not a regular file');
  }
  const sha256 = await sha256File(filePath);
  if (
    (expectedSizeBytes !== undefined && metadata.size !== expectedSizeBytes) ||
    (expectedSha256 !== undefined && sha256 !== expectedSha256)
  ) {
    throw new Error('Qualification bundle input identity changed');
  }
  return Object.freeze({ sizeBytes: metadata.size, sha256 });
}

function packManifest(input: {
  readonly artifactKind: 'model' | 'runtime';
  readonly artifactId: string;
  readonly artifactRevision: string;
  readonly backend: 'cpu' | 'cuda' | 'notApplicable';
  readonly candidateSemVer: string;
  readonly catalogRevision: string;
  readonly fileName: string;
  readonly keyId: string;
  readonly sha256: string;
  readonly signatureBase64: string;
  readonly sizeBytes: number;
}): LocalWhisperPackManifest {
  const runtime = input.artifactKind === 'runtime';
  return Object.freeze({
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    purpose: 'qualification',
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    platform: runtime ? 'linux' : 'portable',
    architecture: runtime ? 'x64' : 'portable',
    engine: 'whisperCpp',
    target: runtime ? (input.backend === 'cpu' ? 'cpu' : 'gpu') : 'portable',
    backend: input.backend,
    protocolVersion: 1,
    appRevision: `app-v${input.candidateSemVer}`,
    catalogRevision: input.catalogRevision,
    artifactRevision: input.artifactRevision,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    signatureBase64: input.signatureBase64,
    signingKeyId: input.keyId,
    expectedFiles: [Object.freeze({ path: input.fileName, sizeBytes: input.sizeBytes, sha256: input.sha256 })],
    dynamicDependencies: runtime
      ? input.backend === 'cuda'
        ? ['cuda-runtime-12.8.1', 'cublas-12.8.1', 'cublas-lt-12.8.1']
        : ['glibc-2.31']
      : ['ggml-v1'],
    compatibilityRows: [runtime ? `linux-x64-${input.backend}-v1` : 'ggml-release-1-v1'],
    memoryEstimates: MODEL_MEMORY_ESTIMATES.map((estimate) => ({
      ...estimate,
      vramBytes: input.backend === 'cpu' ? ('notApplicable' as const) : estimate.vramBytes,
    })),
    source: {
      lockId: runtime ? 'whisper-cpp-v1.9.1-f049fff' : 'whisper-cpp-models-5359861c',
      commit: runtime ? 'f049fff95a089aa9969deb009cdd4892b3e74916' : '5359861c739e955e79d9a303bcbc70fb988958b1',
      tree: runtime ? 'verified-patched-source-v1' : 'upstream-git-lfs-objects-v1',
      subset: runtime ? 'local-whisper-runtime-subset-v1' : 'release-1-model-matrix-v1',
      patch: runtime ? 'local-whisper-whisper-cpp-device-cancel-v1' : 'no-model-conversion-v1',
    },
    build: {
      packDefinitionId: runtime ? `linux-x64-${input.backend}-pack-v1` : 'pinned-raw-model-v1',
      toolchain: runtime ? `linux-x64-${input.backend}-toolchain-v1` : 'upstream-git-lfs-v1',
      options: runtime ? ['disconnected', 'deterministic', 'network-denied'] : ['exact-upstream-bytes'],
      acceleratorArchitectures: input.backend === 'cuda' ? ['sm-120a'] : [],
    },
    licenseIds: runtime ? ['mit-license'] : ['mit-license'],
    noticeIds: runtime ? [`qualification-${input.backend}-runtime-notice`] : ['whisper-cpp-model-notice'],
    sbomId: runtime ? `qualification-${input.backend}-runtime-sbom` : 'qualification-model-sbom',
    provenanceId: runtime ? `qualification-${input.backend}-runtime-provenance` : 'qualification-model-provenance',
    supportTier: 'planned',
    redistributionReview: 'pending',
  });
}

async function destroyPrivateKey(privateKeyPath: string, byteLength: number): Promise<void> {
  if (!(await exists(privateKeyPath))) return;
  await writeFile(privateKeyPath, Buffer.alloc(byteLength), { flag: 'r+', mode: 0o600 });
  await rm(privateKeyPath, { force: true });
}

/** Produces a public-only, single-use qualification bundle and destroys its temporary private key. */
export class LocalWhisperQualificationBundleProducer {
  public async produce(input: QualificationBundleInput): Promise<QualificationBundleProductionResult> {
    const outputDirectory = path.resolve(input.outputDirectory);
    if (await exists(outputDirectory)) throw new Error('Qualification bundle output already exists');
    if (input.runtimes.length !== 2 || new Set(input.runtimes.map(({ catalog }) => catalog.backend)).size !== 2) {
      throw new Error('Qualification bundle requires one CPU and one CUDA runtime');
    }
    await mkdir(path.dirname(outputDirectory), { recursive: true, mode: 0o700 });
    const stagingDirectory = await mkdtemp(path.join(path.dirname(outputDirectory), '.local-whisper-qualification-'));
    const privateRoot = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-private-'));
    const privateKeyPath = path.join(privateRoot, 'ephemeral-ed25519.pem');
    let privatePem = '';
    try {
      const keyPair = generateKeyPairSync('ed25519');
      privatePem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
      const publicPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
      const keyId = `qualification-${sha256Bytes(publicPem).slice(0, 24)}`;
      await writeFile(privateKeyPath, privatePem, { encoding: 'utf8', mode: 0o600 });

      const runtimeRecords = [];
      for (const runtime of [...input.runtimes].sort((left, right) =>
        left.catalog.backend.localeCompare(right.catalog.backend, 'en'),
      )) {
        const identity = await assertFile(runtime.archivePath);
        const fileName = path.basename(runtime.archivePath);
        const signatureBase64 = sign(null, Buffer.from(identity.sha256, 'hex'), privatePem).toString('base64');
        await copyFile(runtime.archivePath, path.join(stagingDirectory, fileName));
        await chmod(path.join(stagingDirectory, fileName), 0o400);
        runtimeRecords.push({
          ...runtime.catalog,
          archiveFileName: fileName,
          archiveSizeBytes: identity.sizeBytes,
          archiveSha256: identity.sha256,
          archiveSignature: signatureBase64,
        });
        const manifest = packManifest({
          artifactKind: 'runtime',
          artifactId: `qualification-runtime-${runtime.catalog.backend}`,
          artifactRevision: runtime.catalog.packRevision,
          backend: runtime.catalog.backend,
          candidateSemVer: input.catalog.candidateSemVer,
          catalogRevision: input.catalog.catalogRevision,
          fileName,
          keyId,
          ...identity,
          signatureBase64,
        });
        await writeCanonicalJson(
          path.join(
            stagingDirectory,
            runtime.catalog.backend === 'cpu' ? 'runtime-pack.manifest.json' : 'runtime-cuda-pack.manifest.json',
          ),
          manifest,
        );
      }

      const modelIdentity = await assertFile(
        input.model.filePath,
        input.model.expectedSizeBytes,
        input.model.expectedSha256,
      );
      const modelFileName = path.basename(input.model.filePath);
      const modelSignature = sign(null, Buffer.from(modelIdentity.sha256, 'hex'), privatePem).toString('base64');
      await copyFile(input.model.filePath, path.join(stagingDirectory, modelFileName));
      await chmod(path.join(stagingDirectory, modelFileName), 0o400);
      await writeCanonicalJson(
        path.join(stagingDirectory, 'model-pack.manifest.json'),
        packManifest({
          artifactKind: 'model',
          artifactId: input.model.artifactId,
          artifactRevision: input.model.artifactRevision,
          backend: 'notApplicable',
          candidateSemVer: input.catalog.candidateSemVer,
          catalogRevision: input.catalog.catalogRevision,
          fileName: modelFileName,
          keyId,
          ...modelIdentity,
          signatureBase64: modelSignature,
        }),
      );

      const payload = new LocalWhisperQualificationCatalogProducer().produce({
        ...input.catalog,
        qualificationKeyId: keyId,
        runtimes: runtimeRecords,
      });
      const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload), 'utf8');
      const catalogBytes = Buffer.from(
        serializeCanonicalLocalWhisperCatalogJson({
          schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
          algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
          keyId,
          payloadBase64: payloadBytes.toString('base64'),
          signatureBase64: sign(null, payloadBytes, privatePem).toString('base64'),
        }),
        'utf8',
      );
      const catalogSha256 = sha256Bytes(catalogBytes);
      const keyring: LocalWhisperKeyringDocument = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'qualification',
        appRevision: `app-v${input.catalog.candidateSemVer}`,
        workerProtocolVersion: 1,
        publicKeys: [{ keyId, publicKeyPem: publicPem }],
        origins: payload.origins,
      };
      const evidenceDigests = runtimeRecords.map(({ archiveSha256 }) => archiveSha256);
      await Promise.all([
        writeFile(path.join(stagingDirectory, 'catalog.json'), catalogBytes, { mode: 0o400 }),
        writeFile(path.join(stagingDirectory, 'catalog.sha256'), `${catalogSha256}\n`, { mode: 0o400 }),
        writeCanonicalJson(path.join(stagingDirectory, 'keyring.json'), keyring),
        writeCanonicalJson(path.join(stagingDirectory, 'licenses.json'), {
          schemaVersion: 1,
          purpose: 'qualification',
          components: [{ id: 'qualification-licenses-v1', licenseId: 'MIT-and-CC-BY-4.0', review: 'pending' }],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'notices.json'), {
          schemaVersion: 1,
          purpose: 'qualification',
          notices: [
            { id: 'qualification-notices-v1', text: 'Qualification-only runtime and unchanged upstream models.' },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'provenance.json'), {
          schemaVersion: 1,
          purpose: 'qualification',
          records: [
            { id: 'qualification-runtime-provenance-v1', sourceCommit: input.catalog.sourceCommit, evidenceDigests },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'sbom.spdx.json'), {
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: 'local-whisper-linux-qualification',
          documentNamespace: `https://gpt-voice.local/spdx/${catalogSha256}`,
          packages: evidenceDigests.map((sha256, index) => ({
            SPDXID: `SPDXRef-Package-Runtime-${index + 1}`,
            name: `local-whisper-runtime-${index + 1}`,
            versionInfo: input.catalog.candidateSemVer,
            checksums: [{ algorithm: 'SHA256', checksumValue: sha256 }],
          })),
        }),
      ]);
      await destroyPrivateKey(privateKeyPath, Buffer.byteLength(privatePem));
      const files = await inspectFlatDirectory(stagingDirectory, ['bundle-manifest.json']);
      const manifest: LocalWhisperBundleManifest = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'qualification',
        keyId,
        catalogSha256,
        createdBy: 'local-whisper-qualification-producer',
        synthetic: false,
        files,
      };
      await writeCanonicalJson(path.join(stagingDirectory, 'bundle-manifest.json'), manifest);
      const bundleManifestSha256 = sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(manifest));
      const keyringSha256 = sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(keyring));
      await rename(stagingDirectory, outputDirectory);
      return Object.freeze({
        bundleDirectory: outputDirectory,
        bundleManifestSha256,
        catalogSha256,
        keyId,
        keyringSha256,
      });
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    } finally {
      await destroyPrivateKey(privateKeyPath, Math.max(4096, Buffer.byteLength(privatePem)));
      await rm(privateRoot, { recursive: true, force: true });
    }
  }
}
