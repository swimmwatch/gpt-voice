import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { BundleVerifier } from '../../../../scripts/local-whisper/packaging/BundleVerifier';
import {
  inspectFlatDirectory,
  readCanonicalJson,
  sha256Bytes,
  writeCanonicalJson,
} from '../../../../scripts/local-whisper/packaging/fileIntegrity';
import { LocalWhisperQualificationBundleProducer } from '../../../../scripts/local-whisper/qualification/QualificationBundleProducer';

const sha = (digit: string): string => digit.repeat(64);
const canonicalTiny = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(({ family }) => family === 'tiny')!;
const cachedTinyPath = path.resolve('.cache/local-whisper/qualification/models/ggml-tiny.bin');

describe('LocalWhisperQualificationBundleProducer', () => {
  it(
    'creates a public-only signed CPU/CUDA qualification bundle accepted by the verifier',
    { skip: !existsSync(cachedTinyPath) && 'requires the Task 19 canonical tiny model cache' },
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-bundle-test-'));
      try {
        const runtimeCpu = path.join(root, 'runtime-cpu.tar.gz');
        const runtimeCuda = path.join(root, 'runtime-cuda.tar.gz');
        await Promise.all([
          writeFile(runtimeCpu, 'qualification cpu runtime'),
          writeFile(runtimeCuda, 'qualification cuda runtime'),
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
            filePath: cachedTinyPath,
            family: 'tiny',
            variant: 'full',
            expectedSha256: canonicalTiny.sha256,
            expectedSizeBytes: canonicalTiny.sizeBytes,
          },
        });
        const verified = await new BundleVerifier().verify(output, {
          purpose: 'qualification',
          manifestSha256: result.bundleManifestSha256,
        });
        assert.equal(verified.manifest.keyId, result.keyId);
        assert.match(await readFile(path.join(output, 'keyring.json'), 'utf8'), /BEGIN PUBLIC KEY/u);
        assert.doesNotMatch(await readFile(path.join(output, 'keyring.json'), 'utf8'), /BEGIN PRIVATE KEY/u);

        const runtimeManifestPath = path.join(output, 'runtime-pack.manifest.json');
        const runtimeManifest = (await readCanonicalJson(runtimeManifestPath)) as Readonly<Record<string, unknown>>;
        await writeCanonicalJson(runtimeManifestPath, {
          ...runtimeManifest,
          artifactRevision: 'linux-x64-cpu-v2.4.0-mutated',
        });
        const bundleManifestPath = path.join(output, 'bundle-manifest.json');
        const bundleManifest = (await readCanonicalJson(bundleManifestPath)) as Readonly<Record<string, unknown>>;
        const mutatedBundleManifest = {
          ...bundleManifest,
          files: await inspectFlatDirectory(output, ['bundle-manifest.json']),
        };
        await writeCanonicalJson(bundleManifestPath, mutatedBundleManifest);
        const frozenMutatedBundleManifest = await readCanonicalJson(bundleManifestPath);
        await assert.rejects(
          new BundleVerifier().verify(output, {
            purpose: 'qualification',
            manifestSha256: sha256Bytes(JSON.stringify(frozenMutatedBundleManifest)),
          }),
          /catalog\/runtime pack identity mismatch/u,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('rejects a model object outside the canonical release matrix', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-qualification-bundle-test-'));
    try {
      const model = path.join(root, 'ggml-tiny.bin');
      const runtimeCpu = path.join(root, 'runtime-cpu.tar.gz');
      const runtimeCuda = path.join(root, 'runtime-cuda.tar.gz');
      await Promise.all([
        writeFile(model, 'not the canonical model'),
        writeFile(runtimeCpu, 'qualification cpu runtime'),
        writeFile(runtimeCuda, 'qualification cuda runtime'),
      ]);
      await assert.rejects(
        new LocalWhisperQualificationBundleProducer().produce({
          outputDirectory: path.join(root, 'bundle'),
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
            family: 'tiny',
            variant: 'full',
            expectedSha256: sha256Bytes(await readFile(model)),
            expectedSizeBytes: (await readFile(model)).byteLength,
          },
        }),
        /canonical release matrix/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
