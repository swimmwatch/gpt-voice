import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';
import { ProductionRuntimeArchiveProducer } from '@scripts/local-whisper/release-policy/ProductionRuntimeArchiveProducer';

async function stage(root: string): Promise<void> {
  const binDirectory = path.join(root, 'bin');
  await mkdir(binDirectory, { recursive: true, mode: 0o700 });
  const worker = path.join(binDirectory, 'local-whisper-whisper-cpp-worker');
  const workerBytes = Buffer.from('deterministic production runtime fixture\n');
  await writeFile(worker, workerBytes, { mode: 0o500 });
  await chmod(worker, 0o500);
  await writeCanonicalJson(path.join(root, 'expected-files.json'), {
    files: [
      {
        id: 'worker',
        mode: 0o500,
        relativePath: 'bin/local-whisper-whisper-cpp-worker',
        sha256: sha256Bytes(workerBytes),
        sizeBytes: workerBytes.byteLength,
      },
    ],
    schemaId: 'local-whisper-expected-files-v1',
  });
  await writeCanonicalJson(path.join(root, 'runtime-manifest.json'), { schemaId: 'test-runtime' });
  await writeCanonicalJson(path.join(root, 'provenance.json'), { schemaId: 'test-provenance' });
  await writeCanonicalJson(path.join(root, 'sbom.spdx.json'), { schemaId: 'test-sbom' });
  await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'fixture notice\n', { mode: 0o400 });
}

describe('ProductionRuntimeArchiveProducer', () => {
  it('collects reproducible CPU bytes from two independent clean stages', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-runtime-'));
    try {
      const firstStage = path.join(root, 'first-stage');
      const secondStage = path.join(root, 'second-stage');
      await Promise.all([stage(firstStage), stage(secondStage)]);
      const output = path.join(root, 'candidate');
      const record = await new ProductionRuntimeArchiveProducer().produce({
        firstStageRoot: firstStage,
        outputDirectory: output,
        platform: 'linux',
        secondStageRoot: secondStage,
        target: 'cpu',
      });
      const archive = await readFile(path.join(output, record.archive.file));
      assert.equal(record.purpose, 'production');
      assert.equal(record.reproducible, true);
      assert.equal(record.transferProfile, 'restricted-tar-gzip-v1');
      assert.equal(record.archive.sha256, sha256Bytes(archive));
      assert.equal(record.archive.signatureInputSha256, record.archive.sha256);
      assert.equal(record.expectedFiles[0]?.fileId, 'worker');
      assert.equal(record.evidence.provenanceSha256.length, 64);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a single stage root before creating candidate output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-production-runtime-'));
    try {
      const sharedStage = path.join(root, 'stage');
      const output = path.join(root, 'candidate');
      await stage(sharedStage);
      await assert.rejects(
        new ProductionRuntimeArchiveProducer().produce({
          firstStageRoot: sharedStage,
          outputDirectory: output,
          platform: 'win32',
          secondStageRoot: sharedStage,
          target: 'sm_120a-real',
        }),
        /independent clean stage roots/u,
      );
      await assert.rejects(readFile(output), /ENOENT/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
