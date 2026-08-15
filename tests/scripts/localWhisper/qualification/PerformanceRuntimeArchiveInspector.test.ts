import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';

import { PerformanceRuntimeArchiveInspector } from '@scripts/local-whisper/qualification/PerformanceRuntimeArchiveInspector';

const TAR_BLOCK_BYTES = 512;

function writeField(target: Buffer, offset: number, width: number, value: string): void {
  Buffer.from(value, 'ascii').copy(target, offset, 0, width);
}

function writeOctal(target: Buffer, offset: number, width: number, value: number): void {
  writeField(target, offset, width, `${value.toString(8).padStart(width - 1, '0')}\0`);
}

function tarEntry(name: string, content: Buffer, mode = 0o500, type = 0x30): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_BYTES);
  writeField(header, 0, 100, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, content.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = type;
  writeField(header, 257, 6, 'ustar\0');
  writeField(header, 263, 2, '00');
  const checksum = header.reduce((total, value) => total + value, 0);
  writeField(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  const padding = Buffer.alloc((TAR_BLOCK_BYTES - (content.byteLength % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES);
  return Buffer.concat([header, content, padding]);
}

function archive(entries: readonly Buffer[], suffix = Buffer.alloc(0)): Buffer {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(TAR_BLOCK_BYTES * 2), suffix]));
}

describe('performance runtime archive inspector', () => {
  it('streams one restricted runtime archive without extracting it', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-runtime-inspector-'));
    try {
      const worker = Buffer.from('worker-binary');
      const runtime = Buffer.from('runtime-library');
      const runtimeBuildDigest = 'a'.repeat(64);
      const provenance = Buffer.from(
        JSON.stringify({
          schemaId: 'local-whisper-whisper-cpp-provenance-v1',
          profileId: 'linux-x64-cpu-baseline-v1',
          runtimeBuildDigest,
        }),
      );
      const archivePath = path.join(root, 'runtime.tar.gz');
      await writeFile(
        archivePath,
        archive([
          tarEntry('worker', worker),
          tarEntry('runtime-whisper', runtime, 0o400),
          tarEntry('third-party-notices', Buffer.from('notice'), 0o400),
          tarEntry('provenance', provenance, 0o400),
        ]),
      );
      const evidence = await new PerformanceRuntimeArchiveInspector().inspect(archivePath);
      assert.deepEqual(
        evidence.expectedFiles.map(({ fileId, kind, mode }) => ({ fileId, kind, mode })),
        [
          { fileId: 'worker', kind: 'executable', mode: 0o500 },
          { fileId: 'runtime-whisper', kind: 'library', mode: 0o400 },
          { fileId: 'third-party-notices', kind: 'notice', mode: 0o400 },
          { fileId: 'provenance', kind: 'data', mode: 0o400 },
        ],
      );
      assert.equal(evidence.workerSha256, createHash('sha256').update(worker).digest('hex'));
      assert.equal(evidence.profileId, 'linux-x64-cpu-baseline-v1');
      assert.equal(evidence.runtimeBuildDigest, runtimeBuildDigest);
      assert.deepEqual(await readdir(root), ['runtime.tar.gz']);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects duplicate, unsafe, linked, corrupt, truncated, and trailing archive records', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-runtime-inspector-invalid-'));
    try {
      const worker = tarEntry('worker', Buffer.from('worker'));
      const provenance = tarEntry(
        'provenance',
        Buffer.from(
          JSON.stringify({
            schemaId: 'local-whisper-whisper-cpp-provenance-v1',
            profileId: 'linux-x64-cpu-baseline-v1',
            runtimeBuildDigest: 'a'.repeat(64),
          }),
        ),
      );
      const corrupt = Buffer.from(worker);
      corrupt[0] ^= 1;
      const cases = [
        archive([worker, worker, provenance]),
        archive([tarEntry('../worker', Buffer.from('worker'))]),
        archive([tarEntry('worker', Buffer.from('worker'), 0o500, 0x32)]),
        archive([corrupt, provenance]),
        gzipSync(worker.subarray(0, worker.byteLength - 1)),
        archive([worker, provenance], Buffer.from('trailing')),
        archive([worker]),
      ];
      for (const [index, bytes] of cases.entries()) {
        const archivePath = path.join(root, `invalid-${index}.tar.gz`);
        await writeFile(archivePath, bytes);
        await assert.rejects(
          new PerformanceRuntimeArchiveInspector().inspect(archivePath),
          /ATTEMPT_RUNTIME_ARCHIVE_INVALID/u,
        );
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
