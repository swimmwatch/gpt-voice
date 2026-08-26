import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { writeCanonicalJson, sha256Bytes } from '@scripts/local-whisper/packaging/fileIntegrity';
import { ProductionBundleProducer } from '@scripts/local-whisper/release-policy/ProductionBundleProducer';
import { ProductionCandidateAssembler } from '@scripts/local-whisper/release-policy/ProductionCandidateAssembler';
import { ProductionCandidateInventoryVerifier } from '@scripts/local-whisper/release-policy/ProductionCandidateInventoryVerifier';
import type {
  ProductionRuntimePlatform,
  ProductionRuntimeTarget,
} from '@scripts/local-whisper/release-policy/ProductionRuntimeArchiveProducer';
import { ProductionSigningAuthority } from '@scripts/local-whisper/release-policy/ProductionSigningAuthority';

const SOURCE_COMMIT = 'a'.repeat(40);
const CANDIDATE_TARGET = 'task32-protected-candidate';

function authority(): ProductionSigningAuthority {
  const pair = generateKeyPairSync('ed25519');
  return new ProductionSigningAuthority(
    'production-test-ed25519-v1',
    pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  );
}

async function runtime(
  root: string,
  platform: ProductionRuntimePlatform,
  target: ProductionRuntimeTarget,
): Promise<string> {
  const directory = path.join(root, 'runtimes', platform, target);
  const file = `gpt-voice-local-whisper-runtime-${target}.tar.gz`;
  const bytes = Buffer.from(`${platform} ${target} runtime`, 'utf8');
  const cpu = target === 'cpu';
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), bytes);
  await writeCanonicalJson(path.join(directory, 'runtime-archive.json'), {
    archive: {
      file,
      sha256: sha256Bytes(bytes),
      signatureInputSha256: sha256Bytes(bytes),
      sizeBytes: bytes.byteLength,
    },
    evidence: {
      noticesSha256: (cpu ? '1' : '2').repeat(64),
      provenanceSha256: (platform === 'linux' ? (cpu ? '3' : '4') : cpu ? '5' : '6').repeat(64),
      runtimeManifestSha256: (cpu ? '7' : '8').repeat(64),
      sbomSha256: (cpu ? '9' : 'a').repeat(64),
    },
    expectedFiles: [
      {
        fileId: 'worker',
        kind: 'executable',
        mode: 0o500,
        sha256: (cpu ? 'b' : 'c').repeat(64),
        sizeBytes: 123,
      },
    ],
    platform,
    profileId:
      platform === 'linux'
        ? cpu
          ? 'linux-x64-cpu-baseline-v1'
          : 'linux-x64-cuda-12.8.1-sm120a-v1'
        : cpu
          ? 'windows-x64-cpu-msvc-19.51-v1'
          : 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
    purpose: 'production',
    reproducible: true,
    target,
    transferProfile: 'restricted-tar-gzip-v1',
  });
  return directory;
}

describe('ProductionCandidateAssembler', () => {
  it('constructs the exact 16-asset and 32-file private candidate', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-candidate-assembler-'));
    try {
      const signer = authority();
      const runtimeDirectories = {
        linux: {
          cpu: await runtime(root, 'linux', 'cpu'),
          'sm_120a-real': await runtime(root, 'linux', 'sm_120a-real'),
        },
        win32: {
          cpu: await runtime(root, 'win32', 'cpu'),
          'sm_120a-real': await runtime(root, 'win32', 'sm_120a-real'),
        },
      } as const;
      const bundles = {} as Record<ProductionRuntimePlatform, { bundleDirectory: string; descriptorPath: string }>;
      for (const platform of ['linux', 'win32'] as const) {
        const bundleDirectory = path.join(root, 'bundles', platform, 'bundle');
        const descriptorPath = path.join(root, 'bundles', platform, 'bundle-descriptor.json');
        const descriptor = await new ProductionBundleProducer(signer).produce({
          appRevision: '1.4.0',
          approvedAt: '2026-08-22T00:00:00.000Z',
          approvedBy: 'release-maintainer',
          outputDirectory: bundleDirectory,
          platform,
          releaseTarget: CANDIDATE_TARGET,
          runtimeDirectories: runtimeDirectories[platform],
          sourceCommit: SOURCE_COMMIT,
        });
        await writeCanonicalJson(descriptorPath, descriptor);
        bundles[platform] = { bundleDirectory, descriptorPath };
      }

      const applications = {
        linux: path.join(root, 'applications', 'linux'),
        win32: path.join(root, 'applications', 'win32'),
      };
      await Promise.all([
        mkdir(applications.linux, { recursive: true }),
        mkdir(applications.win32, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(path.join(applications.linux, 'GPT-Voice-1.4.0.AppImage'), 'appimage'),
        writeFile(path.join(applications.linux, 'gpt-voice_1.4.0_amd64.deb'), 'deb'),
        writeFile(path.join(applications.linux, 'gpt-voice-1.4.0.x86_64.rpm'), 'rpm'),
        writeFile(path.join(applications.win32, 'GPT-Voice.Setup.1.4.0.exe'), 'nsis'),
      ]);
      const outputDirectory = path.join(root, 'candidate-assets');
      const candidatePath = path.join(root, 'candidate.json');
      const candidate = await new ProductionCandidateAssembler(signer).assemble({
        applicationDirectories: applications,
        bundles,
        candidatePath,
        candidateTarget: CANDIDATE_TARGET,
        outputDirectory,
        runtimeDirectories: {
          linux: path.join(root, 'runtimes', 'linux'),
          win32: path.join(root, 'runtimes', 'win32'),
        },
        sourceCommit: SOURCE_COMMIT,
      });

      assert.equal(candidate.assets.length, 16);
      assert.equal((await readdir(outputDirectory)).length, 32);
      assert.deepEqual(
        candidate.assets
          .filter((asset) => asset.role === 'runtime')
          .map((asset) => asset.fileName)
          .sort(),
        [
          'linux-gpt-voice-local-whisper-runtime-cpu.tar.gz',
          'linux-gpt-voice-local-whisper-runtime-sm_120a-real.tar.gz',
          'win32-gpt-voice-local-whisper-runtime-cpu.tar.gz',
          'win32-gpt-voice-local-whisper-runtime-sm_120a-real.tar.gz',
        ],
      );
      assert.equal(
        candidate.assets.some(({ fileName }) => fileName.includes('ggml-')),
        false,
      );
      const verified = await new ProductionCandidateInventoryVerifier().verify({
        artifactDirectory: outputDirectory,
        candidatePath,
        expectedTarget: CANDIDATE_TARGET,
        targetKind: 'private',
      });
      assert.equal(verified.releaseCandidateDigest, candidate.releaseCandidateDigest);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
