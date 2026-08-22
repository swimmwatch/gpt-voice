import { ReleaseProtocolError } from './ReleaseProtocolError';

export { ReleaseProtocolError } from './ReleaseProtocolError';

const SHA_256 = /^[a-f\d]{64}$/u;
const ALPHA_TARGET = 'v2.4.0-alpha.1';
const FINAL_TARGET = 'v2.4.0';
const ALPHA_BRANCH = 'release/v2.4.0-alpha.1';
const FINAL_BRANCH = 'release/v2.4.0';
const RUNTIME_TARGETS = Object.freeze(['cpu', 'sm_120a-real'] as const);
const PLATFORMS = Object.freeze(['linux', 'win32'] as const);
const EXPECTED_ASSET_IDENTITIES = Object.freeze([
  'linux|application|app',
  'win32|application|app',
  'linux|runtime|cpu',
  'win32|runtime|cpu',
  'linux|runtime|sm_120a-real',
  'win32|runtime|sm_120a-real',
]);

export type ReleasePlatform = (typeof PLATFORMS)[number];
export type ReleaseTarget = (typeof RUNTIME_TARGETS)[number];
export type ReleasePhase = 'candidate' | 'staged' | 'public';

export interface ReleaseAsset {
  readonly fileName: string;
  readonly length: number;
  readonly platform: ReleasePlatform;
  readonly role: 'application' | 'runtime';
  readonly sha256: string;
  readonly signature: string;
  readonly target: 'app' | ReleaseTarget;
}

export interface ReleaseCandidate {
  readonly candidateInputDigest: string;
  readonly manifestSignature: string;
  readonly releaseCandidateDigest: string;
  readonly target: string;
  readonly assets: readonly ReleaseAsset[];
}

export interface ReleaseStaging {
  readonly candidateInputDigest: string;
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

function assetIdentity(asset: ReleaseAsset): string {
  return `${asset.platform}|${asset.role}|${asset.target}`;
}

function assertFrozenAsset(asset: ReleaseAsset): void {
  if (
    typeof asset.fileName !== 'string' ||
    asset.fileName.length === 0 ||
    !Number.isSafeInteger(asset.length) ||
    asset.length <= 0 ||
    !PLATFORMS.includes(asset.platform) ||
    (asset.role !== 'application' && asset.role !== 'runtime') ||
    (asset.role === 'application'
      ? asset.target !== 'app'
      : !RUNTIME_TARGETS.includes(asset.target as ReleaseTarget)) ||
    typeof asset.signature !== 'string' ||
    asset.signature.length === 0
  ) {
    throw new ReleaseProtocolError('RELEASE_ASSET_INVALID');
  }
  assertDigest(asset.sha256, 'RELEASE_ASSET_DIGEST_INVALID');
}

/** Validates immutable release records without acquiring, signing, or publishing any artifact. */
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

  public verifyCandidate(candidate: ReleaseCandidate): void {
    if (candidate.target !== ALPHA_TARGET && candidate.target !== FINAL_TARGET) {
      throw new ReleaseProtocolError('RELEASE_TARGET_INVALID');
    }
    assertDigest(candidate.candidateInputDigest, 'RELEASE_CANDIDATE_INPUT_INVALID');
    assertDigest(candidate.releaseCandidateDigest, 'RELEASE_CANDIDATE_DIGEST_INVALID');
    if (typeof candidate.manifestSignature !== 'string' || candidate.manifestSignature.length === 0) {
      throw new ReleaseProtocolError('RELEASE_MANIFEST_SIGNATURE_INVALID');
    }
    this.verifyExactAssets(candidate.assets, 'RELEASE_CANDIDATE_ASSETS_INVALID');
  }

  public verifyStaging(candidate: ReleaseCandidate, staging: ReleaseStaging): void {
    this.verifyCandidate(candidate);
    if (
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
      !PLATFORMS.includes(smoke.platform) ||
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
    if (byPlatform.size !== PLATFORMS.length) throw new ReleaseProtocolError('ALPHA_SMOKE_INCOMPLETE');
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
  }

  private assetFingerprints(assets: readonly ReleaseAsset[]): readonly string[] {
    return assets
      .map((asset) => `${assetIdentity(asset)}|${asset.fileName}|${asset.length}|${asset.sha256}|${asset.signature}`)
      .sort();
  }
}

export const LOCAL_WHISPER_RELEASE_TARGETS = Object.freeze({ alpha: ALPHA_TARGET, final: FINAL_TARGET });
