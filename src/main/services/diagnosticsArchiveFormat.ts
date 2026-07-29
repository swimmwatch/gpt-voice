/* eslint-disable max-classes-per-file -- the abstract factory and concrete archiver adapter form one boundary. */
import type * as fs from 'node:fs';
import { finished } from 'node:stream/promises';
import { deflateRawSync, gunzipSync, inflateRawSync } from 'node:zlib';
import { TarArchive, ZipArchive, type Archiver } from 'archiver';

import {
  DIAGNOSTICS_ARCHIVE_LIMITS,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  isDiagnosticsArchiveOuterByteLengthWithinLimit,
  isDiagnosticsArchiveStructureByteLengthWithinLimit,
  type DiagnosticsArchiveFormat,
} from '@shared/diagnosticsArchive';

const ARCHIVE_ENTRY_TIMESTAMP = '1980-01-01T00:00:00.000Z';
const ARCHIVE_ENTRY_MODE = 0o100600;
const PRIVATE_FILE_MODE = 0o600;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_MINIMUM_END_RECORD_BYTES = 22;
const ZIP_MAXIMUM_COMMENT_BYTES = 0xffff;
const ZIP_COMPRESSION_STORED = 0;
const ZIP_COMPRESSION_DEFLATE = 8;
const ZIP_ENCRYPTED_FLAG = 0x1;
const TAR_BLOCK_BYTES = 512;
const TAR_NAME_BYTES = 100;
const TAR_PREFIX_OFFSET = 345;
const TAR_PREFIX_BYTES = 155;
const TAR_TYPE_OFFSET = 156;
const TAR_SIZE_OFFSET = 124;
const TAR_SIZE_BYTES = 12;

export interface DiagnosticsArchiveMember {
  readonly name: string;
  readonly payload: Buffer;
}

export interface DiagnosticsArchiveWriter {
  abort(): unknown;
  append(
    source: Buffer,
    data: { readonly date: Date; readonly mode: number; readonly name: string; readonly type: 'file' },
  ): unknown;
  finalize(): Promise<void>;
  on(event: 'error' | 'warning', listener: (error: Error) => void): this;
  pipe(destination: fs.WriteStream): fs.WriteStream;
}

/** Constructs one approved archive writer without exposing the dependency outside the adapter. */
export abstract class DiagnosticsArchiveWriterFactory {
  public abstract create(format: DiagnosticsArchiveFormat): DiagnosticsArchiveWriter;
}

/** Binds the approved creation-only archiver dependency behind a closed factory. */
export class ArchiverDiagnosticsArchiveWriterFactory extends DiagnosticsArchiveWriterFactory {
  public create(format: DiagnosticsArchiveFormat): DiagnosticsArchiveWriter {
    const archive: Archiver =
      format === 'zip'
        ? new ZipArchive({ zlib: { level: 9 } })
        : new TarArchive({ gzip: true, gzipOptions: { level: 9 } });
    return archive;
  }
}

export interface DiagnosticsArchiveFormatFileSystem {
  chmod(filePath: string, mode: number): Promise<void>;
  createWriteStream(filePath: string, options: { readonly flags: 'wx'; readonly mode: number }): fs.WriteStream;
  readFile(filePath: string): Promise<Buffer>;
}

export interface DiagnosticsArchiveFormatAdapterDependencies {
  readonly fileSystem: DiagnosticsArchiveFormatFileSystem;
  readonly platform: NodeJS.Platform;
  readonly writerFactory: DiagnosticsArchiveWriterFactory;
}

/** Writes fixed in-memory members and verifies the completed outer archive before publication. */
export class DiagnosticsArchiveFormatAdapter {
  public constructor(private readonly dependencies: DiagnosticsArchiveFormatAdapterDependencies) {}

  public async writeAndVerify(
    format: DiagnosticsArchiveFormat,
    outputPath: string,
    members: readonly DiagnosticsArchiveMember[],
  ): Promise<void> {
    let output: fs.WriteStream | null = null;
    let archive: DiagnosticsArchiveWriter | null = null;
    try {
      this.validateMembers(members);
      output = this.dependencies.fileSystem.createWriteStream(outputPath, {
        flags: 'wx',
        mode: PRIVATE_FILE_MODE,
      });
      archive = this.dependencies.writerFactory.create(format);
      const writerFailure = new Promise<never>((_resolve, reject) => {
        archive?.on('error', reject);
        archive?.on('warning', reject);
      });
      archive.pipe(output);
      for (const member of members) {
        archive.append(member.payload, {
          date: new Date(ARCHIVE_ENTRY_TIMESTAMP),
          mode: ARCHIVE_ENTRY_MODE,
          name: member.name,
          type: 'file',
        });
      }
      await Promise.race([Promise.all([archive.finalize(), finished(output)]), writerFailure]);
      if (this.dependencies.platform !== 'win32') {
        await this.dependencies.fileSystem.chmod(outputPath, PRIVATE_FILE_MODE);
      }
      const archiveBytes = await this.dependencies.fileSystem.readFile(outputPath);
      this.verify(format, archiveBytes, members);
    } catch {
      try {
        archive?.abort();
      } catch {
        // The owning archive service removes the private sibling output.
      }
      output?.destroy();
      if (output) {
        try {
          await finished(output);
        } catch {
          // Stream failure is normalized at this archive-format boundary.
        }
      }
      throw new Error('Diagnostics archive creation failed');
    }
  }

  public verify(
    format: DiagnosticsArchiveFormat,
    archiveBytes: Buffer,
    expectedMembers: readonly DiagnosticsArchiveMember[],
  ): void {
    const actualMembers = inspectDiagnosticsArchiveForVerification(format, archiveBytes);
    if (actualMembers.size !== expectedMembers.length) throw new Error('Unexpected diagnostics member count');
    for (const expected of expectedMembers) {
      const actual = actualMembers.get(expected.name);
      if (!actual || !actual.equals(expected.payload)) throw new Error('Diagnostics member verification failed');
    }
  }

  private validateMembers(members: readonly DiagnosticsArchiveMember[]): void {
    const expectedNames = [
      DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest,
      DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
      ...(members.length === 3 ? [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions] : []),
    ];
    if (
      members.length < 2 ||
      members.length > 3 ||
      !members.every((member, index) => member.name === expectedNames[index]) ||
      new Set(members.map((member) => member.name)).size !== members.length
    ) {
      throw new TypeError('Invalid diagnostics archive members');
    }
    let totalBytes = 0;
    const compressedPayloadSizes = new Map<Buffer, number>();
    for (const member of members) {
      if (member.payload.byteLength > DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes) {
        throw new TypeError('Diagnostics archive member is too large');
      }
      if (member.payload.byteLength >= DIAGNOSTICS_ARCHIVE_LIMITS.MinCompressionRatioMemberBytes) {
        let compressedBytes = compressedPayloadSizes.get(member.payload);
        if (compressedBytes === undefined) {
          compressedBytes = deflateRawSync(member.payload, { level: 9 }).byteLength;
          compressedPayloadSizes.set(member.payload, compressedBytes);
        }
        if (member.payload.byteLength / Math.max(compressedBytes, 1) > DIAGNOSTICS_ARCHIVE_LIMITS.MaxCompressionRatio) {
          throw new TypeError('Diagnostics archive member compression ratio is too large');
        }
      }
      totalBytes += member.payload.byteLength;
    }
    if (totalBytes > DIAGNOSTICS_ARCHIVE_LIMITS.MaxTotalUncompressedBytes) {
      throw new TypeError('Diagnostics archive is too large');
    }
  }
}

interface DiagnosticsArchiveInspection {
  readonly members: ReadonlyMap<string, Buffer>;
  readonly structureBytes: number;
}

function findZipEndRecord(archiveBytes: Buffer): number {
  const minimumOffset = Math.max(0, archiveBytes.length - ZIP_MINIMUM_END_RECORD_BYTES - ZIP_MAXIMUM_COMMENT_BYTES);
  for (let offset = archiveBytes.length - ZIP_MINIMUM_END_RECORD_BYTES; offset >= minimumOffset; offset -= 1) {
    if (archiveBytes.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('Invalid ZIP signature');
}

function readZipMembers(archiveBytes: Buffer): DiagnosticsArchiveInspection {
  if (
    archiveBytes.length < ZIP_MINIMUM_END_RECORD_BYTES ||
    archiveBytes.readUInt32LE(0) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE
  ) {
    throw new Error('Invalid ZIP archive');
  }
  const endOffset = findZipEndRecord(archiveBytes);
  const diskNumber = archiveBytes.readUInt16LE(endOffset + 4);
  const centralDisk = archiveBytes.readUInt16LE(endOffset + 6);
  const diskEntries = archiveBytes.readUInt16LE(endOffset + 8);
  const totalEntries = archiveBytes.readUInt16LE(endOffset + 10);
  const centralSize = archiveBytes.readUInt32LE(endOffset + 12);
  const centralOffset = archiveBytes.readUInt32LE(endOffset + 16);
  const commentLength = archiveBytes.readUInt16LE(endOffset + 20);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries > 3 ||
    centralOffset + centralSize !== endOffset ||
    endOffset + ZIP_MINIMUM_END_RECORD_BYTES + commentLength !== archiveBytes.length
  ) {
    throw new Error('Unsupported ZIP structure');
  }

  const members = new Map<string, Buffer>();
  let compressedPayloadBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (archiveBytes.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP central directory');
    }
    const flags = archiveBytes.readUInt16LE(offset + 8);
    const compressionMethod = archiveBytes.readUInt16LE(offset + 10);
    const compressedSize = archiveBytes.readUInt32LE(offset + 20);
    const uncompressedSize = archiveBytes.readUInt32LE(offset + 24);
    const nameLength = archiveBytes.readUInt16LE(offset + 28);
    const extraLength = archiveBytes.readUInt16LE(offset + 30);
    const entryCommentLength = archiveBytes.readUInt16LE(offset + 32);
    const diskStart = archiveBytes.readUInt16LE(offset + 34);
    const externalAttributes = archiveBytes.readUInt32LE(offset + 38);
    const localOffset = archiveBytes.readUInt32LE(offset + 42);
    const name = archiveBytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const unixMode = externalAttributes >>> 16;
    if (
      (flags & ZIP_ENCRYPTED_FLAG) !== 0 ||
      (compressionMethod !== ZIP_COMPRESSION_STORED && compressionMethod !== ZIP_COMPRESSION_DEFLATE) ||
      diskStart !== 0 ||
      name.length === 0 ||
      name.endsWith('/') ||
      members.has(name) ||
      (unixMode !== 0 && (unixMode & 0o170000) !== 0o100000) ||
      archiveBytes.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new Error('Unsafe ZIP member');
    }
    const localNameLength = archiveBytes.readUInt16LE(localOffset + 26);
    const localExtraLength = archiveBytes.readUInt16LE(localOffset + 28);
    const localName = archiveBytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString('utf8');
    if (localName !== name) throw new Error('Mismatched ZIP member');
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archiveBytes.subarray(dataOffset, dataOffset + compressedSize);
    const payload = compressionMethod === ZIP_COMPRESSION_STORED ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (payload.byteLength !== uncompressedSize) throw new Error('Invalid ZIP member size');
    members.set(name, payload);
    compressedPayloadBytes += compressedSize;
    offset += 46 + nameLength + extraLength + entryCommentLength;
  }
  if (offset !== endOffset) throw new Error('Invalid ZIP directory length');
  return {
    members,
    structureBytes: archiveBytes.byteLength - compressedPayloadBytes,
  };
}

function readNullTerminatedText(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString('utf8');
}

function readTarOctal(bytes: Buffer): number {
  const value = readNullTerminatedText(bytes).trim();
  if (!/^[0-7]+$/u.test(value)) throw new Error('Invalid TAR size');
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Invalid TAR size');
  return parsed;
}

function isZeroBlock(bytes: Buffer): boolean {
  return bytes.every((value) => value === 0);
}

function readTarGzipMembers(archiveBytes: Buffer): DiagnosticsArchiveInspection {
  if (archiveBytes.length < 2 || archiveBytes[0] !== 0x1f || archiveBytes[1] !== 0x8b) {
    throw new Error('Invalid gzip signature');
  }
  const tarBytes = gunzipSync(archiveBytes);
  const members = new Map<string, Buffer>();
  let payloadBytes = 0;
  let offset = 0;
  let endBlocks = 0;
  while (offset + TAR_BLOCK_BYTES <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    offset += TAR_BLOCK_BYTES;
    if (isZeroBlock(header)) {
      endBlocks += 1;
      if (endBlocks === 2) break;
      continue;
    }
    if (endBlocks > 0) throw new Error('Invalid TAR terminator');
    const namePart = readNullTerminatedText(header.subarray(0, TAR_NAME_BYTES));
    const prefix = readNullTerminatedText(header.subarray(TAR_PREFIX_OFFSET, TAR_PREFIX_OFFSET + TAR_PREFIX_BYTES));
    const name = prefix ? `${prefix}/${namePart}` : namePart;
    const type = header[TAR_TYPE_OFFSET];
    const size = readTarOctal(header.subarray(TAR_SIZE_OFFSET, TAR_SIZE_OFFSET + TAR_SIZE_BYTES));
    if ((type !== 0 && type !== 0x30) || name.length === 0 || name.endsWith('/') || members.has(name)) {
      throw new Error('Unsafe TAR member');
    }
    const payloadEnd = offset + size;
    if (payloadEnd > tarBytes.length) throw new Error('Invalid TAR member size');
    members.set(name, Buffer.from(tarBytes.subarray(offset, payloadEnd)));
    payloadBytes += size;
    offset += Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
  }
  if (endBlocks !== 2 || !isZeroBlock(tarBytes.subarray(offset))) {
    throw new Error('Invalid TAR termination');
  }
  return {
    members,
    structureBytes: tarBytes.byteLength - payloadBytes,
  };
}

/** Producer-side inspection used only to verify archives generated by this adapter. */
export function inspectDiagnosticsArchiveForVerification(
  format: DiagnosticsArchiveFormat,
  archiveBytes: Buffer,
): ReadonlyMap<string, Buffer> {
  if (!isDiagnosticsArchiveOuterByteLengthWithinLimit(archiveBytes.byteLength)) {
    throw new Error('Diagnostics outer archive is too large');
  }
  const inspection = format === 'zip' ? readZipMembers(archiveBytes) : readTarGzipMembers(archiveBytes);
  if (!isDiagnosticsArchiveStructureByteLengthWithinLimit(inspection.structureBytes)) {
    throw new Error('Diagnostics archive structure is too large');
  }
  const { members } = inspection;
  const allowedNames = new Set<string>([
    DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest,
    DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
    DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
  ]);
  if (
    members.size < 2 ||
    members.size > 3 ||
    !members.has(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest) ||
    !members.has(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents) ||
    [...members.keys()].some((name) => !allowedNames.has(name))
  ) {
    throw new Error('Unexpected diagnostics archive members');
  }
  return members;
}
