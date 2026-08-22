import { createHash } from 'node:crypto';

import { ReleaseProtocolError } from './ReleaseProtocolError';

export { ReleaseProtocolError } from './ReleaseProtocolError';

const SHA_256 = /^[a-f\d]{64}$/u;
const SAFE_FILE_NAME = /^\w[\w.-]{0,255}$/u;
const SAFE_KEY_ID = /^\w[\w.-]{0,127}$/u;
const ALPHA_TARGET = 'v2.4.0-alpha.1';
const FINAL_TARGET = 'v2.4.0';
const ALPHA_BRANCH = 'release/v2.4.0-alpha.1';
const FINAL_BRANCH = 'release/v2.4.0';
const PRIVATE_CANDIDATE_TARGET = /^task32-[a-z0-9][a-z0-9.-]{0,95}$/u;

const RELEASE_PLATFORMS = Object.freeze(['linux', 'win32'] as const);
const ASSET_PLATFORMS = Object.freeze(['linux', 'win32', 'global'] as const);
const EXPECTED_ASSET_IDENTITIES = Object.freeze([
  'linux|application|app|appimage',
  'linux|application|app|deb',
  'linux|application|app|rpm',
  'win32|application|app|nsis',
  'linux|runtime|cpu|restricted-tar-gzip-v1',
  'win32|runtime|cpu|restricted-tar-gzip-v1',
  'linux|runtime|sm_120a-real|restricted-tar-gzip-v1',
  'win32|runtime|sm_120a-real|restricted-tar-gzip-v1',
  'global|catalog|release|json',
  'global|keyring|release|json',
  'global|checksums|release|text',
  'global|manifest|release|json',
  'global|sbom|release|json',
  'global|notices|release|text',
  'global|provenance|release|json',
  'global|compatibility|release|json',
]);

export type ReleasePlatform = (typeof RELEASE_PLATFORMS)[number];
export type ReleaseAssetPlatform = (typeof ASSET_PLATFORMS)[number];
export type ReleaseRuntimeTarget = 'cpu' | 'sm_120a-real';
export type ReleaseAssetRole =
  | 'application'
  | 'runtime'
  | 'catalog'
  | 'keyring'
  | 'checksums'
  | 'manifest'
  | 'sbom'
  | 'notices'
  | 'provenance'
  | 'compatibility';
export type ReleaseAssetTarget = 'app' | ReleaseRuntimeTarget | 'release';
export type ReleaseAssetFormat = 'appimage' | 'deb' | 'rpm' | 'nsis' | 'restricted-tar-gzip-v1' | 'json' | 'text';

export interface ReleaseAssetSignature {
  readonly fileName: string;
  readonly keyId: string;
  readonly length: number;
  readonly sha256: string;
}

/** One content file and its required detached/native signature in the physical release inventory. */
export interface ReleaseAsset {
  readonly fileName: string;
  readonly format: ReleaseAssetFormat;
  readonly length: number;
  readonly platform: ReleaseAssetPlatform;
  readonly role: ReleaseAssetRole;
  readonly sha256: string;
  readonly signature: ReleaseAssetSignature;
  readonly target: ReleaseAssetTarget;
}

export interface ReleaseCandidate {
  readonly assets: readonly ReleaseAsset[];
  readonly candidateInputDigest: string;
  readonly manifestSignature: ReleaseAssetSignature;
  readonly purpose: 'production';
  readonly releaseCandidateDigest: string;
  readonly target: string;
}

export type ReleaseCandidateTargetKind = 'private' | 'release';

export function isReleaseCandidateTarget(value: unknown, kind: ReleaseCandidateTargetKind): value is string {
  return (
    typeof value === 'string' &&
    (kind === 'private' ? PRIVATE_CANDIDATE_TARGET.test(value) : value === ALPHA_TARGET || value === FINAL_TARGET)
  );
}

export interface ReleaseStaging {
  readonly candidateInputDigest: string;
  readonly purpose: 'production';
  readonly releaseCandidateDigest: string;
  readonly releaseStagingDigest: string;
  readonly stagedAssets: readonly ReleaseAsset[];
  readonly tag: string;
}

export interface AlphaDeployment {
  readonly deploymentDigest: string;
  readonly prerelease: boolean;
  readonly public: boolean;
  readonly releaseStagingDigest: string;
  readonly target: typeof ALPHA_TARGET;
}

export interface AlphaSmoke {
  readonly deploymentDigest: string;
  readonly platform: ReleasePlatform;
  readonly status: 'Pass' | 'Fail';
}

export interface ReleasePreparation {
  readonly branch: string;
  readonly changelogCommitted: true;
  readonly cleanHead: true;
  readonly manualRegistryCommitted: true;
  readonly mergePolicy: 'preserving-merge-only';
  readonly tag: string;
  readonly target: string;
  readonly versionCommitted: true;
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && SHA_256.test(value);
}

function assertDigest(value: unknown, code: string): asserts value is string {
  if (!isDigest(value)) throw new ReleaseProtocolError(code);
}

function assertSafeFileName(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_FILE_NAME.test(value)) throw new ReleaseProtocolError(code);
}

function assetIdentity(asset: ReleaseAsset): string {
  return `${asset.platform}|${asset.role}|${asset.target}|${asset.format}`;
}

/** Derives the candidate digest from its closed target and exact signature-bound physical inventory. */
export function productionReleaseCandidateDigest(
  candidate: Pick<ReleaseCandidate, 'assets' | 'candidateInputDigest' | 'purpose' | 'target'>,
): string {
  const assets = [...candidate.assets]
    .sort((left, right) => assetIdentity(left).localeCompare(assetIdentity(right), 'en'))
    .map((asset) => ({
      fileName: asset.fileName,
      format: asset.format,
      length: asset.length,
      platform: asset.platform,
      role: asset.role,
      sha256: asset.sha256,
      signature: {
        fileName: asset.signature.fileName,
        keyId: asset.signature.keyId,
        length: asset.signature.length,
        sha256: asset.signature.sha256,
      },
      target: asset.target,
    }));
  return createHash('sha256')
    .update(
      JSON.stringify({
        assets,
        candidateInputDigest: candidate.candidateInputDigest,
        purpose: candidate.purpose,
        target: candidate.target,
      }),
    )
    .digest('hex');
}

function expectedFormat(asset: Pick<ReleaseAsset, 'platform' | 'role' | 'target'>): ReleaseAssetFormat | undefined {
  if (asset.role === 'application' && asset.platform === 'linux' && asset.target === 'app') return undefined;
  if (asset.role === 'application' && asset.platform === 'win32' && asset.target === 'app') return 'nsis';
  if (asset.role === 'runtime' && (asset.platform === 'linux' || asset.platform === 'win32')) {
    return asset.target === 'cpu' || asset.target === 'sm_120a-real' ? 'restricted-tar-gzip-v1' : undefined;
  }
  if (asset.platform !== 'global' || asset.target !== 'release') return undefined;
  if (asset.role === 'checksums' || asset.role === 'notices') return 'text';
  if (['catalog', 'keyring', 'manifest', 'sbom', 'provenance', 'compatibility'].includes(asset.role)) {
    return 'json';
  }
  return undefined;
}

function isLinuxApplicationFormat(value: ReleaseAssetFormat): boolean {
  return value === 'appimage' || value === 'deb' || value === 'rpm';
}

function assertSignature(signature: ReleaseAssetSignature, code: string): void {
  assertSafeFileName(signature.fileName, code);
  if (
    !Number.isSafeInteger(signature.length) ||
    signature.length <= 0 ||
    typeof signature.keyId !== 'string' ||
    !SAFE_KEY_ID.test(signature.keyId)
  ) {
    throw new ReleaseProtocolError(code);
  }
  assertDigest(signature.sha256, code);
}

function assertFrozenAsset(asset: ReleaseAsset): void {
  assertSafeFileName(asset.fileName, 'RELEASE_ASSET_INVALID');
  if (
    !Number.isSafeInteger(asset.length) ||
    asset.length <= 0 ||
    !ASSET_PLATFORMS.includes(asset.platform) ||
    ![
      'application',
      'runtime',
      'catalog',
      'keyring',
      'checksums',
      'manifest',
      'sbom',
      'notices',
      'provenance',
      'compatibility',
    ].includes(asset.role) ||
    !['app', 'cpu', 'sm_120a-real', 'release'].includes(asset.target) ||
    !['appimage', 'deb', 'rpm', 'nsis', 'restricted-tar-gzip-v1', 'json', 'text'].includes(asset.format)
  ) {
    throw new ReleaseProtocolError('RELEASE_ASSET_INVALID');
  }
  const requiredFormat = expectedFormat(asset);
  const linuxApplication = asset.role === 'application' && asset.platform === 'linux' && asset.target === 'app';
  if (
    (!linuxApplication && requiredFormat === undefined) ||
    (linuxApplication ? !isLinuxApplicationFormat(asset.format) : asset.format !== requiredFormat)
  ) {
    throw new ReleaseProtocolError('RELEASE_ASSET_IDENTITY_INVALID');
  }
  assertDigest(asset.sha256, 'RELEASE_ASSET_DIGEST_INVALID');
  assertSignature(asset.signature, 'RELEASE_ASSET_SIGNATURE_INVALID');
  if (asset.fileName === asset.signature.fileName) throw new ReleaseProtocolError('RELEASE_ASSET_SIGNATURE_INVALID');
}

/** Validates immutable production release records without acquiring, signing, or publishing any artifact. */
export class ReleaseProtocolVerifier {
  public verifyPreparation(preparation: ReleasePreparation): void {
    const alpha = preparation.target === ALPHA_TARGET;
    const final = preparation.target === FINAL_TARGET;
    if (
      (!alpha && !final) ||
      preparation.branch !== (alpha ? ALPHA_BRANCH : FINAL_BRANCH) ||
      preparation.tag !== preparation.target ||
      preparation.cleanHead !== true ||
      preparation.versionCommitted !== true ||
      preparation.changelogCommitted !== true ||
      preparation.manualRegistryCommitted !== true ||
      preparation.mergePolicy !== 'preserving-merge-only'
    ) {
      throw new ReleaseProtocolError('RELEASE_PREPARATION_INVALID');
    }
  }

  public verifyCandidate(
    candidate: ReleaseCandidate,
    expected: Readonly<{ target?: string; targetKind?: ReleaseCandidateTargetKind }> = {},
  ): void {
    const targetKind = expected.targetKind ?? 'release';
    const validTarget = isReleaseCandidateTarget(candidate.target, targetKind);
    if (!validTarget || (expected.target !== undefined && candidate.target !== expected.target)) {
      throw new ReleaseProtocolError('RELEASE_TARGET_INVALID');
    }
    if (candidate.purpose !== 'production') throw new ReleaseProtocolError('RELEASE_CANDIDATE_PURPOSE_INVALID');
    assertDigest(candidate.candidateInputDigest, 'RELEASE_CANDIDATE_INPUT_INVALID');
    assertDigest(candidate.releaseCandidateDigest, 'RELEASE_CANDIDATE_DIGEST_INVALID');
    this.verifyExactAssets(candidate.assets, 'RELEASE_CANDIDATE_ASSETS_INVALID');
    const manifest = candidate.assets.find((asset) => asset.role === 'manifest');
    if (!manifest || JSON.stringify(candidate.manifestSignature) !== JSON.stringify(manifest.signature)) {
      throw new ReleaseProtocolError('RELEASE_MANIFEST_SIGNATURE_INVALID');
    }
  }

  public verifyStaging(candidate: ReleaseCandidate, staging: ReleaseStaging): void {
    this.verifyCandidate(candidate);
    if (
      staging.purpose !== 'production' ||
      staging.tag !== candidate.target ||
      staging.candidateInputDigest !== candidate.candidateInputDigest ||
      staging.releaseCandidateDigest !== candidate.releaseCandidateDigest
    ) {
      throw new ReleaseProtocolError('RELEASE_STAGING_BINDING_INVALID');
    }
    assertDigest(staging.releaseStagingDigest, 'RELEASE_STAGING_DIGEST_INVALID');
    this.verifyExactAssets(staging.stagedAssets, 'RELEASE_STAGING_ASSETS_INVALID');
    const candidateAssets = this.assetFingerprints(candidate.assets);
    if (JSON.stringify(this.assetFingerprints(staging.stagedAssets)) !== JSON.stringify(candidateAssets)) {
      throw new ReleaseProtocolError('RELEASE_STAGING_CONTENT_CHANGED');
    }
  }

  public verifyAlphaDeployment(staging: ReleaseStaging, deployment: AlphaDeployment): void {
    if (
      deployment.target !== ALPHA_TARGET ||
      deployment.prerelease !== true ||
      deployment.public !== true ||
      deployment.releaseStagingDigest !== staging.releaseStagingDigest
    ) {
      throw new ReleaseProtocolError('ALPHA_DEPLOYMENT_INVALID');
    }
    assertDigest(deployment.deploymentDigest, 'ALPHA_DEPLOYMENT_DIGEST_INVALID');
  }

  public verifySmokeEligibility(deployment: AlphaDeployment, smoke: AlphaSmoke): void {
    if (
      deployment.target !== ALPHA_TARGET ||
      deployment.public !== true ||
      deployment.prerelease !== true ||
      smoke.deploymentDigest !== deployment.deploymentDigest ||
      !RELEASE_PLATFORMS.includes(smoke.platform) ||
      (smoke.status !== 'Pass' && smoke.status !== 'Fail')
    ) {
      throw new ReleaseProtocolError('ALPHA_SMOKE_ORDER_INVALID');
    }
  }

  public verifyFinalTransition(
    deployment: AlphaDeployment,
    smokes: readonly AlphaSmoke[],
    feedback: 'final' | 'next-alpha',
  ): void {
    const byPlatform = new Map<ReleasePlatform, AlphaSmoke>();
    for (const smoke of smokes) {
      this.verifySmokeEligibility(deployment, smoke);
      if (byPlatform.has(smoke.platform)) throw new ReleaseProtocolError('ALPHA_SMOKE_DUPLICATED');
      byPlatform.set(smoke.platform, smoke);
    }
    if (byPlatform.size !== RELEASE_PLATFORMS.length) throw new ReleaseProtocolError('ALPHA_SMOKE_INCOMPLETE');
    const allPassed = [...byPlatform.values()].every((smoke) => smoke.status === 'Pass');
    if (feedback === 'final' && !allPassed) {
      throw new ReleaseProtocolError('ALPHA_FEEDBACK_TRANSITION_INVALID');
    }
  }

  private verifyExactAssets(assets: readonly ReleaseAsset[], code: string): void {
    if (assets.length !== EXPECTED_ASSET_IDENTITIES.length) throw new ReleaseProtocolError(code);
    for (const asset of assets) assertFrozenAsset(asset);
    const identities = assets.map(assetIdentity).sort();
    if (JSON.stringify(identities) !== JSON.stringify([...EXPECTED_ASSET_IDENTITIES].sort())) {
      throw new ReleaseProtocolError(code);
    }
    const physicalFileNames = assets.flatMap((asset) => [asset.fileName, asset.signature.fileName]);
    if (new Set(physicalFileNames).size !== physicalFileNames.length) {
      throw new ReleaseProtocolError('RELEASE_ASSET_DUPLICATED');
    }
  }

  private assetFingerprints(assets: readonly ReleaseAsset[]): readonly string[] {
    return assets
      .map(
        (asset) =>
          `${assetIdentity(asset)}|${asset.fileName}|${asset.length}|${asset.sha256}|${asset.signature.fileName}|${asset.signature.length}|${asset.signature.sha256}|${asset.signature.keyId}`,
      )
      .sort();
  }
}

export const LOCAL_WHISPER_RELEASE_TARGETS = Object.freeze({ alpha: ALPHA_TARGET, final: FINAL_TARGET });
