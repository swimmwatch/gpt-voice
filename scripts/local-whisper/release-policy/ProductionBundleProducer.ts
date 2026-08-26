import { access, chmod, copyFile, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import {
  LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
  isRecord,
  isSha256,
  type LocalWhisperBundleManifest,
  type LocalWhisperKeyringDocument,
  type LocalWhisperPackManifest,
  type LocalWhisperProductionApproval,
} from '../packaging/contracts';
import {
  inspectFlatDirectory,
  readCanonicalJson,
  sha256Bytes,
  sha256File,
  writeCanonicalJson,
} from '../packaging/fileIntegrity';
import { ProductionCatalogProducer, type ProductionCatalogRuntimeSeed } from './ProductionCatalogProducer';
import {
  type ProductionRuntimeArchive,
  type ProductionRuntimePlatform,
  type ProductionRuntimeTarget,
} from './ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from './ProductionSigningAuthority';

const SOURCE_COMMIT_PATTERN = /^[a-f\d]{40}$/u;
const SAFE_ID_PATTERN = /^[\dA-Za-z][\w.-]{0,255}$/u;
const RUNTIME_TARGETS = Object.freeze(['cpu', 'sm_120a-real'] as const);
const MODEL_MEMORY_ESTIMATES = Object.freeze([
  Object.freeze({ modelFamily: 'tiny', ramBytes: 4 * 1024 ** 3, vramBytes: 2 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'base', ramBytes: 4 * 1024 ** 3, vramBytes: 2 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'small', ramBytes: 6 * 1024 ** 3, vramBytes: 3 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'medium', ramBytes: 10 * 1024 ** 3, vramBytes: 6 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'large-v3', ramBytes: 16 * 1024 ** 3, vramBytes: 8 * 1024 ** 3 }),
  Object.freeze({ modelFamily: 'large-v3-turbo', ramBytes: 10 * 1024 ** 3, vramBytes: 6 * 1024 ** 3 }),
]);

export interface ProductionBundleDescriptor {
  readonly appRevision: string;
  readonly bundleManifestSha256: string;
  readonly catalogSha256: string;
  readonly platform: ProductionRuntimePlatform;
  readonly purpose: 'production';
  readonly releaseTarget: string;
  readonly schemaVersion: 1;
  readonly signingKeyId: string;
  readonly sourceCommit: string;
}

export interface ProductionBundleInput {
  readonly appRevision: string;
  readonly approvedAt: string;
  readonly approvedBy: string;
  readonly outputDirectory: string;
  readonly platform: ProductionRuntimePlatform;
  readonly releaseTarget: string;
  readonly runtimeDirectories: Readonly<Record<ProductionRuntimeTarget, string>>;
  readonly sourceCommit: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseRuntimeArchive(value: unknown, platform: ProductionRuntimePlatform, target: ProductionRuntimeTarget) {
  if (
    !isRecord(value) ||
    value.purpose !== 'production' ||
    value.platform !== platform ||
    value.target !== target ||
    value.reproducible !== true ||
    value.transferProfile !== 'restricted-tar-gzip-v1' ||
    typeof value.profileId !== 'string' ||
    !isRecord(value.archive) ||
    typeof value.archive.file !== 'string' ||
    path.basename(value.archive.file) !== value.archive.file ||
    !Number.isSafeInteger(value.archive.sizeBytes) ||
    (value.archive.sizeBytes as number) <= 0 ||
    !isSha256(value.archive.sha256) ||
    value.archive.signatureInputSha256 !== value.archive.sha256 ||
    !Array.isArray(value.expectedFiles) ||
    value.expectedFiles.length === 0 ||
    !isRecord(value.evidence) ||
    !isSha256(value.evidence.runtimeManifestSha256) ||
    !isSha256(value.evidence.provenanceSha256) ||
    !isSha256(value.evidence.sbomSha256) ||
    !isSha256(value.evidence.noticesSha256)
  ) {
    throw new Error('Production runtime archive record is invalid');
  }
  return value as unknown as ProductionRuntimeArchive;
}

function runtimeDependencies(platform: ProductionRuntimePlatform, target: ProductionRuntimeTarget): readonly string[] {
  if (platform === 'linux' && target === 'cpu') return ['glibc-2.39', 'libstdcxx-gcc-13'];
  if (platform === 'win32' && target === 'cpu') return ['microsoft-vc-runtime-14.51.36247.0'];
  return platform === 'linux'
    ? ['cuda-runtime-12.8.1', 'cublas-12.8.1', 'cublas-lt-12.8.1', 'glibc-2.39']
    : ['cuda-runtime-12.8.1', 'cublas-12.8.1', 'cublas-lt-12.8.1', 'microsoft-vc-runtime-14.51.36247.0'];
}

function runtimePackManifest(input: {
  readonly appRevision: string;
  readonly archive: ProductionRuntimeArchive;
  readonly catalogRevision: string;
  readonly signatureBase64: string;
  readonly signingKeyId: string;
}): LocalWhisperPackManifest {
  const cpu = input.archive.target === 'cpu';
  const dependencies = runtimeDependencies(input.archive.platform, input.archive.target);
  return Object.freeze({
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    purpose: 'production',
    artifactKind: 'runtime',
    artifactId: `production-runtime-${input.archive.platform}-${input.archive.target}`,
    platform: input.archive.platform,
    architecture: 'x64',
    engine: 'whisperCpp',
    target: cpu ? 'cpu' : 'gpu',
    backend: cpu ? 'cpu' : 'cuda',
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    appRevision: input.appRevision,
    catalogRevision: input.catalogRevision,
    artifactRevision:
      input.archive.platform === 'linux'
        ? cpu
          ? 'whisper-cpp-linux-x64-cpu-baseline-v1'
          : 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1'
        : cpu
          ? 'whisper-cpp-windows-x64-cpu-v1'
          : 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
    sizeBytes: input.archive.archive.sizeBytes,
    sha256: input.archive.archive.sha256,
    signatureBase64: input.signatureBase64,
    signingKeyId: input.signingKeyId,
    expectedFiles: [
      Object.freeze({
        path: input.archive.archive.file,
        sizeBytes: input.archive.archive.sizeBytes,
        sha256: input.archive.archive.sha256,
      }),
    ],
    dynamicDependencies: dependencies,
    compatibilityRows: [`${input.archive.platform}-x64-${cpu ? 'cpu' : 'cuda'}-v1`],
    memoryEstimates: MODEL_MEMORY_ESTIMATES.map((estimate) => ({
      ...estimate,
      vramBytes: cpu ? ('notApplicable' as const) : estimate.vramBytes,
    })),
    source: {
      lockId: 'whisper-cpp-v1.9.1-f049fff',
      commit: 'f049fff95a089aa9969deb009cdd4892b3e74916',
      tree: 'f49541eaed447bce9b5e3598cc7a487ce5e54678',
      subset: 'complete-pinned-tree',
      patch: 'local-whisper-whisper-cpp-device-cancel-v1',
    },
    build: {
      packDefinitionId: `${input.archive.platform}-x64-${cpu ? 'cpu' : 'cuda'}-pack-v1`,
      toolchain: input.archive.profileId,
      options: ['disconnected', 'deterministic', 'network-denied'],
      acceleratorArchitectures: cpu ? [] : ['sm-120a-real'],
    },
    licenseIds: cpu ? ['mit-license'] : ['mit-license', 'nvidia-cuda-eula-12.8.1'],
    noticeIds: [`production-${input.archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-notice`],
    sbomId: `production-${input.archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-sbom`,
    provenanceId: `production-${input.archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-provenance`,
    supportTier: 'production',
    redistributionReview: 'approved',
  });
}

function runtimeCatalogSeed(archive: ProductionRuntimeArchive, signatureBase64: string): ProductionCatalogRuntimeSeed {
  const cpu = archive.target === 'cpu';
  return Object.freeze({
    archiveFileName: archive.archive.file,
    archiveSha256: archive.archive.sha256,
    archiveSignature: signatureBase64,
    archiveSizeBytes: archive.archive.sizeBytes,
    buildRevision: archive.evidence.runtimeManifestSha256,
    expectedFiles: Object.freeze(
      archive.expectedFiles.map((file) =>
        Object.freeze({
          ...file,
          fileId: file.fileId as ProductionCatalogRuntimeSeed['expectedFiles'][number]['fileId'],
        }),
      ),
    ),
    licenseIds: cpu ? ['mit-license'] : ['mit-license', 'nvidia-cuda-eula-12.8.1'],
    noticeIds: [`production-${archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-notice`],
    platform: archive.platform,
    prerequisites: runtimeDependencies(archive.platform, archive.target),
    profileDigest: archive.evidence.provenanceSha256,
    profileId: archive.profileId,
    provenanceId: `production-${archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-provenance`,
    sbomRevision: `production-${archive.platform}-${cpu ? 'cpu' : 'cuda'}-runtime-sbom-v1`,
    target: archive.target,
  });
}

/** Creates one signed per-platform production bundle without copying any model object. */
export class ProductionBundleProducer {
  public constructor(private readonly signingAuthority: ProductionSigningAuthority) {}

  public async produce(input: ProductionBundleInput): Promise<ProductionBundleDescriptor> {
    if (
      !SOURCE_COMMIT_PATTERN.test(input.sourceCommit) ||
      !SAFE_ID_PATTERN.test(input.appRevision) ||
      !SAFE_ID_PATTERN.test(input.releaseTarget) ||
      !SAFE_ID_PATTERN.test(input.approvedBy) ||
      !Number.isFinite(Date.parse(input.approvedAt)) ||
      new Date(input.approvedAt).toISOString() !== input.approvedAt
    ) {
      throw new Error('Production bundle identity or approval input is invalid');
    }
    const outputDirectory = path.resolve(input.outputDirectory);
    if (await exists(outputDirectory)) throw new Error('Production bundle output already exists');
    await mkdir(path.dirname(outputDirectory), { recursive: true, mode: 0o700 });
    const stagingDirectory = await mkdtemp(path.join(path.dirname(outputDirectory), '.local-whisper-production-'));
    try {
      const archives = await Promise.all(
        RUNTIME_TARGETS.map(async (target) => {
          const directory = path.resolve(input.runtimeDirectories[target]);
          const record = parseRuntimeArchive(
            await readCanonicalJson(path.join(directory, 'runtime-archive.json')),
            input.platform,
            target,
          );
          const source = path.join(directory, record.archive.file);
          const metadata = await stat(source);
          if (
            !metadata.isFile() ||
            metadata.size !== record.archive.sizeBytes ||
            (await sha256File(source)) !== record.archive.sha256
          ) {
            throw new Error('Production runtime archive bytes changed before signing');
          }
          await copyFile(source, path.join(stagingDirectory, record.archive.file));
          await chmod(path.join(stagingDirectory, record.archive.file), 0o400);
          return record;
        }),
      );
      const catalogRevision = `production-catalog-${input.appRevision}-${input.platform}`;
      const runtimeSignatures = archives.map((archive) =>
        this.signingAuthority.signArtifactDigestSha256(archive.archive.sha256),
      );
      const runtimeManifests = archives.map((archive, index) =>
        runtimePackManifest({
          appRevision: input.appRevision,
          archive,
          catalogRevision,
          signatureBase64: runtimeSignatures[index].signatureBase64,
          signingKeyId: this.signingAuthority.keyId,
        }),
      );
      await Promise.all(
        runtimeManifests.map((manifest) =>
          writeCanonicalJson(
            path.join(
              stagingDirectory,
              manifest.backend === 'cpu' ? 'runtime-pack.manifest.json' : 'runtime-cuda-pack.manifest.json',
            ),
            manifest,
          ),
        ),
      );

      const payload = new ProductionCatalogProducer().produce({
        appRevision: input.appRevision,
        catalogRevision,
        platform: input.platform,
        releaseTarget: input.releaseTarget,
        runtimes: archives.map((archive, index) =>
          runtimeCatalogSeed(archive, runtimeSignatures[index].signatureBase64),
        ),
        signingKeyId: this.signingAuthority.keyId,
        sourceCommit: input.sourceCommit,
      });
      const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload), 'utf8');
      const catalogSignature = this.signingAuthority.signCatalogPayload(payloadBytes);
      const catalogBytes = Buffer.from(
        serializeCanonicalLocalWhisperCatalogJson({
          schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
          algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
          keyId: catalogSignature.keyId,
          payloadBase64: payloadBytes.toString('base64'),
          signatureBase64: catalogSignature.signatureBase64,
        }),
        'utf8',
      );
      const catalogSha256 = sha256Bytes(catalogBytes);
      const keyring: LocalWhisperKeyringDocument = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'production',
        appRevision: input.appRevision,
        workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        publicKeys: [{ keyId: this.signingAuthority.keyId, publicKeyPem: this.signingAuthority.exportPublicKeyPem() }],
        origins: payload.origins,
      };
      const approval: LocalWhisperProductionApproval = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'production',
        approvalId: `production-bundle-${input.platform}-${input.sourceCommit.slice(0, 12)}`,
        approvedAt: input.approvedAt,
        approvedBy: input.approvedBy,
        originPolicyId: 'production-origin-policy-v1',
        licenseReviewId: 'redistribution-review-v1',
        redistributionApproved: true,
        frozenCatalogSha256: catalogSha256,
        approvedSourceLockIds: ['whisper-cpp-v1.9.1-f049fff'],
        approvedToolchainProfileIds: runtimeManifests.map(({ build }) => build.toolchain).sort(),
        approvedPackDefinitionIds: runtimeManifests.map(({ build }) => build.packDefinitionId).sort(),
        approvedOriginIds: payload.origins.map(({ id }) => String(id)).sort(),
        approvedSigningKeyIds: [this.signingAuthority.keyId],
      };
      const evidenceDigests = archives.map(({ evidence }) => evidence.provenanceSha256);
      await Promise.all([
        writeFile(path.join(stagingDirectory, 'catalog.json'), catalogBytes, { mode: 0o400 }),
        writeFile(path.join(stagingDirectory, 'catalog.sha256'), `${catalogSha256}\n`, { mode: 0o400 }),
        writeCanonicalJson(path.join(stagingDirectory, 'keyring.json'), keyring),
        writeCanonicalJson(path.join(stagingDirectory, 'production-approval.json'), approval),
        writeCanonicalJson(path.join(stagingDirectory, 'licenses.json'), {
          schemaVersion: 1,
          purpose: 'production',
          components: [
            { id: 'whisper-cpp-mit', licenseId: 'MIT', review: 'approved' },
            { id: 'nvidia-cuda-12.8.1', licenseId: 'NVIDIA-CUDA-EULA', review: 'approved' },
            { id: 'whisper-models', licenseId: 'MIT', review: 'approved-upstream-download' },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'notices.json'), {
          schemaVersion: 1,
          purpose: 'production',
          notices: [
            {
              id: `production-${input.platform}-notices-v1`,
              text: 'Runtime components are release-hosted; six pinned model objects remain at Hugging Face.',
            },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'provenance.json'), {
          schemaVersion: 1,
          purpose: 'production',
          records: [
            {
              id: `production-${input.platform}-runtime-provenance-v1`,
              sourceCommit: input.sourceCommit,
              releaseTarget: input.releaseTarget,
              evidenceDigests,
            },
          ],
        }),
        writeCanonicalJson(path.join(stagingDirectory, 'sbom.spdx.json'), {
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: `local-whisper-${input.platform}-production`,
          documentNamespace: `https://gpt-voice.local/spdx/${catalogSha256}`,
          packages: [
            ...archives.map((archive, index) => ({
              SPDXID: `SPDXRef-Package-Runtime-${index + 1}`,
              name: archive.archive.file,
              versionInfo: input.appRevision,
              checksums: [{ algorithm: 'SHA256', checksumValue: archive.archive.sha256 }],
            })),
            ...LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map((model, index) => ({
              SPDXID: `SPDXRef-Package-Model-${index + 1}`,
              name: model.file,
              versionInfo: '5359861c739e955e79d9a303bcbc70fb988958b1',
              checksums: [{ algorithm: 'SHA256', checksumValue: model.sha256 }],
            })),
          ],
        }),
      ]);
      const files = await inspectFlatDirectory(stagingDirectory, ['bundle-manifest.json']);
      const manifest: LocalWhisperBundleManifest = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        purpose: 'production',
        keyId: this.signingAuthority.keyId,
        catalogSha256,
        createdBy: 'external-production-authority',
        synthetic: false,
        files,
      };
      await writeCanonicalJson(path.join(stagingDirectory, 'bundle-manifest.json'), manifest);
      const bundleManifestSha256 = sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(manifest));
      await rename(stagingDirectory, outputDirectory);
      return Object.freeze({
        appRevision: input.appRevision,
        bundleManifestSha256,
        catalogSha256,
        platform: input.platform,
        purpose: 'production',
        releaseTarget: input.releaseTarget,
        schemaVersion: 1,
        signingKeyId: this.signingAuthority.keyId,
        sourceCommit: input.sourceCommit,
      });
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }
}
