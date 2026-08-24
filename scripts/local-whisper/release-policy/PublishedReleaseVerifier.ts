import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '../packaging/contracts';
import { ReleaseProtocolVerifier, type ReleaseAsset, type ReleaseCandidate } from './ReleaseProtocol';

const SHA_PATTERN = /^[a-f\d]{40}$/u;
const SAFE_TAG = /^v\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?$/u;

interface ReleaseApiAsset {
  readonly browser_download_url: string;
  readonly id: number;
  readonly name: string;
  readonly size: number;
}

interface ReleaseApiDocument {
  readonly assets: readonly ReleaseApiAsset[];
  readonly draft: boolean;
  readonly html_url: string;
  readonly id: number;
  readonly prerelease: boolean;
  readonly tag_name: string;
  readonly target_commitish: string;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function physicalAssets(
  candidate: ReleaseCandidate,
): readonly Readonly<{ length: number; name: string; sha256: string }>[] {
  return candidate.assets
    .flatMap((asset: ReleaseAsset) => [
      { length: asset.length, name: asset.fileName, sha256: asset.sha256 },
      { length: asset.signature.length, name: asset.signature.fileName, sha256: asset.signature.sha256 },
    ])
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

function validateRelease(
  value: unknown,
  expected: Readonly<{ repository: string; sourceSha: string; tag: string }>,
): ReleaseApiDocument {
  if (
    !isRecord(value) ||
    !Array.isArray(value.assets) ||
    value.draft !== false ||
    value.prerelease !== true ||
    value.tag_name !== expected.tag ||
    value.target_commitish !== expected.sourceSha ||
    !Number.isSafeInteger(value.id) ||
    typeof value.html_url !== 'string'
  ) {
    throw new Error('PUBLISHED_RELEASE_INVALID');
  }
  let releaseUrl: URL;
  try {
    releaseUrl = new URL(value.html_url);
  } catch {
    throw new Error('PUBLISHED_RELEASE_ORIGIN_INVALID');
  }
  if (
    releaseUrl.protocol !== 'https:' ||
    releaseUrl.hostname !== 'github.com' ||
    releaseUrl.pathname !== `/${expected.repository}/releases/tag/${expected.tag}`
  ) {
    throw new Error('PUBLISHED_RELEASE_ORIGIN_INVALID');
  }
  return value as unknown as ReleaseApiDocument;
}

/** Downloads and hashes every public release asset before the publication workflow can become green. */
export class PublishedReleaseVerifier {
  #fetch: typeof fetch;

  constructor({ fetchImplementation = fetch }: Readonly<{ fetchImplementation?: typeof fetch }> = {}) {
    this.#fetch = fetchImplementation;
  }

  public async verify(
    candidatePath: string,
    expected: Readonly<{ outputPath: string; repository: string; sourceSha: string; tag: string; token: string }>,
  ): Promise<Readonly<{ deploymentDigest: string; releaseStagingDigest: string }>> {
    if (
      !SAFE_TAG.test(expected.tag) ||
      !SHA_PATTERN.test(expected.sourceSha) ||
      !/^[\w.-]+\/[\w.-]+$/u.test(expected.repository) ||
      !/^\S+$/u.test(expected.token)
    ) {
      throw new Error('PUBLISHED_RELEASE_INPUT_INVALID');
    }
    const candidate: ReleaseCandidate = JSON.parse(await readFile(candidatePath, 'utf8')) as ReleaseCandidate;
    new ReleaseProtocolVerifier().verifyCandidate(candidate, { target: expected.tag, targetKind: 'release' });
    const releaseResponse = await this.#request(
      `https://api.github.com/repos/${expected.repository}/releases/tags/${encodeURIComponent(expected.tag)}`,
      expected.token,
      'application/vnd.github+json',
    );
    const release = validateRelease(await releaseResponse.json(), expected);
    const expectedAssets = physicalAssets(candidate);
    const actualAssets = release.assets
      .map((asset) => ({ length: asset.size, name: asset.name, url: asset.browser_download_url }))
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    if (
      actualAssets.length !== expectedAssets.length ||
      actualAssets.some(
        (asset, index) => asset.name !== expectedAssets[index]?.name || asset.length !== expectedAssets[index]?.length,
      )
    ) {
      throw new Error('PUBLISHED_RELEASE_ASSET_INVENTORY_INVALID');
    }
    for (const [index, asset] of actualAssets.entries()) {
      const expectedAsset = expectedAssets[index];
      const url = new URL(asset.url);
      const expectedPrefix = `/${expected.repository}/releases/download/${expected.tag}/`;
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        !url.pathname.startsWith(expectedPrefix) ||
        decodeURIComponent(url.pathname.slice(expectedPrefix.length)) !== expectedAsset.name
      ) {
        throw new Error('PUBLISHED_RELEASE_ORIGIN_INVALID');
      }
      const response = await this.#request(asset.url, expected.token, 'application/octet-stream');
      await this.#verifyAsset(response, expectedAsset);
    }
    const releaseStagingDigest = digest({
      assets: expectedAssets,
      candidateInputDigest: candidate.candidateInputDigest,
      releaseCandidateDigest: candidate.releaseCandidateDigest,
      sourceSha: expected.sourceSha,
      tag: expected.tag,
    });
    const deploymentDigest = digest({
      releaseId: release.id,
      releaseStagingDigest,
      releaseUrl: release.html_url,
      sourceSha: expected.sourceSha,
      tag: expected.tag,
    });
    await mkdir(path.dirname(expected.outputPath), { recursive: true });
    await writeFile(
      expected.outputPath,
      `${JSON.stringify(
        {
          deploymentDigest,
          prerelease: true,
          public: true,
          releaseStagingDigest,
          releaseUrl: release.html_url,
          sourceSha: expected.sourceSha,
          target: expected.tag,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    return Object.freeze({ deploymentDigest, releaseStagingDigest });
  }

  async #request(url: string, token: string, accept: string): Promise<Response> {
    const response = await this.#fetch(url, {
      headers: { Accept: accept, Authorization: `Bearer ${token}`, 'User-Agent': 'gpt-voice-ci' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error('PUBLISHED_RELEASE_ORIGIN_UNAVAILABLE');
    return response;
  }

  async #verifyAsset(response: Response, expected: Readonly<{ length: number; sha256: string }>): Promise<void> {
    if (response.body === null) throw new Error('PUBLISHED_RELEASE_ASSET_DIGEST_INVALID');
    const digest = createHash('sha256');
    const reader = response.body.getReader();
    let length = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > expected.length) throw new Error('PUBLISHED_RELEASE_ASSET_DIGEST_INVALID');
        digest.update(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    if (length !== expected.length || digest.digest('hex') !== expected.sha256) {
      throw new Error('PUBLISHED_RELEASE_ASSET_DIGEST_INVALID');
    }
  }
}
