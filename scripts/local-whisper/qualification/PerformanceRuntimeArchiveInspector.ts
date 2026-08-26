import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

import { toLocalWhisperArtifactId, type LocalWhisperRuntimeIdentity } from '@shared/localWhisper';

const TAR_BLOCK_BYTES = 512;
const MAXIMUM_ENTRY_COUNT = 64;
const MAXIMUM_EXPANDED_BYTES = 8 * 1024 ** 3;
const MAXIMUM_PROVENANCE_BYTES = 1024 * 1024;
const SAFE_FILE_ID = /^[\dA-Za-z][\w.-]{0,99}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface PerformanceRuntimeArchiveEvidence {
  readonly expectedFiles: LocalWhisperRuntimeIdentity['expectedFiles'];
  readonly workerSha256: string;
  readonly profileId: 'linux-x64-cpu-baseline-v1' | 'linux-x64-cuda-12.8.1-sm120a-v1';
  readonly runtimeBuildDigest: string;
}

export class PerformanceRuntimeArchiveError extends Error {
  public constructor() {
    super('ATTEMPT_RUNTIME_ARCHIVE_INVALID');
    this.name = 'PerformanceRuntimeArchiveError';
  }
}

function fail(): never {
  throw new PerformanceRuntimeArchiveError();
}

function octal(header: Buffer, offset: number, width: number): number {
  const source = header.subarray(offset, offset + width);
  const nul = source.indexOf(0);
  const value = source
    .subarray(0, nul < 0 ? source.byteLength : nul)
    .toString('ascii')
    .trim();
  if (!/^[0-7]+$/u.test(value)) fail();
  const result = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(result) || result < 0) fail();
  return result;
}

function fileId(header: Buffer): string {
  const source = header.subarray(0, 100);
  const nul = source.indexOf(0);
  const value = source.subarray(0, nul < 0 ? source.byteLength : nul).toString('ascii');
  if (!SAFE_FILE_ID.test(value)) fail();
  return value;
}

function checksumValid(header: Buffer): boolean {
  const expected = octal(header, 148, 8);
  let actual = 0;
  for (let index = 0; index < header.byteLength; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index]!;
  }
  return actual === expected;
}

function entryKind(file: string): LocalWhisperRuntimeIdentity['expectedFiles'][number]['kind'] {
  if (file === 'worker') return 'executable';
  if (file.startsWith('runtime-')) return 'library';
  if (file.includes('license') || file === 'cuda-eula') return 'license';
  if (file === 'third-party-notices') return 'notice';
  return 'data';
}

function provenance(bytes: Buffer): Readonly<{
  readonly profileId: PerformanceRuntimeArchiveEvidence['profileId'];
  readonly runtimeBuildDigest: string;
}> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    fail();
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('schemaId' in value) ||
    value.schemaId !== 'local-whisper-whisper-cpp-provenance-v1' ||
    !('profileId' in value) ||
    (value.profileId !== 'linux-x64-cpu-baseline-v1' && value.profileId !== 'linux-x64-cuda-12.8.1-sm120a-v1') ||
    !('runtimeBuildDigest' in value) ||
    typeof value.runtimeBuildDigest !== 'string' ||
    !SHA256.test(value.runtimeBuildDigest)
  ) {
    fail();
  }
  return Object.freeze({ profileId: value.profileId, runtimeBuildDigest: value.runtimeBuildDigest });
}

class AsyncChunkReader {
  private readonly iterator: AsyncIterator<Buffer>;
  private chunk = Buffer.alloc(0);
  private offset = 0;
  private ended = false;

  public constructor(source: AsyncIterable<Buffer | string>) {
    this.iterator = (async function* () {
      for await (const value of source) yield Buffer.from(value);
    })()[Symbol.asyncIterator]();
  }

  public async exact(size: number): Promise<Buffer> {
    const output = Buffer.allocUnsafe(size);
    let written = 0;
    await this.consume(size, (bytes) => {
      bytes.copy(output, written);
      written += bytes.byteLength;
    });
    return output;
  }

  public async consume(size: number, accept: (bytes: Buffer) => void): Promise<void> {
    let remaining = size;
    while (remaining > 0) {
      await this.ensureChunk();
      if (this.ended) fail();
      const count = Math.min(remaining, this.chunk.byteLength - this.offset);
      const bytes = this.chunk.subarray(this.offset, this.offset + count);
      accept(bytes);
      this.offset += count;
      remaining -= count;
    }
  }

  public async atEnd(): Promise<boolean> {
    await this.ensureChunk();
    return this.ended;
  }

  private async ensureChunk(): Promise<void> {
    while (!this.ended && this.offset >= this.chunk.byteLength) {
      const next = await this.iterator.next();
      if (next.done) {
        this.ended = true;
        this.chunk = Buffer.alloc(0);
        this.offset = 0;
      } else {
        this.chunk = Buffer.from(next.value);
        this.offset = 0;
      }
    }
  }
}

/** Authenticates the bounded restricted-ustar runtime closure without extracting it. */
export class PerformanceRuntimeArchiveInspector {
  public async inspect(archivePath: string): Promise<PerformanceRuntimeArchiveEvidence> {
    const stream = createReadStream(archivePath, { highWaterMark: 1024 * 1024 });
    const gunzip = createGunzip();
    stream.pipe(gunzip);
    const reader = new AsyncChunkReader(gunzip);
    const expectedFiles: LocalWhisperRuntimeIdentity['expectedFiles'][number][] = [];
    const seen = new Set<string>();
    let provenanceEvidence: ReturnType<typeof provenance> | null = null;
    let expandedBytes = 0;
    let zeroBlocks = 0;
    try {
      while (zeroBlocks < 2) {
        const header = await reader.exact(TAR_BLOCK_BYTES);
        if (header.every((value) => value === 0)) {
          zeroBlocks += 1;
          continue;
        }
        if (zeroBlocks !== 0 || header[156] !== 0x30 || !checksumValid(header)) fail();
        const idText = fileId(header);
        if (seen.has(idText) || expectedFiles.length >= MAXIMUM_ENTRY_COUNT) fail();
        const id = toLocalWhisperArtifactId(idText);
        const mode = octal(header, 100, 8);
        const sizeBytes = octal(header, 124, 12);
        if (!id || mode > 0o777 || sizeBytes < 1 || expandedBytes + sizeBytes > MAXIMUM_EXPANDED_BYTES) fail();
        const digest = createHash('sha256');
        const provenanceChunks: Buffer[] = [];
        if (idText === 'provenance' && sizeBytes > MAXIMUM_PROVENANCE_BYTES) fail();
        await reader.consume(sizeBytes, (bytes) => {
          digest.update(bytes);
          if (idText === 'provenance') provenanceChunks.push(Buffer.from(bytes));
        });
        if (idText === 'provenance') {
          if (provenanceEvidence) fail();
          provenanceEvidence = provenance(Buffer.concat(provenanceChunks));
        }
        const padding = (TAR_BLOCK_BYTES - (sizeBytes % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
        if (padding > 0 && !(await reader.exact(padding)).every((value) => value === 0)) fail();
        expandedBytes += sizeBytes;
        seen.add(idText);
        expectedFiles.push(
          Object.freeze({
            fileId: id,
            kind: entryKind(idText),
            mode,
            sizeBytes,
            sha256: digest.digest('hex'),
          }),
        );
      }
      if (!(await reader.atEnd()) || expectedFiles.length === 0 || !provenanceEvidence) fail();
      const workers = expectedFiles.filter(({ fileId: id, kind }) => id === 'worker' && kind === 'executable');
      if (workers.length !== 1) fail();
      return Object.freeze({
        expectedFiles: Object.freeze(expectedFiles),
        workerSha256: workers[0]!.sha256,
        profileId: provenanceEvidence.profileId,
        runtimeBuildDigest: provenanceEvidence.runtimeBuildDigest,
      });
    } catch (error) {
      if (error instanceof PerformanceRuntimeArchiveError) throw error;
      fail();
    } finally {
      stream.destroy();
      gunzip.destroy();
    }
  }
}
