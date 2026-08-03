import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';

import { FileBackedArtifactStreamingWorker } from '@main/localWhisper/artifacts/FileBackedArtifactStreamingWorker';
import { LocalWhisperArtifactLifecycleError } from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';

const TAR_RECORD_BYTES = 512;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function octal(value: number, width: number): Buffer {
  return Buffer.from(`${value.toString(8).padStart(width - 1, '0')}\0`, 'ascii');
}

function tarHeader(name: string, mode: number, sizeBytes: number): Buffer {
  const header = Buffer.alloc(TAR_RECORD_BYTES);
  header.write(name, 0, 100, 'ascii');
  octal(mode, 8).copy(header, 100);
  octal(0, 8).copy(header, 108);
  octal(0, 8).copy(header, 116);
  octal(sizeBytes, 12).copy(header, 124);
  octal(0, 12).copy(header, 136);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write('ustar\0', 257, 6, 'latin1');
  header.write('00', 263, 2, 'ascii');
  octal(0, 8).copy(header, 329);
  octal(0, 8).copy(header, 337);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  Buffer.from(`${checksum.toString(8).padStart(6, '0')}\0 `, 'latin1').copy(header, 148);
  return header;
}

function restrictedRuntime(fileId: string, mode: number, contents: Uint8Array): Buffer {
  const padding = Buffer.alloc((TAR_RECORD_BYTES - (contents.byteLength % TAR_RECORD_BYTES)) % TAR_RECORD_BYTES);
  const tar = Buffer.concat([
    tarHeader(fileId, mode, contents.byteLength),
    Buffer.from(contents),
    padding,
    Buffer.alloc(TAR_RECORD_BYTES * 2),
  ]);
  return gzipSync(tar, { level: 9 });
}

async function* chunks(bytes: Uint8Array, chunkBytes = 7): AsyncIterable<Uint8Array> {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes) {
    yield bytes.subarray(offset, Math.min(bytes.byteLength, offset + chunkBytes));
  }
}

async function collect(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const values: Buffer[] = [];
  for await (const value of source) values.push(Buffer.from(value));
  return Buffer.concat(values);
}

describe('FileBackedArtifactStreamingWorker', () => {
  it('materializes one exact raw model without deriving a transport path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'local-whisper-raw-worker-'));
    const worker = new FileBackedArtifactStreamingWorker(root);
    const artifactId = toLocalWhisperArtifactId('raw-model-artifact');
    const fileId = toLocalWhisperArtifactId('model-data');
    assert.ok(artifactId && fileId);
    const bytes = Buffer.from('raw-model-bytes', 'utf8');
    try {
      const result = await worker.process({
        artifactId,
        expectedFiles: [{ fileId, kind: 'data', mode: 0o600, sizeBytes: bytes.byteLength, sha256: sha256(bytes) }],
        expectedTransferSha256: sha256(bytes),
        expectedTransferSizeBytes: bytes.byteLength,
        operationId: 'raw-model-operation-000001',
        resume: null,
        signal: new AbortController().signal,
        stream: chunks(bytes),
        transferProfile: 'pinned-raw-model-v1',
        onProgress: () => Promise.resolve(),
      });
      assert.equal(result.entries.length, 1);
      assert.equal(result.entries[0]?.name, fileId);
      assert.deepEqual(await collect(result.entries[0]!.chunks), bytes);
      await worker.discard(result.spoolId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts only the deterministic single-member gzip and ordered flat ustar manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'local-whisper-runtime-worker-'));
    const worker = new FileBackedArtifactStreamingWorker(root);
    const artifactId = toLocalWhisperArtifactId('runtime-artifact');
    const fileId = toLocalWhisperArtifactId('runtime-worker');
    assert.ok(artifactId && fileId);
    const contents = Buffer.from('runtime-worker-bytes', 'utf8');
    const archive = restrictedRuntime(fileId, 0o755, contents);
    try {
      const result = await worker.process({
        artifactId,
        expectedFiles: [
          { fileId, kind: 'executable', mode: 0o755, sizeBytes: contents.byteLength, sha256: sha256(contents) },
        ],
        expectedTransferSha256: sha256(archive),
        expectedTransferSizeBytes: archive.byteLength,
        operationId: 'runtime-operation-00000001',
        resume: null,
        signal: new AbortController().signal,
        stream: chunks(archive),
        transferProfile: 'restricted-tar-gzip-v1',
        onProgress: () => Promise.resolve(),
      });
      assert.equal(result.entries[0]?.mode, 0o755);
      assert.deepEqual(await collect(result.entries[0]!.chunks), contents);
      assert.ok(result.peakBufferedBytes <= 7);
      await worker.discard(result.spoolId);

      const concatenated = Buffer.concat([archive, archive]);
      await assert.rejects(
        worker.process({
          artifactId,
          expectedFiles: [
            { fileId, kind: 'executable', mode: 0o755, sizeBytes: contents.byteLength, sha256: sha256(contents) },
          ],
          expectedTransferSha256: sha256(concatenated),
          expectedTransferSizeBytes: concatenated.byteLength,
          operationId: 'runtime-operation-00000002',
          resume: null,
          signal: new AbortController().signal,
          stream: chunks(concatenated),
          transferProfile: 'restricted-tar-gzip-v1',
          onProgress: () => Promise.resolve(),
        }),
        (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'ARCHIVE_INVALID',
      );
      await worker.discard('runtime-operation-00000002');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
