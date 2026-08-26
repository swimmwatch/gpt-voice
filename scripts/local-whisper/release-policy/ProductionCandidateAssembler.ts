import { access, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { BundleVerifier } from '../packaging/BundleVerifier';
import { isRecord, isSha256 } from '../packaging/contracts';
import { readCanonicalJson, sha256Bytes, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';
import type { ProductionBundleDescriptor } from './ProductionBundleProducer';
import {
  productionReleaseCandidateDigest,
  type ReleaseAsset,
  type ReleaseAssetFormat,
  type ReleaseAssetPlatform,
  type ReleaseAssetRole,
  type ReleaseAssetTarget,
  type ReleaseCandidate,
} from './ReleaseProtocol';
import type {
  ProductionRuntimeArchive,
  ProductionRuntimePlatform,
  ProductionRuntimeTarget,
} from './ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from './ProductionSigningAuthority';

const SOURCE_COMMIT_PATTERN = /^[a-f\d]{40}$/u;
const SAFE_TARGET_PATTERN = /^[\dA-Za-z][\w.-]{0,127}$/u;
const RUNTIME_TARGETS = Object.freeze(['cpu', 'sm_120a-real'] as const);

export interface ProductionCandidatePlatformBundleInput {
  readonly bundleDirectory: string;
  readonly descriptorPath: string;
}

export interface ProductionCandidateAssemblerInput {
  readonly applicationDirectories: Readonly<Record<ProductionRuntimePlatform, string>>;
  readonly bundles: Readonly<Record<ProductionRuntimePlatform, ProductionCandidatePlatformBundleInput>>;
  readonly candidatePath: string;
  readonly candidateTarget: string;
  readonly outputDirectory: string;
  readonly runtimeDirectories: Readonly<Record<ProductionRuntimePlatform, string>>;
  readonly sourceCommit: string;
}

interface AssetDefinition {
  readonly format: ReleaseAssetFormat;
  readonly platform: ReleaseAssetPlatform;
  readonly role: ReleaseAssetRole;
  readonly target: ReleaseAssetTarget;
}

interface VerifiedBundleInput {
  readonly descriptor: ProductionBundleDescriptor;
  readonly directory: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseBundleDescriptor(
  value: unknown,
  platform: ProductionRuntimePlatform,
  candidateTarget: string,
  sourceCommit: string,
): ProductionBundleDescriptor {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.purpose !== 'production' ||
    value.platform !== platform ||
    value.releaseTarget !== candidateTarget ||
    value.sourceCommit !== sourceCommit ||
    typeof value.appRevision !== 'string' ||
    typeof value.signingKeyId !== 'string' ||
    !isSha256(value.bundleManifestSha256) ||
    !isSha256(value.catalogSha256)
  ) {
    throw new Error('Production bundle descriptor is invalid or cross-generation');
  }
  return value as unknown as ProductionBundleDescriptor;
}

function parseRuntimeArchive(
  value: unknown,
  platform: ProductionRuntimePlatform,
  target: ProductionRuntimeTarget,
): ProductionRuntimeArchive {
  if (
    !isRecord(value) ||
    value.purpose !== 'production' ||
    value.platform !== platform ||
    value.target !== target ||
    value.reproducible !== true ||
    value.transferProfile !== 'restricted-tar-gzip-v1' ||
    !isRecord(value.archive) ||
    typeof value.archive.file !== 'string' ||
    path.basename(value.archive.file) !== value.archive.file ||
    !Number.isSafeInteger(value.archive.sizeBytes) ||
    (value.archive.sizeBytes as number) <= 0 ||
    !isSha256(value.archive.sha256) ||
    value.archive.signatureInputSha256 !== value.archive.sha256
  ) {
    throw new Error('Production candidate runtime record is invalid');
  }
  return value as unknown as ProductionRuntimeArchive;
}

function applicationDefinition(platform: ProductionRuntimePlatform, fileName: string): AssetDefinition | null {
  if (platform === 'linux') {
    if (fileName.endsWith('.AppImage')) return { format: 'appimage', platform, role: 'application', target: 'app' };
    if (fileName.endsWith('.deb')) return { format: 'deb', platform, role: 'application', target: 'app' };
    if (fileName.endsWith('.rpm')) return { format: 'rpm', platform, role: 'application', target: 'app' };
    return null;
  }
  return fileName.endsWith('.exe') ? { format: 'nsis', platform, role: 'application', target: 'app' } : null;
}

function signatureFileName(fileName: string): string {
  return `${fileName}.sig`;
}

function runtimeCandidateFileName(platform: ProductionRuntimePlatform, archiveFileName: string): string {
  return `${platform}-${archiveFileName}`;
}

/** Assembles and signs the exact private candidate that later publication is allowed to consume unchanged. */
export class ProductionCandidateAssembler {
  private readonly verifier = new BundleVerifier();

  public constructor(private readonly signingAuthority: ProductionSigningAuthority) {}

  public async assemble(input: ProductionCandidateAssemblerInput): Promise<ReleaseCandidate> {
    if (!SOURCE_COMMIT_PATTERN.test(input.sourceCommit) || !SAFE_TARGET_PATTERN.test(input.candidateTarget)) {
      throw new Error('Production candidate identity is invalid');
    }
    const outputDirectory = path.resolve(input.outputDirectory);
    const candidatePath = path.resolve(input.candidatePath);
    const candidateRelative = path.relative(outputDirectory, candidatePath);
    if (
      candidateRelative === '' ||
      (!candidateRelative.startsWith('..') && !path.isAbsolute(candidateRelative)) ||
      (await exists(outputDirectory)) ||
      (await exists(candidatePath))
    ) {
      throw new Error('Production candidate outputs must be fresh and separately rooted');
    }
    await mkdir(path.dirname(outputDirectory), { recursive: true, mode: 0o700 });
    await mkdir(path.dirname(candidatePath), { recursive: true, mode: 0o700 });
    const stagingDirectory = await mkdtemp(path.join(path.dirname(outputDirectory), '.production-candidate-'));
    try {
      const bundles = await this.verifyBundles(input);
      const appRevision = bundles.linux.descriptor.appRevision;
      if (
        bundles.win32.descriptor.appRevision !== appRevision ||
        bundles.linux.descriptor.signingKeyId !== this.signingAuthority.keyId ||
        bundles.win32.descriptor.signingKeyId !== this.signingAuthority.keyId
      ) {
        throw new Error('Production platform bundles do not share one app/signing identity');
      }

      const assets: ReleaseAsset[] = [];
      for (const platform of ['linux', 'win32'] as const) {
        const applicationEntries = await readdir(path.resolve(input.applicationDirectories[platform]), {
          withFileTypes: true,
        });
        const applications = applicationEntries
          .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
          .map((entry) => ({ entry, definition: applicationDefinition(platform, entry.name) }))
          .filter(
            (value): value is { entry: (typeof applicationEntries)[number]; definition: AssetDefinition } =>
              value.definition !== null,
          );
        if (applications.length !== (platform === 'linux' ? 3 : 1)) {
          throw new Error(`Production ${platform} application inventory is incomplete or ambiguous`);
        }
        for (const application of applications) {
          assets.push(
            await this.copyAndSign(
              path.join(path.resolve(input.applicationDirectories[platform]), application.entry.name),
              stagingDirectory,
              application.entry.name,
              application.definition,
            ),
          );
        }

        for (const target of RUNTIME_TARGETS) {
          const runtimeDirectory = path.join(path.resolve(input.runtimeDirectories[platform]), target);
          const runtime = parseRuntimeArchive(
            await readCanonicalJson(path.join(runtimeDirectory, 'runtime-archive.json')),
            platform,
            target,
          );
          assets.push(
            await this.copyAndSign(
              path.join(runtimeDirectory, runtime.archive.file),
              stagingDirectory,
              runtimeCandidateFileName(platform, runtime.archive.file),
              {
                format: 'restricted-tar-gzip-v1',
                platform,
                role: 'runtime',
                target,
              },
              runtime.archive,
            ),
          );
        }
      }

      const metadataAssets = await this.createMetadataAssets(
        stagingDirectory,
        bundles,
        input.candidateTarget,
        input.sourceCommit,
        appRevision,
      );
      assets.push(...metadataAssets);
      const checksums = await this.writeChecksums(stagingDirectory, assets);
      assets.push(checksums);

      const candidateInputDigest = sha256Bytes(
        serializeCanonicalLocalWhisperCatalogJson({
          schemaVersion: 1,
          purpose: 'production',
          target: input.candidateTarget,
          sourceCommit: input.sourceCommit,
          appRevision,
          platformBundles: [bundles.linux.descriptor, bundles.win32.descriptor].map((descriptor) => ({
            platform: descriptor.platform,
            bundleManifestSha256: descriptor.bundleManifestSha256,
            catalogSha256: descriptor.catalogSha256,
          })),
        }),
      );
      const manifestAsset = await this.writeReleaseManifest(
        stagingDirectory,
        assets,
        candidateInputDigest,
        input.candidateTarget,
      );
      assets.push(manifestAsset);

      const manifestSignature = manifestAsset.signature;
      const candidateWithoutDigest = Object.freeze({
        assets: Object.freeze([...assets]),
        candidateInputDigest,
        manifestSignature,
        purpose: 'production' as const,
        target: input.candidateTarget,
      });
      const candidate: ReleaseCandidate = Object.freeze({
        ...candidateWithoutDigest,
        releaseCandidateDigest: productionReleaseCandidateDigest(candidateWithoutDigest),
      });
      await rename(stagingDirectory, outputDirectory);
      await writeCanonicalJson(candidatePath, candidate);
      return candidate;
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  private async verifyBundles(
    input: ProductionCandidateAssemblerInput,
  ): Promise<Readonly<Record<ProductionRuntimePlatform, VerifiedBundleInput>>> {
    const verified = await Promise.all(
      (['linux', 'win32'] as const).map(async (platform) => {
        const descriptor = parseBundleDescriptor(
          await readCanonicalJson(input.bundles[platform].descriptorPath),
          platform,
          input.candidateTarget,
          input.sourceCommit,
        );
        const bundle = await this.verifier.verify(input.bundles[platform].bundleDirectory, {
          purpose: 'production',
          manifestSha256: descriptor.bundleManifestSha256,
        });
        await this.verifier.verifyProductionApproval(bundle);
        if (bundle.manifest.catalogSha256 !== descriptor.catalogSha256) {
          throw new Error('Production bundle descriptor changed after signing');
        }
        return [platform, Object.freeze({ descriptor, directory: bundle.directory })] as const;
      }),
    );
    return Object.freeze(Object.fromEntries(verified)) as Readonly<
      Record<ProductionRuntimePlatform, VerifiedBundleInput>
    >;
  }

  private async copyAndSign(
    sourcePath: string,
    outputDirectory: string,
    fileName: string,
    definition: AssetDefinition,
    expected?: Readonly<{ readonly sha256: string; readonly sizeBytes: number }>,
  ): Promise<ReleaseAsset> {
    const source = path.resolve(sourcePath);
    const metadata = await lstat(source);
    const sha256 = await sha256File(source);
    if (
      path.basename(fileName) !== fileName ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size <= 0 ||
      (expected !== undefined && (metadata.size !== expected.sizeBytes || sha256 !== expected.sha256))
    ) {
      throw new Error(`Production candidate asset is invalid: ${fileName}`);
    }
    await copyFile(source, path.join(outputDirectory, fileName));
    if ((await sha256File(path.join(outputDirectory, fileName))) !== sha256) {
      throw new Error(`Production candidate asset changed while collecting: ${fileName}`);
    }
    return this.writeSignature(outputDirectory, fileName, metadata.size, sha256, definition);
  }

  private async writeGeneratedAsset(
    outputDirectory: string,
    fileName: string,
    value: unknown,
    definition: AssetDefinition,
  ): Promise<ReleaseAsset> {
    const filePath = path.join(outputDirectory, fileName);
    if (typeof value === 'string') await writeFile(filePath, value, { flag: 'wx', mode: 0o600 });
    else await writeCanonicalJson(filePath, value);
    const metadata = await lstat(filePath);
    return this.writeSignature(outputDirectory, fileName, metadata.size, await sha256File(filePath), definition);
  }

  private async writeSignature(
    outputDirectory: string,
    fileName: string,
    length: number,
    sha256: string,
    definition: AssetDefinition,
  ): Promise<ReleaseAsset> {
    const signature = this.signingAuthority.signArtifactDigestSha256(sha256);
    const signatureName = signatureFileName(fileName);
    await writeCanonicalJson(path.join(outputDirectory, signatureName), {
      algorithm: signature.algorithm,
      keyId: signature.keyId,
      signedSha256: sha256,
      signatureBase64: signature.signatureBase64,
    });
    const signatureMetadata = await lstat(path.join(outputDirectory, signatureName));
    return Object.freeze({
      fileName,
      ...definition,
      length,
      sha256,
      signature: Object.freeze({
        fileName: signatureName,
        keyId: signature.keyId,
        length: signatureMetadata.size,
        sha256: await sha256File(path.join(outputDirectory, signatureName)),
      }),
    });
  }

  private async createMetadataAssets(
    outputDirectory: string,
    bundles: Readonly<Record<ProductionRuntimePlatform, VerifiedBundleInput>>,
    candidateTarget: string,
    sourceCommit: string,
    appRevision: string,
  ): Promise<readonly ReleaseAsset[]> {
    const [linuxCatalog, windowsCatalog, linuxKeyring, windowsKeyring, linuxSbom, windowsSbom] = await Promise.all([
      readFile(path.join(bundles.linux.directory, 'catalog.json')),
      readFile(path.join(bundles.win32.directory, 'catalog.json')),
      readFile(path.join(bundles.linux.directory, 'keyring.json')),
      readFile(path.join(bundles.win32.directory, 'keyring.json')),
      readCanonicalJson(path.join(bundles.linux.directory, 'sbom.spdx.json')),
      readCanonicalJson(path.join(bundles.win32.directory, 'sbom.spdx.json')),
    ]);
    if (!linuxKeyring.equals(windowsKeyring)) {
      throw new Error('Production platform keyrings are not byte-identical');
    }
    const global = (role: ReleaseAssetRole, format: ReleaseAssetFormat): AssetDefinition => ({
      format,
      platform: 'global',
      role,
      target: 'release',
    });
    return Promise.all([
      this.writeGeneratedAsset(
        outputDirectory,
        'local-whisper-catalogs.json',
        {
          schemaVersion: 1,
          purpose: 'production',
          target: candidateTarget,
          catalogs: [
            {
              platform: 'linux',
              sha256: sha256Bytes(linuxCatalog),
              documentBase64: linuxCatalog.toString('base64'),
            },
            {
              platform: 'win32',
              sha256: sha256Bytes(windowsCatalog),
              documentBase64: windowsCatalog.toString('base64'),
            },
          ],
        },
        global('catalog', 'json'),
      ),
      this.copyAndSign(
        path.join(bundles.linux.directory, 'keyring.json'),
        outputDirectory,
        'local-whisper-keyring.json',
        global('keyring', 'json'),
      ),
      this.writeGeneratedAsset(
        outputDirectory,
        'release-sbom.spdx.json',
        {
          spdxVersion: 'SPDX-2.3',
          dataLicense: 'CC0-1.0',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: 'gpt-voice-local-whisper-production-candidate',
          documentNamespace: `https://gpt-voice.local/spdx/${candidateTarget}`,
          platformDocuments: [linuxSbom, windowsSbom],
        },
        global('sbom', 'json'),
      ),
      this.writeGeneratedAsset(
        outputDirectory,
        'THIRD_PARTY_NOTICES.txt',
        [
          'GPT-Voice Local Whisper production candidate',
          'whisper.cpp: MIT',
          'NVIDIA CUDA 12.8.1 redistributable runtime: NVIDIA CUDA EULA',
          'Model objects remain at the six catalog-pinned Hugging Face origins and are not redistributed here.',
          '',
        ].join('\n'),
        global('notices', 'text'),
      ),
      this.writeGeneratedAsset(
        outputDirectory,
        'release-provenance.json',
        {
          schemaVersion: 1,
          purpose: 'production',
          candidateTarget,
          sourceCommit,
          appRevision,
          platformBundles: [bundles.linux.descriptor, bundles.win32.descriptor],
        },
        global('provenance', 'json'),
      ),
      this.writeGeneratedAsset(
        outputDirectory,
        'local-whisper-compatibility.json',
        {
          schemaVersion: 1,
          appRevision,
          platforms: ['linux-x64', 'win32-x64'],
          runtimeTargets: ['cpu', 'sm_120a-real'],
          transferProfiles: ['restricted-tar-gzip-v1', 'pinned-raw-model-v1'],
          models: LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
        },
        global('compatibility', 'json'),
      ),
    ]);
  }

  private async writeChecksums(outputDirectory: string, assets: readonly ReleaseAsset[]): Promise<ReleaseAsset> {
    const lines = assets
      .flatMap((asset) => [
        `${asset.sha256}  ${asset.fileName}`,
        `${asset.signature.sha256}  ${asset.signature.fileName}`,
      ])
      .sort();
    return this.writeGeneratedAsset(outputDirectory, 'SHA256SUMS.txt', `${lines.join('\n')}\n`, {
      format: 'text',
      platform: 'global',
      role: 'checksums',
      target: 'release',
    });
  }

  private async writeReleaseManifest(
    outputDirectory: string,
    assets: readonly ReleaseAsset[],
    candidateInputDigest: string,
    candidateTarget: string,
  ): Promise<ReleaseAsset> {
    return this.writeGeneratedAsset(
      outputDirectory,
      'release-manifest.json',
      {
        schemaVersion: 1,
        purpose: 'production',
        candidateInputDigest,
        candidateTarget,
        assets: [...assets].sort((left, right) => left.fileName.localeCompare(right.fileName, 'en')),
      },
      { format: 'json', platform: 'global', role: 'manifest', target: 'release' },
    );
  }
}
