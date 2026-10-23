import { createHash, verify } from 'node:crypto';
import { link, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { LocalWhisperCatalogVerifier } from '@main/localWhisper/catalog/LocalWhisperCatalogVerifier';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  toLocalWhisperArtifactId,
  isLocalWhisperRuntimeIdentity,
  type LocalWhisperRuntimeIdentity,
} from '@shared/localWhisper';
import { getLocalWhisperRuntimeIdentityKey } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  productionReleaseCandidateDigest,
  productionReleaseStagingDigest,
  publishedAlphaDeploymentDigest,
  ReleaseProtocolVerifier,
  type ReleaseAsset,
} from '../release-policy/ReleaseProtocol';
import {
  PerformanceRuntimeArchiveInspector,
  type PerformanceRuntimeArchiveEvidence,
} from '../qualification/PerformanceRuntimeArchiveInspector';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';

import { isRecord } from '../packaging/contracts';

import {
  ALPHA_SMOKE_PRIMARY_ASSET_NAMES,
  ALPHA_SMOKE_CANDIDATE_INPUT_DIGEST,
  ALPHA_SMOKE_REPOSITORY,
  ALPHA_SMOKE_SOURCE_SHA,
  ALPHA_SMOKE_TARGET,
  ALPHA_SMOKE_MODEL_SELECTION,
  alphaSmokeDigest,
  assertAlphaSmokeDigest,
  createPlatformSmokeInput,
  type AlphaSmokeAssetIdentity,
  type AlphaSmokePlatform,
  type AlphaSmokePublicInput,
} from './AlphaSmokeProtocol';

const SIGNATURE_SUFFIX = '.sig';
const SHA256_PATTERN = /^[a-f\d]{64}$/u;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const PUBLIC_DOWNLOAD_TIMEOUT_MILLISECONDS = 5 * 60 * 1_000;

interface ReleaseApiAsset {
  readonly browser_download_url: string;
  readonly name: string;
  readonly size: number;
}

interface ReleaseApiDocument {
  readonly id: number;
  readonly assets: readonly ReleaseApiAsset[];
  readonly draft: boolean;
  readonly html_url: string;
  readonly prerelease: boolean;
  readonly tag_name: string;
  readonly target_commitish: string;
}

interface ManifestAsset extends ReleaseAsset {
  readonly signature: AlphaSmokeAssetIdentity & { readonly keyId: string };
}

interface DownloadedAsset extends AlphaSmokeAssetIdentity {
  readonly text: string | null;
  readonly runtime?: PerformanceRuntimeArchiveEvidence;
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_PUBLIC_RELEASE_${code}`);
}

function parseRelease(value: unknown): ReleaseApiDocument {
  if (
    !isRecord(value) ||
    value.draft !== false ||
    value.prerelease !== true ||
    value.tag_name !== ALPHA_SMOKE_TARGET ||
    value.target_commitish !== ALPHA_SMOKE_SOURCE_SHA ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) <= 0 ||
    typeof value.html_url !== 'string' ||
    !Array.isArray(value.assets)
  ) {
    fail('METADATA_INVALID');
  }
  const releaseUrl = new URL(value.html_url);
  if (
    releaseUrl.protocol !== 'https:' ||
    releaseUrl.hostname !== 'github.com' ||
    releaseUrl.pathname !== `/${ALPHA_SMOKE_REPOSITORY}/releases/tag/${ALPHA_SMOKE_TARGET}`
  ) {
    fail('ORIGIN_INVALID');
  }
  if (
    !value.assets.every(
      (asset) =>
        isRecord(asset) &&
        typeof asset.name === 'string' &&
        typeof asset.browser_download_url === 'string' &&
        typeof asset.size === 'number' &&
        Number.isSafeInteger(asset.size) &&
        asset.size > 0,
    )
  ) {
    fail('ASSET_METADATA_INVALID');
  }
  return value as unknown as ReleaseApiDocument;
}

function parseManifestAsset(value: unknown): ManifestAsset {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    typeof value.length !== 'number' ||
    !Number.isSafeInteger(value.length) ||
    value.length <= 0 ||
    typeof value.sha256 !== 'string' ||
    !SHA256_PATTERN.test(value.sha256) ||
    !isRecord(value.signature) ||
    typeof value.signature.fileName !== 'string' ||
    typeof value.signature.keyId !== 'string' ||
    typeof value.signature.length !== 'number' ||
    !Number.isSafeInteger(value.signature.length) ||
    value.signature.length <= 0 ||
    typeof value.signature.sha256 !== 'string' ||
    !SHA256_PATTERN.test(value.signature.sha256)
  ) {
    fail('MANIFEST_ASSET_INVALID');
  }
  return value as unknown as ManifestAsset;
}

function parseManifest(value: unknown, expectedCandidateInputDigest: string): readonly ManifestAsset[] {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.purpose !== 'production' ||
    value.candidateTarget !== ALPHA_SMOKE_TARGET ||
    typeof value.candidateInputDigest !== 'string'
  ) {
    fail('MANIFEST_INVALID');
  }
  assertAlphaSmokeDigest(value.candidateInputDigest, 'ALPHA_SMOKE_PUBLIC_RELEASE_MANIFEST_DIGEST_INVALID');
  if (value.candidateInputDigest !== expectedCandidateInputDigest) fail('MANIFEST_DIGEST_INVALID');
  if (!Array.isArray(value.assets)) fail('MANIFEST_ASSETS_INVALID');
  const assets = value.assets.map(parseManifestAsset);
  const expected = ALPHA_SMOKE_PRIMARY_ASSET_NAMES.filter((name) => name !== 'release-manifest.json').sort();
  const actual = assets.map(({ fileName }) => fileName).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail('MANIFEST_INVENTORY_INVALID');
  }
  return Object.freeze(assets);
}

function expectedReleaseAssetUrl(fileName: string): string {
  return `https://github.com/${ALPHA_SMOKE_REPOSITORY}/releases/download/${ALPHA_SMOKE_TARGET}/${encodeURIComponent(fileName)}`;
}

function releaseAssetMap(release: ReleaseApiDocument): ReadonlyMap<string, ReleaseApiAsset> {
  const expected = new Set(ALPHA_SMOKE_PRIMARY_ASSET_NAMES.flatMap((name) => [name, `${name}${SIGNATURE_SUFFIX}`]));
  if (release.assets.length !== expected.size) fail('ASSET_INVENTORY_INVALID');
  const entries = release.assets.map((asset) => [asset.name, asset] as const);
  const names = new Set(entries.map(([name]) => name));
  if (names.size !== expected.size || [...expected].some((name) => !names.has(name))) fail('ASSET_INVENTORY_INVALID');
  for (const [name, asset] of entries) {
    if (asset.browser_download_url !== expectedReleaseAssetUrl(name)) fail('ASSET_ORIGIN_INVALID');
  }
  return new Map(entries);
}

function parseDetachedSignature(
  value: unknown,
): Readonly<{ keyId: string; signatureBase64: string; signedSha256: string }> {
  if (
    !isRecord(value) ||
    value.algorithm !== 'Ed25519' ||
    typeof value.keyId !== 'string' ||
    typeof value.signatureBase64 !== 'string' ||
    typeof value.signedSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.signedSha256) ||
    Buffer.from(value.signatureBase64, 'base64').toString('base64') !== value.signatureBase64
  ) {
    fail('SIGNATURE_INVALID');
  }
  return value as unknown as Readonly<{ keyId: string; signatureBase64: string; signedSha256: string }>;
}

function parseKeyring(value: unknown): ReadonlyMap<string, string> {
  if (!isRecord(value) || value.purpose !== 'production' || !Array.isArray(value.publicKeys)) fail('KEYRING_INVALID');
  const keys = new Map<string, string>();
  for (const entry of value.publicKeys) {
    if (
      !isRecord(entry) ||
      typeof entry.keyId !== 'string' ||
      typeof entry.publicKeyPem !== 'string' ||
      keys.has(entry.keyId)
    ) {
      fail('KEYRING_INVALID');
    }
    keys.set(entry.keyId, entry.publicKeyPem);
  }
  if (keys.size === 0) fail('KEYRING_INVALID');
  return keys;
}

function assertPinnedModelCatalog(value: unknown): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.purpose !== 'production' ||
    value.target !== ALPHA_SMOKE_TARGET
  ) {
    fail('CATALOG_INVALID');
  }
  if (!Array.isArray(value.catalogs) || value.catalogs.length !== 2) fail('CATALOG_INVALID');
  const catalogs: unknown[] = value.catalogs;
  const linux = catalogs.find((entry) => isRecord(entry) && entry.platform === 'linux');
  if (!isRecord(linux) || typeof linux.documentBase64 !== 'string' || typeof linux.sha256 !== 'string')
    fail('CATALOG_INVALID');
  const document = Buffer.from(linux.documentBase64, 'base64');
  if (
    document.toString('base64') !== linux.documentBase64 ||
    createHash('sha256').update(document).digest('hex') !== linux.sha256
  ) {
    fail('CATALOG_INVALID');
  }
  const envelope = JSON.parse(document.toString('utf8')) as unknown;
  const payloadBytes =
    isRecord(envelope) && typeof envelope.payloadBase64 === 'string'
      ? Buffer.from(envelope.payloadBase64, 'base64')
      : document;
  const payload = JSON.parse(payloadBytes.toString('utf8')) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.models)) fail('CATALOG_INVALID');
  const models: unknown[] = payload.models;
  const base = models.find(
    (model) =>
      isRecord(model) &&
      isRecord(model.identity) &&
      model.identity.logicalModel === ALPHA_SMOKE_MODEL_SELECTION.family &&
      model.identity.variant === ALPHA_SMOKE_MODEL_SELECTION.variant &&
      model.transferSizeBytes === 147_951_465 &&
      model.transferSha256 === '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  );
  if (!base) fail('MODEL_PIN_INVALID');
}

/** Reads only the immutable public GitHub release inventory and validates every streamed asset/signature pair. */
export class PublicAlphaReleaseRepository {
  private readonly fetchImplementation: typeof fetch;
  private lastVerifiedLinuxDeb: Readonly<{ asset: ReleaseApiAsset; expected: ManifestAsset }> | null = null;

  public constructor({
    fetchImplementation = fetch,
    remainingMilliseconds = () => PUBLIC_DOWNLOAD_TIMEOUT_MILLISECONDS,
    expectedCandidateInputDigest = ALPHA_SMOKE_CANDIDATE_INPUT_DIGEST,
  }: Readonly<{
    fetchImplementation?: typeof fetch;
    remainingMilliseconds?: () => number;
    expectedCandidateInputDigest?: string;
  }> = {}) {
    this.fetchImplementation = fetchImplementation;
    this.remainingMilliseconds = remainingMilliseconds;
    assertAlphaSmokeDigest(expectedCandidateInputDigest, 'ALPHA_SMOKE_PUBLIC_RELEASE_INPUT_INVALID');
    this.expectedCandidateInputDigest = expectedCandidateInputDigest;
  }
  private readonly expectedCandidateInputDigest: string;
  private readonly remainingMilliseconds: () => number;
  private readonly catalogRuntimeBindings = new Map<
    string,
    Readonly<{ workerSha256: string; runtimeBuildDigest: string; runtimeIdentityKey: string }>
  >();

  public runtimeBindings(): Readonly<
    Record<string, Readonly<{ workerSha256: string; runtimeBuildDigest: string; runtimeIdentityKey: string }>>
  > {
    return Object.freeze(Object.fromEntries(this.catalogRuntimeBindings));
  }

  private document(assets: ReadonlyMap<string, DownloadedAsset>, name: string): Record<string, unknown> {
    const text = assets.get(name)?.text;
    if (!text) fail('DOCUMENT_MISSING');
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      fail('DOCUMENT_INVALID');
    }
    if (!isRecord(value)) fail('DOCUMENT_INVALID');
    return value;
  }

  private verifyReleaseDocuments(assets: ReadonlyMap<string, DownloadedAsset>): void {
    const provenance = this.document(assets, 'release-provenance.json');
    if (
      provenance.schemaVersion !== 1 ||
      provenance.purpose !== 'production' ||
      provenance.candidateTarget !== ALPHA_SMOKE_TARGET ||
      provenance.sourceCommit !== ALPHA_SMOKE_SOURCE_SHA ||
      typeof provenance.appRevision !== 'string' ||
      !Array.isArray(provenance.platformBundles) ||
      provenance.platformBundles.length !== 2
    )
      fail('PROVENANCE_INVALID');
    const rawBundles: unknown[] = provenance.platformBundles;
    const bundles = rawBundles.map((bundle) => {
      if (!isRecord(bundle)) fail('PROVENANCE_INVALID');
      return bundle;
    });
    if (
      !bundles.every(
        (bundle) =>
          isRecord(bundle) &&
          ['linux', 'win32'].includes(String(bundle.platform)) &&
          SHA256_PATTERN.test(String(bundle.bundleManifestSha256)) &&
          SHA256_PATTERN.test(String(bundle.catalogSha256)),
      ) ||
      new Set(bundles.map((bundle) => String(bundle.platform))).size !== 2
    )
      fail('PROVENANCE_INVALID');
    const reconstructed = alphaSmokeDigest({
      schemaVersion: 1,
      purpose: 'production',
      target: ALPHA_SMOKE_TARGET,
      sourceCommit: ALPHA_SMOKE_SOURCE_SHA,
      appRevision: provenance.appRevision,
      platformBundles: bundles.map((bundle) => ({
        platform: bundle.platform,
        bundleManifestSha256: bundle.bundleManifestSha256,
        catalogSha256: bundle.catalogSha256,
      })),
    });
    if (reconstructed !== this.expectedCandidateInputDigest) fail('PROVENANCE_DIGEST_INVALID');
    const compatibility = this.document(assets, 'local-whisper-compatibility.json');
    if (
      compatibility.schemaVersion !== 1 ||
      compatibility.appRevision !== provenance.appRevision ||
      alphaSmokeDigest(compatibility.platforms) !== alphaSmokeDigest(['linux-x64', 'win32-x64']) ||
      alphaSmokeDigest(compatibility.runtimeTargets) !== alphaSmokeDigest(['cpu', 'sm_120a-real']) ||
      alphaSmokeDigest(compatibility.transferProfiles) !==
        alphaSmokeDigest(['restricted-tar-gzip-v1', 'pinned-raw-model-v1']) ||
      alphaSmokeDigest(compatibility.models) !== alphaSmokeDigest(LOCAL_WHISPER_RELEASE_MODEL_MATRIX)
    )
      fail('COMPATIBILITY_INVALID');
    const sbom = this.document(assets, 'release-sbom.spdx.json');
    if (
      sbom.spdxVersion !== 'SPDX-2.3' ||
      sbom.dataLicense !== 'CC0-1.0' ||
      sbom.SPDXID !== 'SPDXRef-DOCUMENT' ||
      sbom.documentNamespace !== `https://gpt-voice.local/spdx/${ALPHA_SMOKE_TARGET}` ||
      !Array.isArray(sbom.platformDocuments) ||
      sbom.platformDocuments.length !== 2 ||
      !sbom.platformDocuments.every(
        (document) =>
          isRecord(document) &&
          document.spdxVersion === 'SPDX-2.3' &&
          Array.isArray(document.packages) &&
          document.packages.length > 0,
      )
    )
      fail('SBOM_INVALID');
    const notices = assets.get('THIRD_PARTY_NOTICES.txt')?.text;
    if (
      !notices ||
      !notices.includes('whisper.cpp: MIT') ||
      !notices.includes('NVIDIA CUDA 12.8.1 redistributable runtime: NVIDIA CUDA EULA')
    )
      fail('NOTICES_INVALID');
    const expected = [...assets.values()]
      .filter(
        (asset) =>
          !['SHA256SUMS.txt', 'SHA256SUMS.txt.sig', 'release-manifest.json', 'release-manifest.json.sig'].includes(
            asset.fileName,
          ),
      )
      .map((asset) => `${asset.sha256}  ${asset.fileName}`)
      .sort();
    const actual = assets.get('SHA256SUMS.txt')?.text?.trimEnd().split('\n').sort();
    if (!actual || actual.length !== expected.length || actual.some((line, index) => line !== expected[index]))
      fail('CHECKSUMS_INVALID');
  }

  private verifyCatalogBindings(
    assets: ReadonlyMap<string, DownloadedAsset>,
    keys: ReadonlyMap<string, string>,
  ): ReadonlySet<string> {
    const authenticatedSigners = new Set<string>();
    const catalog = this.document(assets, 'local-whisper-catalogs.json');
    assertPinnedModelCatalog(catalog);
    const provenance = this.document(assets, 'release-provenance.json');
    const verifier = new LocalWhisperCatalogVerifier(
      [...keys].map(([keyId, publicKeyPem]) => {
        const identity = toLocalWhisperArtifactId(keyId);
        if (!identity) fail('KEYRING_INVALID');
        return { keyId: identity, publicKeyPem };
      }),
    );
    if (!Array.isArray(catalog.catalogs)) fail('CATALOG_INVALID');
    const catalogs: unknown[] = catalog.catalogs;
    for (const platform of ['linux', 'win32'] as const) {
      const entries = catalogs.filter(
        (entry): entry is Record<string, unknown> => isRecord(entry) && entry.platform === platform,
      );
      if (
        entries.length !== 1 ||
        typeof entries[0].documentBase64 !== 'string' ||
        typeof entries[0].sha256 !== 'string'
      )
        fail('CATALOG_INVALID');
      const bytes = Buffer.from(entries[0].documentBase64, 'base64');
      const bundle = (provenance.platformBundles as Record<string, unknown>[]).find(
        (item) => item.platform === platform,
      );
      if (
        bytes.toString('base64') !== entries[0].documentBase64 ||
        createHash('sha256').update(bytes).digest('hex') !== entries[0].sha256 ||
        bundle?.catalogSha256 !== entries[0].sha256
      )
        fail('CATALOG_BINDING_INVALID');
      const verified = verifier.verify(bytes);
      if (
        !verified.success ||
        !isRecord(verified.payload) ||
        verified.payload.purpose !== 'production' ||
        !Array.isArray(verified.payload.runtimes) ||
        verified.payload.runtimes.length !== 2 ||
        !Array.isArray(verified.payload.compatibleAppRevisions) ||
        !verified.payload.compatibleAppRevisions.includes(provenance.appRevision)
      )
        fail('CATALOG_SIGNATURE_INVALID');
      authenticatedSigners.add(verified.keyId);
      for (const target of ['cpu', 'sm_120a-real'] as const) {
        const backend = target === 'cpu' ? 'cpu' : 'cuda';
        const runtimeEntries: unknown[] = verified.payload.runtimes;
        const runtimes = runtimeEntries.filter(
          (entry): entry is Record<string, unknown> & { identity: LocalWhisperRuntimeIdentity } =>
            isRecord(entry) && isLocalWhisperRuntimeIdentity(entry.identity) && entry.identity.backend === backend,
        );
        if (runtimes.length !== 1 || !isLocalWhisperRuntimeIdentity(runtimes[0].identity))
          fail('RUNTIME_CATALOG_INVALID');
        const identity = runtimes[0].identity;
        const name = `${platform}-gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`;
        this.assertRuntimeSource(runtimes[0], name);
        const archive = assets.get(name);
        if (
          !archive?.runtime ||
          identity.platform !== platform ||
          identity.architecture !== 'x64' ||
          identity.archiveSha256 !== archive.sha256 ||
          identity.archiveSizeBytes !== archive.length ||
          (backend === 'cuda' &&
            (identity.computeTargets.length !== 1 || identity.computeTargets[0] !== 'sm_120a-real')) ||
          alphaSmokeDigest([...identity.expectedFiles].sort((a, b) => a.fileId.localeCompare(b.fileId))) !==
            alphaSmokeDigest([...archive.runtime.expectedFiles].sort((a, b) => a.fileId.localeCompare(b.fileId)))
        )
          fail('RUNTIME_ARCHIVE_BINDING_INVALID');
        this.catalogRuntimeBindings.set(
          `${platform}:${target}`,
          Object.freeze({
            workerSha256: archive.runtime.workerSha256,
            runtimeBuildDigest: archive.runtime.runtimeBuildDigest,
            runtimeIdentityKey: getLocalWhisperRuntimeIdentityKey(identity),
          }),
        );
      }
    }
    return authenticatedSigners;
  }

  private assertRuntimeSource(runtime: Record<string, unknown>, fileName: string): void {
    const expectedUrl = `https://github.com/${ALPHA_SMOKE_REPOSITORY}/releases/download/${ALPHA_SMOKE_TARGET}/${fileName}`;
    if (
      !isRecord(runtime.source) ||
      runtime.source.repository !== ALPHA_SMOKE_REPOSITORY ||
      runtime.source.commit !== ALPHA_SMOKE_SOURCE_SHA ||
      runtime.source.file !== fileName ||
      runtime.source.url !== expectedUrl
    )
      fail('RUNTIME_SOURCE_BINDING_INVALID');
  }

  private verifyRuntimeArchives(assets: ReadonlyMap<string, DownloadedAsset>): void {
    for (const platform of ['linux', 'win32']) {
      for (const target of ['cpu', 'sm_120a-real']) {
        if (!assets.get(`${platform}-gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`)?.runtime)
          fail('RUNTIME_ARCHIVE_INVALID');
      }
    }
  }

  private timeout(): number {
    const remaining = this.remainingMilliseconds();
    if (!Number.isFinite(remaining) || remaining <= 0) fail('DEADLINE_EXHAUSTED');
    return Math.min(PUBLIC_DOWNLOAD_TIMEOUT_MILLISECONDS, remaining);
  }

  public async verify(platform: AlphaSmokePlatform): Promise<AlphaSmokePublicInput> {
    this.lastVerifiedLinuxDeb = null;
    this.catalogRuntimeBindings.clear();
    const releaseResponse = await this.fetchImplementation(
      `https://api.github.com/repos/${ALPHA_SMOKE_REPOSITORY}/releases/tags/${ALPHA_SMOKE_TARGET}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeout()),
      },
    );
    if (!releaseResponse.ok) fail('UNAVAILABLE');
    const release = parseRelease(await releaseResponse.json());
    const assets = releaseAssetMap(release);
    const manifest = await this.download(assets.get('release-manifest.json')!);
    if (!manifest.text) fail('MANIFEST_UNAVAILABLE');
    const manifestAssets = parseManifest(JSON.parse(manifest.text) as unknown, this.expectedCandidateInputDigest);
    const allAssets = [
      ...manifestAssets,
      Object.freeze({
        fileName: manifest.fileName,
        length: manifest.length,
        sha256: manifest.sha256,
        signature: Object.freeze({
          fileName: 'release-manifest.json.sig',
          keyId: '',
          length: assets.get('release-manifest.json.sig')!.size,
          sha256: '',
        }),
      }),
    ];
    const linuxDeb = manifestAssets.find(({ fileName }) => fileName === 'gpt-voice_2.4.0-alpha.1_amd64.deb');
    if (!linuxDeb) fail('MANIFEST_INVENTORY_INVALID');
    const downloaded = new Map<string, DownloadedAsset>();
    for (const name of ALPHA_SMOKE_PRIMARY_ASSET_NAMES) downloaded.set(name, await this.download(assets.get(name)!));
    for (const asset of allAssets)
      downloaded.set(asset.signature.fileName, await this.download(assets.get(asset.signature.fileName)!));
    const keyring = downloaded.get('local-whisper-keyring.json');
    if (!keyring?.text) fail('KEYRING_UNAVAILABLE');
    const keys = parseKeyring(JSON.parse(keyring.text) as unknown);
    const catalog = downloaded.get('local-whisper-catalogs.json');
    if (!catalog?.text) fail('CATALOG_UNAVAILABLE');
    for (const asset of allAssets) {
      const primary = downloaded.get(asset.fileName);
      const signature = downloaded.get(asset.signature.fileName);
      if (!primary || !signature?.text) fail('ASSET_UNAVAILABLE');
      if (
        asset.fileName !== 'release-manifest.json' &&
        (primary.length !== asset.length || primary.sha256 !== asset.sha256)
      ) {
        fail('ASSET_DIGEST_INVALID');
      }
      if (asset.fileName === 'release-manifest.json' && primary.length !== assets.get(asset.fileName)!.size) {
        fail('MANIFEST_DIGEST_INVALID');
      }
      const detached = parseDetachedSignature(JSON.parse(signature.text) as unknown);
      const publicKey = keys.get(detached.keyId);
      if (
        asset.fileName !== 'release-manifest.json' &&
        (signature.length !== asset.signature.length || signature.sha256 !== asset.signature.sha256)
      ) {
        fail('SIGNATURE_DIGEST_INVALID');
      }
      if (
        !publicKey ||
        detached.signedSha256 !== primary.sha256 ||
        !verify(null, Buffer.from(primary.sha256, 'hex'), publicKey, Buffer.from(detached.signatureBase64, 'base64'))
      ) {
        fail('SIGNATURE_INVALID');
      }
    }
    this.verifyReleaseDocuments(downloaded);
    // The fixed candidate digest authenticates provenance catalog hashes, including envelope signatures.
    // Only keys proven by those pinned signatures may authorize the rest of this closed alpha release.
    const authenticatedSigners = this.verifyCatalogBindings(downloaded, keys);
    if ([...keys.keys()].some((keyId) => !authenticatedSigners.has(keyId))) fail('KEYRING_TRUST_INVALID');
    this.verifyRuntimeArchives(downloaded);
    const manifestSignature = parseDetachedSignature(
      JSON.parse(downloaded.get('release-manifest.json.sig')!.text!) as unknown,
    );
    const completeAssets: readonly ReleaseAsset[] = [
      ...manifestAssets,
      {
        fileName: manifest.fileName,
        format: 'json',
        role: 'manifest',
        target: 'release',
        platform: 'global',
        length: manifest.length,
        sha256: manifest.sha256,
        signature: {
          fileName: 'release-manifest.json.sig',
          keyId: manifestSignature.keyId,
          length: downloaded.get('release-manifest.json.sig')!.length,
          sha256: downloaded.get('release-manifest.json.sig')!.sha256,
        },
      },
    ];
    const candidateWithoutDigest = {
      assets: completeAssets,
      candidateInputDigest: this.expectedCandidateInputDigest,
      manifestSignature: completeAssets[completeAssets.length - 1].signature,
      purpose: 'production' as const,
      target: ALPHA_SMOKE_TARGET,
    };
    const candidate = {
      ...candidateWithoutDigest,
      releaseCandidateDigest: productionReleaseCandidateDigest(candidateWithoutDigest),
    };
    new ReleaseProtocolVerifier().verifyCandidate(candidate, { target: ALPHA_SMOKE_TARGET, targetKind: 'release' });
    const physicalAssets = [...downloaded.values()]
      .map(({ fileName, length, sha256 }) => ({ length, name: fileName, sha256 }))
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    const releaseStagingDigest = productionReleaseStagingDigest({
      assets: physicalAssets,
      candidateInputDigest: candidate.candidateInputDigest,
      releaseCandidateDigest: candidate.releaseCandidateDigest,
      sourceSha: ALPHA_SMOKE_SOURCE_SHA,
      tag: ALPHA_SMOKE_TARGET,
    });
    const deploymentDigest = publishedAlphaDeploymentDigest({
      releaseId: release.id,
      releaseStagingDigest,
      releaseUrl: release.html_url,
      sourceSha: ALPHA_SMOKE_SOURCE_SHA,
      tag: ALPHA_SMOKE_TARGET,
    });
    this.lastVerifiedLinuxDeb = Object.freeze({ asset: assets.get(linuxDeb.fileName)!, expected: linuxDeb });
    return createPlatformSmokeInput(
      platform,
      [...downloaded.values()]
        .filter((asset) => !asset.fileName.endsWith(SIGNATURE_SUFFIX))
        .map(({ fileName, length, sha256 }) => ({ fileName, length, sha256 })),
      deploymentDigest,
      this.expectedCandidateInputDigest,
    );
  }

  /** Materializes only a preceding verification's exact Debian byte stream inside the caller-owned root. */
  public async materializeVerifiedLinuxDeb(workRoot: string): Promise<string> {
    const verified = this.lastVerifiedLinuxDeb;
    if (!verified) fail('MATERIALIZATION_REQUIRES_VERIFICATION');
    const normalizedRoot = path.resolve(workRoot);
    const releaseDirectory = path.join(normalizedRoot, 'release');
    const destination = path.join(releaseDirectory, verified.expected.fileName);
    const relative = path.relative(normalizedRoot, destination);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) fail('MATERIALIZATION_PATH_INVALID');
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(normalizedRoot);
    try {
      await filesystem.openChildDirectory('release', true);
      const anchoredDestination = await filesystem.resolve(`release/${verified.expected.fileName}`);
      const staging = `${anchoredDestination}.partial`;
      const handle = await open(staging, 'wx', 0o600);
      try {
        const response = await this.fetchImplementation(verified.asset.browser_download_url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(this.timeout()),
        });
        if (!response.ok || response.body === null) fail('ASSET_UNAVAILABLE');
        const hash = createHash('sha256');
        let length = 0;
        const reader = response.body.getReader();
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            length += chunk.value.byteLength;
            if (length > verified.expected.length) fail('ASSET_LENGTH_INVALID');
            hash.update(chunk.value);
            await handle.writeFile(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        if (length !== verified.expected.length || hash.digest('hex') !== verified.expected.sha256) {
          fail('ASSET_DIGEST_INVALID');
        }
        await handle.sync();
        await handle.close();
        await filesystem.revalidate();
        await link(staging, anchoredDestination);
        await filesystem.revalidate();
        await rm(staging, { force: true });
        return destination;
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(staging, { force: true });
        throw error;
      }
    } finally {
      await filesystem.dispose();
    }
  }

  private async download(asset: ReleaseApiAsset): Promise<DownloadedAsset> {
    const response = await this.fetchImplementation(asset.browser_download_url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(this.timeout()),
    });
    if (!response.ok || response.body === null) fail('ASSET_UNAVAILABLE');
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let length = 0;
    const reader = response.body.getReader();
    if (asset.name.endsWith('.tar.gz')) {
      const platform = asset.name.startsWith('linux-') ? 'linux' : 'win32';
      const cuda = asset.name.includes('sm_120a-real');
      const profileId =
        platform === 'linux'
          ? cuda
            ? 'linux-x64-cuda-12.8.1-sm120a-v1'
            : 'linux-x64-cpu-baseline-v1'
          : cuda
            ? 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1'
            : 'windows-x64-cpu-msvc-19.51-v1';
      const stream = Readable.from(
        (async function* () {
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              length += chunk.value.byteLength;
              if (length > asset.size) fail('ASSET_LENGTH_INVALID');
              hash.update(chunk.value);
              yield Buffer.from(chunk.value);
            }
          } finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
          }
        })(),
      );
      let runtime;
      try {
        runtime = await new PerformanceRuntimeArchiveInspector().inspectSource(stream, { platform, profileId });
      } catch {
        fail('RUNTIME_ARCHIVE_INVALID');
      }
      if (length !== asset.size) fail('ASSET_LENGTH_INVALID');
      return Object.freeze({ fileName: asset.name, length, sha256: hash.digest('hex'), text: null, runtime });
    }
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > asset.size) fail('ASSET_LENGTH_INVALID');
        hash.update(chunk.value);
        if (length <= MAX_JSON_BYTES) chunks.push(Buffer.from(chunk.value));
      }
    } finally {
      reader.releaseLock();
    }
    if (length !== asset.size) fail('ASSET_LENGTH_INVALID');
    return Object.freeze({
      fileName: asset.name,
      length,
      sha256: hash.digest('hex'),
      text: length <= MAX_JSON_BYTES ? Buffer.concat(chunks).toString('utf8') : null,
    });
  }
}
