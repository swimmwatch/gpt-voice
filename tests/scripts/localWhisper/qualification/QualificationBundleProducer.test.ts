import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { BundleVerifier } from '../../../../scripts/local-whisper/packaging/BundleVerifier';
import { sha256Bytes } from '../../../../scripts/local-whisper/packaging/fileIntegrity';
import { LocalWhisperQualificationBundleProducer } from '../../../../scripts/local-whisper/qualification/QualificationBundleProducer';

const sha = (digit: string): string => digit.repeat(64);

describe('LocalWhisperQualificationBundleProducer', () => {
  it('creates a public-only signed CPU/CUDA qualification bundle accepted by the verifier', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-bundle-test-'));
    try {
      const runtimeCpu = path.join(root, 'runtime-cpu.tar.gz');
      const runtimeCuda = path.join(root, 'runtime-cuda.tar.gz');
      const model = path.join(root, 'ggml-tiny.bin');
      await Promise.all([
        writeFile(runtimeCpu, 'qualification cpu runtime'),
        writeFile(runtimeCuda, 'qualification cuda runtime'),
        writeFile(model, 'qualification model'),
      ]);
      const output = path.join(root, 'bundle');
      const result = await new LocalWhisperQualificationBundleProducer().produce({
        outputDirectory: output,
        catalog: {
          candidateSemVer: '2.4.0',
          catalogRevision: 'qualification-catalog-v2.4.0',
          runtimeOriginId: 'qualification-runtime-origin',
          runtimeOrigin: 'https://127.0.0.1:39443',
          sourceCommit: 'a'.repeat(40),
        },
        runtimes: (['cpu', 'cuda'] as const).map((backend) => ({
          archivePath: backend === 'cpu' ? runtimeCpu : runtimeCuda,
          catalog: {
            backend,
            buildRevision: backend === 'cpu' ? sha('1') : sha('2'),
            packRevision: `linux-x64-${backend}-v2.4.0`,
            profileDigest: backend === 'cpu' ? sha('3') : sha('4'),
            expectedFiles: [
              {
                fileId: toLocalWhisperArtifactId('worker')!,
                kind: 'executable',
                mode: 0o500,
                sizeBytes: 1,
                sha256: backend === 'cpu' ? sha('5') : sha('6'),
              },
            ],
            prerequisites: [backend === 'cpu' ? 'glibc-2.31' : 'nvidia-driver-r570'],
            provenanceId: `qualification-${backend}-provenance`,
            sbomRevision: `qualification-${backend}-sbom-v1`,
            noticeIds: [`qualification-${backend}-notice`],
            licenseIds: ['mit-license'],
          },
        })),
        model: {
          filePath: model,
          artifactId: 'qualification-model-tiny',
          artifactRevision: 'qualification-model-tiny-v1',
          expectedSha256: sha256Bytes(await readFile(model)),
          expectedSizeBytes: (await readFile(model)).byteLength,
        },
      });
      const verified = await new BundleVerifier().verify(output, {
        purpose: 'qualification',
        manifestSha256: result.bundleManifestSha256,
      });
      assert.equal(verified.manifest.keyId, result.keyId);
      assert.match(await readFile(path.join(output, 'keyring.json'), 'utf8'), /BEGIN PUBLIC KEY/u);
      assert.doesNotMatch(await readFile(path.join(output, 'keyring.json'), 'utf8'), /BEGIN PRIVATE KEY/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
