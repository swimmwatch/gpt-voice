import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, lstat, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { isRecord, isSafeRelativePath, isSha256 } from '../packaging/contracts';
import { readCanonicalJson, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';

const TAR_RECORD_BYTES = 512;
const STREAM_CHUNK_BYTES = 1024 * 1024;
const SAFE_FILE_ID = /^[\dA-Za-z][\w.-]{0,99}$/u;

export interface QualificationRuntimeArchiveEntry {
  readonly fileId: string;
  readonly kind: 'data' | 'executable' | 'library' | 'license' | 'notice';
  readonly mode: number;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly sourcePath: string;
}

export interface QualificationRuntimePackRecord {
  readonly schemaVersion: 1;
  readonly profileId: string;
  readonly transferProfile: 'restricted-tar-gzip-v1';
  readonly archive: {
    readonly file: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly signatureInputSha256: string;
  };
  readonly expectedFiles: readonly Omit<QualificationRuntimeArchiveEntry, 'sourcePath'>[];
  readonly evidence: {
    readonly runtimeManifestSha256: string;
    readonly provenanceSha256: string;
    readonly sbomSha256: string;
    readonly noticesSha256: string;
  };
}

interface StagedExpectedFile {
  readonly id: string;
  readonly relativePath: string;
  readonly mode: number;
  readonly sizeBytes: number;
  readonly sha256: string;
}

function octalField(value: number, width: number): Buffer {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Unsafe Local Whisper ustar numeric field');
  const digits = value.toString(8).padStart(width - 1, '0');
  if (digits.length !== width - 1) throw new Error('Local Whisper ustar numeric field overflow');
  return Buffer.from(`${digits}\0`, 'ascii');
}

function ustarHeader(entry: QualificationRuntimeArchiveEntry): Buffer {
  const header = Buffer.alloc(TAR_RECORD_BYTES);
  header.write(entry.fileId, 0, 100, 'ascii');
  octalField(entry.mode, 8).copy(header, 100);
  octalField(0, 8).copy(header, 108);
  octalField(0, 8).copy(header, 116);
  octalField(entry.sizeBytes, 12).copy(header, 124);
  octalField(0, 12).copy(header, 136);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write('ustar\0', 257, 6, 'latin1');
  header.write('00', 263, 2, 'ascii');
  octalField(0, 8).copy(header, 329);
  octalField(0, 8).copy(header, 337);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  const checksumDigits = checksum.toString(8).padStart(6, '0');
  if (checksumDigits.length !== 6) throw new Error('Local Whisper ustar checksum overflow');
  header.write(`${checksumDigits}\0 `, 148, 8, 'latin1');
  return header;
}

function entryKind(relativePath: string): QualificationRuntimeArchiveEntry['kind'] {
  if (relativePath.startsWith('bin/')) return 'executable';
  if (relativePath.startsWith('lib/')) return 'library';
  if (relativePath.startsWith('licenses/')) return 'license';
  if (relativePath === 'THIRD_PARTY_NOTICES.md') return 'notice';
  return 'data';
}

function parseExpectedFile(value: unknown): StagedExpectedFile {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 5 ||
    !SAFE_FILE_ID.test(String(value.id)) ||
    !isSafeRelativePath(value.relativePath) ||
    !Number.isSafeInteger(value.mode) ||
    (value.mode as number) < 0 ||
    (value.mode as number) > 0o777 ||
    !Number.isSafeInteger(value.sizeBytes) ||
    (value.sizeBytes as number) <= 0 ||
    !isSha256(value.sha256)
  ) {
    throw new Error('Invalid staged Local Whisper runtime expected-file record');
  }
  return value as unknown as StagedExpectedFile;
}

async function runtimeEntries(stageRoot: string): Promise<readonly QualificationRuntimeArchiveEntry[]> {
  const expectedDocument = await readCanonicalJson(path.join(stageRoot, 'expected-files.json'));
  if (
    !isRecord(expectedDocument) ||
    Object.keys(expectedDocument).length !== 2 ||
    expectedDocument.schemaId !== 'local-whisper-expected-files-v1' ||
    !Array.isArray(expectedDocument.files) ||
    expectedDocument.files.length === 0
  ) {
    throw new Error('Invalid staged Local Whisper runtime file manifest');
  }
  const records = expectedDocument.files.map(parseExpectedFile);
  if (new Set(records.map(({ id }) => id)).size !== records.length) {
    throw new Error('Duplicate Local Whisper runtime archive file identity');
  }
  const entries: QualificationRuntimeArchiveEntry[] = [];
  for (const record of records) {
    const sourcePath = path.resolve(stageRoot, ...record.relativePath.split('/'));
    const relative = path.relative(path.resolve(stageRoot), sourcePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Local Whisper runtime source path escaped its stage root');
    }
    const metadata = await lstat(sourcePath);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size !== record.sizeBytes ||
      (metadata.mode & 0o777) !== record.mode ||
      (await sha256File(sourcePath)) !== record.sha256
    ) {
      throw new Error(`Staged Local Whisper runtime identity mismatch: ${record.id}`);
    }
    entries.push({
      fileId: record.id,
      kind: entryKind(record.relativePath),
      mode: record.mode,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      sourcePath,
    });
  }
  return entries;
}

async function* tarBytes(entries: readonly QualificationRuntimeArchiveEntry[]): AsyncIterable<Buffer> {
  for (const entry of entries) {
    yield ustarHeader(entry);
    for await (const chunk of createReadStream(entry.sourcePath, { highWaterMark: STREAM_CHUNK_BYTES })) {
      yield chunk as Buffer;
    }
    const padding = (TAR_RECORD_BYTES - (entry.sizeBytes % TAR_RECORD_BYTES)) % TAR_RECORD_BYTES;
    if (padding > 0) yield Buffer.alloc(padding);
  }
  yield Buffer.alloc(TAR_RECORD_BYTES * 2);
}

async function requireEmptyOutput(outputDirectory: string): Promise<void> {
  await mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
}

/** Produces one deterministic restricted-ustar/single-gzip runtime archive from an authenticated stage. */
export class DeterministicRuntimePackProducer {
  public async produce(input: {
    readonly stageRoot: string;
    readonly outputDirectory: string;
    readonly profileId: string;
  }): Promise<QualificationRuntimePackRecord> {
    const stageRoot = path.resolve(input.stageRoot);
    const outputDirectory = path.resolve(input.outputDirectory);
    await requireEmptyOutput(outputDirectory);
    const entries = await runtimeEntries(stageRoot);
    const archiveFile = `${input.profileId}.tar.gz`;
    const archivePath = path.join(outputDirectory, archiveFile);
    await pipeline(
      Readable.from(tarBytes(entries)),
      createGzip({ level: 9 }),
      createWriteStream(archivePath, { flags: 'wx', mode: 0o600 }),
    );
    const archiveIdentity = await lstat(archivePath);
    if (!archiveIdentity.isFile() || archiveIdentity.size <= 18) {
      throw new Error('Local Whisper runtime archive production failed');
    }
    const archiveSha256 = await sha256File(archivePath);
    const record: QualificationRuntimePackRecord = {
      schemaVersion: 1,
      profileId: input.profileId,
      transferProfile: 'restricted-tar-gzip-v1',
      archive: {
        file: archiveFile,
        sizeBytes: archiveIdentity.size,
        sha256: archiveSha256,
        signatureInputSha256: archiveSha256,
      },
      expectedFiles: entries.map(({ sourcePath: _sourcePath, ...entry }) => entry),
      evidence: {
        runtimeManifestSha256: await sha256File(path.join(stageRoot, 'runtime-manifest.json')),
        provenanceSha256: await sha256File(path.join(stageRoot, 'provenance.json')),
        sbomSha256: await sha256File(path.join(stageRoot, 'sbom.spdx.json')),
        noticesSha256: await sha256File(path.join(stageRoot, 'THIRD_PARTY_NOTICES.md')),
      },
    };
    await writeCanonicalJson(path.join(outputDirectory, 'runtime-pack.json'), record);
    return Object.freeze(record);
  }
}

export async function assertReproducibleRuntimePacks(
  left: QualificationRuntimePackRecord,
  right: QualificationRuntimePackRecord,
  leftDirectory: string,
  rightDirectory: string,
): Promise<void> {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error('Local Whisper runtime pack records are not reproducible');
  }
  const [leftArchive, rightArchive] = await Promise.all([
    readFile(path.join(leftDirectory, left.archive.file)),
    readFile(path.join(rightDirectory, right.archive.file)),
  ]);
  if (!leftArchive.equals(rightArchive)) throw new Error('Local Whisper runtime archive bytes are not reproducible');
}
