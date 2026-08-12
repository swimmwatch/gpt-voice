import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { type Stats } from 'node:fs';
import { chmod, lstat, mkdir, open, readdir, rmdir, stat, unlink, type FileHandle } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createInflateRaw } from 'node:zlib';

import {
  ARTIFACT_MAX_BUFFER_BYTES,
  LocalWhisperArtifactLifecycleError,
  type ArtifactStreamingWorker,
  type ArtifactWorkerProcessInput,
  type ArtifactWorkerProcessResult,
  type StreamingArtifactEntry,
} from './ArtifactLifecycleTypes';

const GZIP_HEADER_BYTES = 10;
const GZIP_TRAILER_BYTES = 8;
const TAR_RECORD_BYTES = 512;
const TAR_TERMINATOR_BYTES = TAR_RECORD_BYTES * 2;
const STREAM_CHUNK_BYTES = 64 * 1024;
const SAFE_SPOOL_ID_PATTERN = /^[\w-]{16,128}$/u;
const SAFE_ENTRY_FILE_PATTERN = /^entry-\d{1,6}$/u;
const ZERO_RECORD = Buffer.alloc(TAR_RECORD_BYTES);

const CRC32_TABLE = Object.freeze(
  Array.from({ length: 256 }, (_unused, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  }),
);

function isSameFileIdentity(left: Stats, right: Stats): boolean {
  if (left.dev !== 0 && left.ino !== 0 && right.dev !== 0 && right.ino !== 0) {
    return left.dev === right.dev && left.ino === right.ino;
  }
  return left.size === right.size && left.ctimeMs === right.ctimeMs && left.mtimeMs === right.mtimeMs;
}

class Crc32 {
  private value = 0xffffffff;

  public update(bytes: Uint8Array): void {
    for (const byte of bytes) this.value = CRC32_TABLE[(this.value ^ byte) & 0xff]! ^ (this.value >>> 8);
  }

  public digest(): number {
    return (this.value ^ 0xffffffff) >>> 0;
  }
}

class BoundedAsyncReader {
  private chunk: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private offset = 0;
  private done = false;
  private totalBytesValue = 0;
  private peakBufferedBytesValue = 0;
  private readonly iterator: AsyncIterator<Uint8Array>;

  public constructor(
    source: AsyncIterable<Uint8Array>,
    private readonly maximumBytes: number,
    private readonly onBytes: (bytes: Uint8Array) => void,
    private readonly signal: AbortSignal,
  ) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  public get totalBytes(): number {
    return this.totalBytesValue;
  }

  public get peakBufferedBytes(): number {
    return this.peakBufferedBytesValue;
  }

  public async readExact(byteLength: number): Promise<Buffer> {
    const output = Buffer.allocUnsafe(byteLength);
    let written = 0;
    while (written < byteLength) {
      const part = await this.take(Math.min(byteLength - written, STREAM_CHUNK_BYTES));
      if (part.byteLength === 0) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      part.copy(output, written);
      written += part.byteLength;
    }
    return output;
  }

  public async copyExact(
    byteLength: number,
    destination: FileHandle,
    digest: ReturnType<typeof createHash>,
  ): Promise<void> {
    let remaining = byteLength;
    while (remaining > 0) {
      const part = await this.take(Math.min(remaining, STREAM_CHUNK_BYTES));
      if (part.byteLength === 0) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      await destination.write(part);
      digest.update(part);
      remaining -= part.byteLength;
    }
  }

  public async assertEnd(): Promise<void> {
    if ((await this.take(1)).byteLength !== 0) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }

  private async take(maximum: number): Promise<Buffer> {
    if (this.signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
    if (this.offset >= this.chunk.byteLength) await this.pull();
    if (this.offset >= this.chunk.byteLength) return Buffer.alloc(0);
    const end = Math.min(this.chunk.byteLength, this.offset + maximum);
    const value = this.chunk.subarray(this.offset, end);
    this.offset = end;
    return value;
  }

  private async pull(): Promise<void> {
    if (this.done) return;
    const next = await this.iterator.next();
    if (next.done) {
      this.done = true;
      this.chunk = Buffer.alloc(0);
      this.offset = 0;
      return;
    }
    if (!(next.value instanceof Uint8Array) || next.value.byteLength > ARTIFACT_MAX_BUFFER_BYTES) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    this.chunk = Buffer.from(next.value.buffer, next.value.byteOffset, next.value.byteLength);
    this.offset = 0;
    this.totalBytesValue += this.chunk.byteLength;
    if (!Number.isSafeInteger(this.totalBytesValue) || this.totalBytesValue > this.maximumBytes) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    this.peakBufferedBytesValue = Math.max(this.peakBufferedBytesValue, this.chunk.byteLength);
    this.onBytes(this.chunk);
  }
}

function safeTotalTarBytes(files: readonly { readonly sizeBytes: number }[]): number {
  let total = TAR_TERMINATOR_BYTES;
  for (const file of files) {
    const padded = Math.ceil(file.sizeBytes / TAR_RECORD_BYTES) * TAR_RECORD_BYTES;
    total += TAR_RECORD_BYTES + padded;
    if (!Number.isSafeInteger(total)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return total;
}

function allZero(bytes: Uint8Array): boolean {
  return bytes.every((byte) => byte === 0);
}

function parseCanonicalOctal(field: Buffer): number {
  if (field.byteLength < 2 || field[field.byteLength - 1] !== 0) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  const digits = field.subarray(0, -1).toString('ascii');
  if (!/^[0-7]+$/u.test(digits)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  const value = Number.parseInt(digits, 8);
  if (!Number.isSafeInteger(value)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  return value;
}

function parseCanonicalName(field: Buffer): string {
  const terminator = field.indexOf(0);
  if (terminator <= 0 || !allZero(field.subarray(terminator))) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  const value = field.subarray(0, terminator);
  if (value.byteLength > 100 || value.some((byte) => byte < 0x21 || byte > 0x7e || byte === 0x2f || byte === 0x5c)) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return value.toString('ascii');
}

function parseChecksum(field: Buffer): number {
  if (!/^[0-7]{6}\0 $/u.test(field.toString('latin1'))) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return Number.parseInt(field.subarray(0, 6).toString('ascii'), 8);
}

function validateTarHeader(header: Buffer, expected: ArtifactWorkerProcessInput['expectedFiles'][number]): void {
  if (header.byteLength !== TAR_RECORD_BYTES || allZero(header)) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  const checksum = parseChecksum(header.subarray(148, 156));
  const checksumBytes = Buffer.from(header);
  checksumBytes.fill(0x20, 148, 156);
  const calculated = checksumBytes.reduce((sum, byte) => sum + byte, 0);
  const typeFlag = header[156];
  if (
    calculated !== checksum ||
    parseCanonicalName(header.subarray(0, 100)) !== expected.fileId ||
    parseCanonicalOctal(header.subarray(100, 108)) !== expected.mode ||
    parseCanonicalOctal(header.subarray(108, 116)) !== 0 ||
    parseCanonicalOctal(header.subarray(116, 124)) !== 0 ||
    parseCanonicalOctal(header.subarray(124, 136)) !== expected.sizeBytes ||
    parseCanonicalOctal(header.subarray(136, 148)) !== 0 ||
    (typeFlag !== 0 && typeFlag !== 0x30) ||
    !allZero(header.subarray(157, 257)) ||
    header.subarray(257, 263).toString('latin1') !== 'ustar\0' ||
    header.subarray(263, 265).toString('ascii') !== '00' ||
    !allZero(header.subarray(265, 329)) ||
    parseCanonicalOctal(header.subarray(329, 337)) !== 0 ||
    parseCanonicalOctal(header.subarray(337, 345)) !== 0 ||
    !allZero(header.subarray(345, 512))
  ) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
}

function assertGzipHeader(header: Buffer): void {
  if (
    header.byteLength !== GZIP_HEADER_BYTES ||
    header[0] !== 0x1f ||
    header[1] !== 0x8b ||
    header[2] !== 8 ||
    header[3] !== 0 ||
    header.readUInt32LE(4) !== 0
  ) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
}

function safeSpoolPath(root: string, spoolId: string): string {
  if (!SAFE_SPOOL_ID_PATTERN.test(spoolId)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  const candidate = resolve(root, `spool-${spoolId}.partial`);
  if (!candidate.startsWith(`${resolve(root)}${sep}`)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  return candidate;
}

/** Disk-backed bounded materializer for the two authenticated release-1 transfer profiles. */
export class FileBackedArtifactStreamingWorker implements ArtifactStreamingWorker {
  private readonly active = new Map<string, AbortController>();

  public constructor(private readonly spoolRoot: string) {}

  public async process(input: ArtifactWorkerProcessInput): Promise<ArtifactWorkerProcessResult> {
    if (this.active.has(input.operationId)) throw new LocalWhisperArtifactLifecycleError('OPERATION_CONFLICT');
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    input.signal.addEventListener('abort', abort, { once: true });
    if (input.signal.aborted) controller.abort();
    this.active.set(input.operationId, controller);
    const spoolId = input.resume?.spoolId ?? input.operationId;
    const spoolPath = safeSpoolPath(this.spoolRoot, spoolId);
    try {
      await mkdir(this.spoolRoot, { recursive: true, mode: 0o700 });
      await chmod(this.spoolRoot, 0o700);
      const { digest, peakBufferedBytes, receivedBytes } = await this.receive(input, spoolPath, controller.signal);
      const entries =
        input.transferProfile === 'pinned-raw-model-v1'
          ? this.rawModelEntry(input, spoolPath, controller.signal)
          : await this.runtimeEntries(input, spoolPath, controller.signal);
      return Object.freeze({ entries, peakBufferedBytes, receivedBytes, spoolId, transferSha256: digest });
    } finally {
      input.signal.removeEventListener('abort', abort);
      this.active.delete(input.operationId);
    }
  }

  public async cancel(operationId: string): Promise<void> {
    this.active.get(operationId)?.abort();
  }

  public async terminate(operationId: string): Promise<void> {
    this.active.get(operationId)?.abort();
  }

  public async discard(spoolId: string): Promise<void> {
    const spoolPath = safeSpoolPath(this.spoolRoot, spoolId);
    const entriesRoot = `${spoolPath}.entries`;
    await unlink(spoolPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    let entries: readonly string[] = [];
    try {
      entries = await readdir(entriesRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    for (const entry of entries) {
      if (!SAFE_ENTRY_FILE_PATTERN.test(entry)) throw new LocalWhisperArtifactLifecycleError('CLEANUP_FAILED');
      await unlink(resolve(entriesRoot, entry));
    }
    await rmdir(entriesRoot).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private async receive(
    input: ArtifactWorkerProcessInput,
    spoolPath: string,
    signal: AbortSignal,
  ): Promise<{ readonly digest: string; readonly peakBufferedBytes: number; readonly receivedBytes: number }> {
    const hash = createHash('sha256');
    let received = input.resume?.offset ?? 0;
    if (input.resume) await this.hashExistingPrefix(spoolPath, received, hash, signal);
    const handle = await open(spoolPath, input.resume ? 'r+' : 'wx', 0o600);
    let peakBufferedBytes = 0;
    try {
      if (input.resume) await handle.truncate(received);
      for await (const chunk of input.stream) {
        if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
        if (!(chunk instanceof Uint8Array) || chunk.byteLength > ARTIFACT_MAX_BUFFER_BYTES) {
          throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
        }
        const next = received + chunk.byteLength;
        if (!Number.isSafeInteger(next) || next > input.expectedTransferSizeBytes) {
          throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_FAILED');
        }
        await handle.write(chunk, 0, chunk.byteLength, received);
        hash.update(chunk);
        received = next;
        peakBufferedBytes = Math.max(peakBufferedBytes, chunk.byteLength);
        await input.onProgress(received);
      }
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ digest: hash.digest('hex'), peakBufferedBytes, receivedBytes: received });
  }

  private async hashExistingPrefix(
    spoolPath: string,
    expectedBytes: number,
    hash: ReturnType<typeof createHash>,
    signal: AbortSignal,
  ): Promise<void> {
    const identity = await stat(spoolPath);
    if (!identity.isFile() || identity.size !== expectedBytes) {
      throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
    }
    let observed = 0;
    for await (const chunk of createReadStream(spoolPath, { highWaterMark: STREAM_CHUNK_BYTES })) {
      if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      observed += chunk.byteLength;
      hash.update(chunk);
    }
    if (observed !== expectedBytes) throw new LocalWhisperArtifactLifecycleError('RESUME_INVALID');
  }

  private rawModelEntry(
    input: ArtifactWorkerProcessInput,
    spoolPath: string,
    signal: AbortSignal,
  ): readonly StreamingArtifactEntry[] {
    const expected = input.expectedFiles[0];
    if (
      input.expectedFiles.length !== 1 ||
      !expected ||
      expected.sizeBytes !== input.expectedTransferSizeBytes ||
      expected.sha256 !== input.expectedTransferSha256
    ) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    return Object.freeze([
      Object.freeze({
        chunks: this.fileChunks(spoolPath, signal),
        mode: expected.mode,
        name: expected.fileId,
        sha256: expected.sha256,
        sizeBytes: expected.sizeBytes,
        type: 'regular' as const,
      }),
    ]);
  }

  private async runtimeEntries(
    input: ArtifactWorkerProcessInput,
    spoolPath: string,
    signal: AbortSignal,
  ): Promise<readonly StreamingArtifactEntry[]> {
    const source = await open(spoolPath, 'r');
    const header = Buffer.alloc(GZIP_HEADER_BYTES);
    const trailer = Buffer.alloc(GZIP_TRAILER_BYTES);
    try {
      const [identity, linked] = await Promise.all([source.stat(), lstat(spoolPath)]);
      if (
        !identity.isFile() ||
        !linked.isFile() ||
        linked.isSymbolicLink() ||
        !isSameFileIdentity(identity, linked) ||
        identity.size !== input.expectedTransferSizeBytes ||
        identity.size < 18
      ) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      if ((await source.read(header, 0, header.byteLength, 0)).bytesRead !== header.byteLength) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      if (
        (await source.read(trailer, 0, trailer.byteLength, identity.size - trailer.byteLength)).bytesRead !==
        trailer.byteLength
      ) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      assertGzipHeader(header);
      const compressedLength = identity.size - GZIP_HEADER_BYTES - GZIP_TRAILER_BYTES;
      const inflater = createInflateRaw();
      const compressed = createReadStream(spoolPath, {
        autoClose: false,
        fd: source.fd,
        start: GZIP_HEADER_BYTES,
        end: identity.size - GZIP_TRAILER_BYTES - 1,
        highWaterMark: STREAM_CHUNK_BYTES,
      });
      compressed.on('error', (error) => inflater.destroy(error));
      compressed.pipe(inflater);
      const crc = new Crc32();
      const maximumTarBytes = safeTotalTarBytes(input.expectedFiles);
      const reader = new BoundedAsyncReader(inflater, maximumTarBytes, (bytes) => crc.update(bytes), signal);
      const entriesRoot = `${spoolPath}.entries`;
      await mkdir(entriesRoot, { mode: 0o700 });
      const entries: StreamingArtifactEntry[] = [];
      for (const [index, expected] of input.expectedFiles.entries()) {
        validateTarHeader(await reader.readExact(TAR_RECORD_BYTES), expected);
        const entryPath = resolve(entriesRoot, `entry-${index}`);
        const destination = await open(entryPath, 'wx', 0o600);
        const hash = createHash('sha256');
        try {
          await reader.copyExact(expected.sizeBytes, destination, hash);
          await destination.sync();
        } finally {
          await destination.close();
        }
        if (hash.digest('hex') !== expected.sha256) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
        const padding = (TAR_RECORD_BYTES - (expected.sizeBytes % TAR_RECORD_BYTES)) % TAR_RECORD_BYTES;
        if (padding > 0 && !allZero(await reader.readExact(padding))) {
          throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
        }
        entries.push(
          Object.freeze({
            chunks: this.fileChunks(entryPath, signal),
            mode: expected.mode,
            name: expected.fileId,
            sha256: expected.sha256,
            sizeBytes: expected.sizeBytes,
            type: 'regular' as const,
          }),
        );
      }
      if (!allZero(await reader.readExact(TAR_RECORD_BYTES)) || !allZero(await reader.readExact(TAR_RECORD_BYTES))) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      await reader.assertEnd();
      if (
        reader.totalBytes !== maximumTarBytes ||
        inflater.bytesWritten !== compressedLength ||
        trailer.readUInt32LE(0) !== crc.digest() ||
        trailer.readUInt32LE(4) !== reader.totalBytes % 0x1_0000_0000
      ) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      const completed = await source.stat();
      if (
        completed.size !== identity.size ||
        completed.ctimeMs !== identity.ctimeMs ||
        completed.mtimeMs !== identity.mtimeMs
      ) {
        throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
      }
      return Object.freeze(entries);
    } finally {
      await source.close();
    }
  }

  private async *fileChunks(filePath: string, signal: AbortSignal): AsyncIterable<Uint8Array> {
    for await (const chunk of createReadStream(filePath, { highWaterMark: STREAM_CHUNK_BYTES })) {
      if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      yield Uint8Array.from(chunk);
    }
  }
}
