import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';
import { ProductionCandidateInventoryVerifier } from '@scripts/local-whisper/release-policy/ProductionCandidateInventoryVerifier';
import {
  productionReleaseCandidateDigest,
  type ReleaseAsset,
  type ReleaseAssetFormat,
  type ReleaseAssetPlatform,
  type ReleaseAssetRole,
  type ReleaseAssetTarget,
  type ReleaseCandidate,
} from '@scripts/local-whisper/release-policy/ReleaseProtocol';

const BYTES = Buffer.from('x');
const DIGEST = sha256Bytes(BYTES);

function asset(
  platform: ReleaseAssetPlatform,
  role: ReleaseAssetRole,
  target: ReleaseAssetTarget,
  format: ReleaseAssetFormat,
): ReleaseAsset {
  const identity = `${platform}-${role}-${target}-${format}`;
  return {
    fileName: `${identity}.artifact`,
    format,
    length: BYTES.byteLength,
    platform,
    role,
    sha256: DIGEST,
    signature: {
      fileName: `${identity}.signature`,
      keyId: 'production-key-v1',
      length: BYTES.byteLength,
      sha256: DIGEST,
    },
    target,
  };
}

function candidate(): ReleaseCandidate {
  const assets = [
    asset('linux', 'application', 'app', 'appimage'),
    asset('linux', 'application', 'app', 'deb'),
    asset('linux', 'application', 'app', 'rpm'),
    asset('win32', 'application', 'app', 'nsis'),
    asset('linux', 'runtime', 'cpu', 'restricted-tar-gzip-v1'),
    asset('win32', 'runtime', 'cpu', 'restricted-tar-gzip-v1'),
    asset('linux', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'),
    asset('win32', 'runtime', 'sm_120a-real', 'restricted-tar-gzip-v1'),
    asset('global', 'catalog', 'release', 'json'),
    asset('global', 'keyring', 'release', 'json'),
    asset('global', 'checksums', 'release', 'text'),
    asset('global', 'manifest', 'release', 'json'),
    asset('global', 'sbom', 'release', 'json'),
    asset('global', 'notices', 'release', 'text'),
    asset('global', 'provenance', 'release', 'json'),
    asset('global', 'compatibility', 'release', 'json'),
  ];
  const manifest = assets.find((entry) => entry.role === 'manifest');
  if (!manifest) throw new Error('Missing fixture manifest');
  const candidateWithoutDigest = {
    assets,
    candidateInputDigest: DIGEST,
    manifestSignature: manifest.signature,
    purpose: 'production',
    target: 'v2.4.0-alpha.1',
  } as const;
  return {
    ...candidateWithoutDigest,
    releaseCandidateDigest: productionReleaseCandidateDigest(candidateWithoutDigest),
  };
}

async function writeCandidate(root: string): Promise<{ artifacts: string; candidatePath: string }> {
  const artifacts = path.join(root, 'artifacts');
  const candidatePath = path.join(root, 'candidate.json');
  const document = candidate();
  await mkdir(artifacts, { mode: 0o700, recursive: true });
  await writeCanonicalJson(candidatePath, document);
  await Promise.all(
    document.assets.flatMap((entry) => [
      writeFile(path.join(artifacts, entry.fileName), BYTES, { mode: 0o600 }),
      writeFile(path.join(artifacts, entry.signature.fileName), BYTES, { mode: 0o600 }),
    ]),
  );
  return { artifacts, candidatePath };
}

describe('ProductionCandidateInventoryVerifier', () => {
  it('accepts precisely the full signature-bound physical inventory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-candidate-'));
    try {
      const input = await writeCandidate(root);
      const result = await new ProductionCandidateInventoryVerifier().verify({
        artifactDirectory: input.artifacts,
        candidatePath: input.candidatePath,
      });
      assert.equal(result.assets.length, 16);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects missing, extra, and substituted physical bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-candidate-'));
    try {
      const input = await writeCandidate(root);
      const verifier = new ProductionCandidateInventoryVerifier();
      await unlink(path.join(input.artifacts, candidate().assets[0].fileName));
      await assert.rejects(verifier.verify({ artifactDirectory: input.artifacts, candidatePath: input.candidatePath }));

      const complete = await writeCandidate(path.join(root, 'extra'));
      await writeFile(path.join(complete.artifacts, 'unexpected.bin'), BYTES, { mode: 0o600 });
      await assert.rejects(
        verifier.verify({ artifactDirectory: complete.artifacts, candidatePath: complete.candidatePath }),
      );

      const substituted = await writeCandidate(path.join(root, 'substituted'));
      await writeFile(path.join(substituted.artifacts, candidate().assets[1].fileName), 'different', { mode: 0o600 });
      await assert.rejects(
        verifier.verify({ artifactDirectory: substituted.artifacts, candidatePath: substituted.candidatePath }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
