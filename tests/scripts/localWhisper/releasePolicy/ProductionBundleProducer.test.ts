import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { BundleVerifier } from '@scripts/local-whisper/packaging/BundleVerifier';
import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';
import { ProductionBundleProducer } from '@scripts/local-whisper/release-policy/ProductionBundleProducer';
import type { ProductionRuntimeTarget } from '@scripts/local-whisper/release-policy/ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from '@scripts/local-whisper/release-policy/ProductionSigningAuthority';

function authority(): ProductionSigningAuthority {
  const pair = generateKeyPairSync('ed25519');
  return new ProductionSigningAuthority(
    'production-test-ed25519-v1',
    pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  );
}

async function runtime(root: string, target: ProductionRuntimeTarget): Promise<string> {
  const directory = path.join(root, target);
  const file = `gpt-voice-local-whisper-linux-x64-${target}.tar.gz`;
  const bytes = Buffer.from(`production ${target} runtime`, 'utf8');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), bytes);
  const cpu = target === 'cpu';
  await writeCanonicalJson(path.join(directory, 'runtime-archive.json'), {
    archive: {
      file,
      sha256: sha256Bytes(bytes),
      signatureInputSha256: sha256Bytes(bytes),
      sizeBytes: bytes.byteLength,
    },
    evidence: {
      noticesSha256: (cpu ? '1' : '2').repeat(64),
      provenanceSha256: (cpu ? '3' : '4').repeat(64),
      runtimeManifestSha256: (cpu ? '5' : '6').repeat(64),
      sbomSha256: (cpu ? '7' : '8').repeat(64),
    },
    expectedFiles: [
      {
        fileId: 'worker',
        kind: 'executable',
        mode: 0o500,
        sha256: (cpu ? '9' : 'a').repeat(64),
        sizeBytes: 123,
      },
    ],
    platform: 'linux',
    profileId: cpu ? 'linux-x64-cpu-baseline-v1' : 'linux-x64-cuda-12.8.1-sm120a-v1',
    purpose: 'production',
    reproducible: true,
    target,
    transferProfile: 'restricted-tar-gzip-v1',
  });
  return directory;
}

describe('ProductionBundleProducer', () => {
  it('creates a verified signed CPU/CUDA bundle without copying model bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-bundle-'));
    try {
      const [cpu, cuda] = await Promise.all([runtime(root, 'cpu'), runtime(root, 'sm_120a-real')]);
      const output = path.join(root, 'bundle');
      const result = await new ProductionBundleProducer(authority()).produce({
        appRevision: '1.4.0',
        approvedAt: '2026-08-22T00:00:00.000Z',
        approvedBy: 'release-maintainer',
        outputDirectory: output,
        platform: 'linux',
        releaseTarget: 'task32-protected-candidate',
        runtimeDirectories: { cpu, 'sm_120a-real': cuda },
        sourceCommit: 'a'.repeat(40),
      });

      const verified = await new BundleVerifier().verify(output, {
        purpose: 'production',
        manifestSha256: result.bundleManifestSha256,
      });
      await new BundleVerifier().verifyProductionApproval(verified);
      assert.equal(verified.runtimePacks.length, 2);
      assert.equal(verified.modelPack, null);
      await assert.rejects(readFile(path.join(output, 'model-pack.manifest.json')), /ENOENT/u);
      const catalog = await readFile(path.join(output, 'catalog.json'), 'utf8');
      assert.match(catalog, /production-test-ed25519-v1/u);
      assert.doesNotMatch(catalog, /BEGIN PRIVATE KEY/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
