import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LOCAL_WHISPER_RELEASE_TARGETS,
  type ReleaseAsset,
  type ReleaseAssetFormat,
  type ReleaseAssetPlatform,
  type ReleaseAssetRole,
  type ReleaseAssetTarget,
  type ReleaseCandidate,
} from '@scripts/local-whisper/release-policy/ReleaseProtocol';
import { PublishedReleaseVerifier } from '@scripts/local-whisper/release-policy/PublishedReleaseVerifier';

const SOURCE_SHA = 'a'.repeat(40);

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function asset(
  index: number,
  platform: ReleaseAssetPlatform,
  role: ReleaseAssetRole,
  target: ReleaseAssetTarget,
  format: ReleaseAssetFormat,
): ReleaseAsset {
  const identity = `${platform}-${role}-${target}-${format}`;
  const contents = Uint8Array.of(index + 1);
  const signature = Uint8Array.of(index + 101);
  return {
    fileName: `${identity}.artifact`,
    format,
    length: contents.byteLength,
    platform,
    role,
    sha256: sha256(contents),
    signature: {
      fileName: `${identity}.signature`,
      keyId: 'production-release-key-v1',
      length: signature.byteLength,
      sha256: sha256(signature),
    },
    target,
  };
}

function candidate(): ReleaseCandidate {
  const identities: readonly [ReleaseAssetPlatform, ReleaseAssetRole, ReleaseAssetTarget, ReleaseAssetFormat][] = [
    ['linux', 'application', 'app', 'appimage'],
    ['linux', 'application', 'app', 'deb'],
    ['linux', 'application', 'app', 'rpm'],
    ['win32', 'application', 'app', 'nsis'],
    ['linux', 'runtime', 'cpu', 'restricted-tar-gzip-v1'],
    ['win32', 'runtime', 'cpu', 'restricted-tar-gzip-v1'],
    ['linux', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'],
    ['win32', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'],
    ['global', 'catalog', 'release', 'json'],
    ['global', 'keyring', 'release', 'json'],
    ['global', 'checksums', 'release', 'text'],
    ['global', 'manifest', 'release', 'json'],
    ['global', 'sbom', 'release', 'json'],
    ['global', 'notices', 'release', 'text'],
    ['global', 'provenance', 'release', 'json'],
    ['global', 'compatibility', 'release', 'json'],
  ];
  const assets = identities.map((identity, index) => asset(index, ...identity));
  const manifest = assets.find((entry) => entry.role === 'manifest');
  if (!manifest) throw new Error('manifest fixture missing');
  return {
    assets,
    candidateInputDigest: 'b'.repeat(64),
    manifestSignature: manifest.signature,
    purpose: 'production',
    releaseCandidateDigest: 'c'.repeat(64),
    target: LOCAL_WHISPER_RELEASE_TARGETS.alpha,
  };
}

function physicalBytes(releaseCandidate: ReleaseCandidate): Map<string, Uint8Array> {
  const bytes = new Map<string, Uint8Array>();
  for (const [index, entry] of releaseCandidate.assets.entries()) {
    bytes.set(entry.fileName, Uint8Array.of(index + 1));
    bytes.set(entry.signature.fileName, Uint8Array.of(index + 101));
  }
  return bytes;
}

describe('PublishedReleaseVerifier', () => {
  it('streams every exact public byte, writes bounded evidence, and rejects origin or digest substitution', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'published-release-'));
    const candidatePath = path.join(root, 'candidate.json');
    const outputPath = path.join(root, 'deployment', 'deployment.json');
    const releaseCandidate = candidate();
    const bytes = physicalBytes(releaseCandidate);
    await writeFile(candidatePath, JSON.stringify(releaseCandidate), 'utf8');
    const assets = [...bytes.entries()].map(([name, contents], index) => ({
      browser_download_url: `https://github.com/swimmwatch/gpt-voice/releases/download/v2.4.0-alpha.1/${name}`,
      id: index + 1,
      name,
      size: contents.byteLength,
    }));
    const fetchImplementation = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('https://api.github.com/')) {
        return new Response(
          JSON.stringify({
            assets,
            draft: false,
            html_url: 'https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1',
            id: 42,
            prerelease: true,
            tag_name: 'v2.4.0-alpha.1',
            target_commitish: SOURCE_SHA,
          }),
          { status: 200 },
        );
      }
      const segments = url.split('/');
      const name = decodeURIComponent(segments[segments.length - 1] ?? '');
      const contents = bytes.get(name);
      return contents === undefined
        ? new Response(null, { status: 404 })
        : new Response(Uint8Array.from(contents).buffer, { status: 200 });
    }) as typeof fetch;
    const verifier = new PublishedReleaseVerifier({ fetchImplementation });
    const expected = {
      outputPath,
      repository: 'swimmwatch/gpt-voice',
      sourceSha: SOURCE_SHA,
      tag: 'v2.4.0-alpha.1',
      token: 'test-token',
    };
    const result = await verifier.verify(candidatePath, expected);
    assert.match(result.deploymentDigest, /^[a-f\d]{64}$/u);
    assert.match(result.releaseStagingDigest, /^[a-f\d]{64}$/u);
    const evidence = JSON.parse(await readFile(outputPath, 'utf8')) as Readonly<Record<string, unknown>>;
    assert.equal(evidence.deploymentDigest, result.deploymentDigest);
    assert.equal(evidence.target, 'v2.4.0-alpha.1');

    const originalUrl = assets[0].browser_download_url;
    assets[0].browser_download_url = `https://attacker.invalid/${assets[0].name}`;
    await assert.rejects(verifier.verify(candidatePath, expected), /PUBLISHED_RELEASE_ORIGIN_INVALID/u);
    assets[0].browser_download_url = originalUrl;
    bytes.set(assets[0].name, Uint8Array.of(255));
    await assert.rejects(verifier.verify(candidatePath, expected), /PUBLISHED_RELEASE_ASSET_DIGEST_INVALID/u);
  });
});
