import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { HostedProductionRuntimeArchiveCollector } from '@scripts/local-whisper/release-policy/HostedProductionRuntimeArchiveCollector';
import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';

const ARCHIVE = Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.alloc(32, 0x61)]);
const PROFILE_ID = 'linux-x64-cpu-baseline-v1';

async function writePack(directory: string, bytes = ARCHIVE): Promise<void> {
  const archiveFile = `${PROFILE_ID}.tar.gz`;
  const digest = sha256Bytes(bytes);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, archiveFile), bytes, { mode: 0o600 });
  await writeCanonicalJson(path.join(directory, 'runtime-pack.json'), {
    schemaVersion: 1,
    profileId: PROFILE_ID,
    transferProfile: 'restricted-tar-gzip-v1',
    archive: {
      file: archiveFile,
      sizeBytes: bytes.byteLength,
      sha256: digest,
      signatureInputSha256: digest,
    },
    expectedFiles: [{ fileId: 'worker', kind: 'executable', mode: 0o500, sizeBytes: 1, sha256: 'a'.repeat(64) }],
    evidence: {
      runtimeManifestSha256: 'b'.repeat(64),
      provenanceSha256: 'c'.repeat(64),
      sbomSha256: 'd'.repeat(64),
      noticesSha256: 'e'.repeat(64),
    },
  });
}

describe('HostedProductionRuntimeArchiveCollector', () => {
  it('collects only matching independently reproduced hosted-runner packs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'hosted-production-runtime-'));
    try {
      const first = path.join(root, 'first');
      const second = path.join(root, 'second');
      const output = path.join(root, 'output');
      await Promise.all([writePack(first), writePack(second)]);

      const record = await new HostedProductionRuntimeArchiveCollector().collect({
        firstPackDirectory: first,
        outputDirectory: output,
        platform: 'linux',
        secondPackDirectory: second,
        target: 'cpu',
      });

      assert.equal(record.archive.file, 'gpt-voice-local-whisper-linux-x64-cpu.tar.gz');
      assert.deepEqual(await readFile(path.join(output, record.archive.file)), ARCHIVE);
      assert.equal(record.expectedFiles[0]?.fileId, 'worker');
      assert.equal(record.evidence.provenanceSha256, 'c'.repeat(64));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects reused roots, changed bytes, and unsafe archive paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'hosted-production-runtime-'));
    try {
      const first = path.join(root, 'first');
      const second = path.join(root, 'second');
      await Promise.all([
        writePack(first),
        writePack(second, Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.alloc(32, 0x62)])),
      ]);
      const collector = new HostedProductionRuntimeArchiveCollector();

      await assert.rejects(
        collector.collect({
          firstPackDirectory: first,
          outputDirectory: path.join(root, 'same-root-output'),
          platform: 'linux',
          secondPackDirectory: first,
          target: 'cpu',
        }),
        /independent/u,
      );
      await assert.rejects(
        collector.collect({
          firstPackDirectory: first,
          outputDirectory: path.join(root, 'changed-output'),
          platform: 'linux',
          secondPackDirectory: second,
          target: 'cpu',
        }),
        /reproducible/u,
      );

      const documentPath = path.join(first, 'runtime-pack.json');
      const document = JSON.parse(await readFile(documentPath, 'utf8')) as { archive: { file: string } };
      document.archive.file = '../outside.tar.gz';
      await writeCanonicalJson(documentPath, document);
      await assert.rejects(
        collector.collect({
          firstPackDirectory: first,
          outputDirectory: path.join(root, 'unsafe-output'),
          platform: 'linux',
          secondPackDirectory: second,
          target: 'cpu',
        }),
        /record is invalid/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
