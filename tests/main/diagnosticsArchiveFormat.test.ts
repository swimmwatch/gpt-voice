import assert from 'node:assert/strict';
import { randomFillSync } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  DiagnosticsArchiveWriterFactory,
  inspectDiagnosticsArchiveForVerification,
  type DiagnosticsArchiveMember,
  type DiagnosticsArchiveWriter,
} from '@main/services/diagnosticsArchiveFormat';
import {
  DIAGNOSTICS_ARCHIVE_LIMITS,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  isDiagnosticsArchiveOuterByteLengthWithinLimit,
  isDiagnosticsArchiveStructureByteLengthWithinLimit,
} from '@shared/diagnosticsArchive';

const temporaryDirectories: string[] = [];
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const ZIP_MAXIMUM_COMMENT_BYTES = 0xffff;
const MINIMUM_INCOMPRESSIBLE_ARCHIVE_BYTES = 120 * 1024 * 1024;
const PRIVATE_FAILURE_CANARY = 'private-archive-format-failure-canary';

class ThrowingDiagnosticsArchiveWriterFactory extends DiagnosticsArchiveWriterFactory {
  public create(): DiagnosticsArchiveWriter {
    throw new Error(PRIVATE_FAILURE_CANARY);
  }
}

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-diagnostics-format-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createAdapter(platform: NodeJS.Platform): DiagnosticsArchiveFormatAdapter {
  return new DiagnosticsArchiveFormatAdapter({
    fileSystem: {
      chmod: (filePath, mode) => fs.promises.chmod(filePath, mode),
      createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
      readFile: (filePath) => fs.promises.readFile(filePath),
    },
    platform,
    writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
  });
}

function createMembers(): readonly DiagnosticsArchiveMember[] {
  return [
    {
      name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest,
      payload: Buffer.from('{"schemaVersion":1}', 'utf8'),
    },
    {
      name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
      payload: Buffer.from('{"event":"started"}\n', 'utf8'),
    },
    {
      name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
      payload: Buffer.from('{"schemaVersion":1}\n', 'utf8'),
    },
  ];
}

function findZipEndRecord(archiveBytes: Buffer): number {
  const minimumOffset = Math.max(
    0,
    archiveBytes.byteLength - ZIP_END_OF_CENTRAL_DIRECTORY_BYTES - ZIP_MAXIMUM_COMMENT_BYTES,
  );
  for (
    let offset = archiveBytes.byteLength - ZIP_END_OF_CENTRAL_DIRECTORY_BYTES;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (archiveBytes.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('ZIP end record not found');
}

function getZipStructureBytes(archiveBytes: Buffer): number {
  const endOffset = findZipEndRecord(archiveBytes);
  const entryCount = archiveBytes.readUInt16LE(endOffset + 10);
  let offset = archiveBytes.readUInt32LE(endOffset + 16);
  let compressedPayloadBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archiveBytes.readUInt32LE(offset), ZIP_CENTRAL_DIRECTORY_SIGNATURE);
    compressedPayloadBytes += archiveBytes.readUInt32LE(offset + 20);
    const nameLength = archiveBytes.readUInt16LE(offset + 28);
    const extraLength = archiveBytes.readUInt16LE(offset + 30);
    const commentLength = archiveBytes.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return archiveBytes.byteLength - compressedPayloadBytes;
}

function padZipStructure(archiveBytes: Buffer, targetStructureBytes: number): Buffer {
  const currentStructureBytes = getZipStructureBytes(archiveBytes);
  const paddingBytes = targetStructureBytes - currentStructureBytes;
  assert.ok(paddingBytes >= 0);

  const endOffset = findZipEndRecord(archiveBytes);
  const centralOffset = archiveBytes.readUInt32LE(endOffset + 16);
  const padded = Buffer.concat([
    archiveBytes.subarray(0, centralOffset),
    Buffer.alloc(paddingBytes),
    archiveBytes.subarray(centralOffset),
  ]);
  padded.writeUInt32LE(centralOffset + paddingBytes, endOffset + paddingBytes + 16);
  return padded;
}

function padTarStructure(
  archiveBytes: Buffer,
  members: readonly DiagnosticsArchiveMember[],
  targetStructureBytes: number,
): Buffer {
  const tarBytes = gunzipSync(archiveBytes);
  const payloadBytes = members.reduce((total, member) => total + member.payload.byteLength, 0);
  const currentStructureBytes = tarBytes.byteLength - payloadBytes;
  const paddingBytes = targetStructureBytes - currentStructureBytes;
  assert.ok(paddingBytes >= 0);
  return gzipSync(Buffer.concat([tarBytes, Buffer.alloc(paddingBytes)]));
}

afterEach(() => {
  for (const directory of temporaryDirectories) fs.rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
});

describe('diagnostics archive format adapter', () => {
  it('creates equivalent fixed regular-file members in ZIP and tar.gz', async () => {
    const directory = createTemporaryDirectory();
    const members = createMembers();

    for (const [format, platform, filename] of [
      ['zip', 'win32', 'diagnostics.zip'],
      ['tar-gzip', 'linux', 'diagnostics.tar.gz'],
    ] as const) {
      const outputPath = path.join(directory, filename);
      const adapter = createAdapter(platform);
      await adapter.writeAndVerify(format, outputPath, members);

      const archiveBytes = await fs.promises.readFile(outputPath);
      const extracted = inspectDiagnosticsArchiveForVerification(format, archiveBytes);
      assert.deepEqual(
        [...extracted.keys()],
        members.map((member) => member.name),
      );
      for (const member of members) assert.equal(extracted.get(member.name)?.equals(member.payload), true);
      if (platform !== 'win32') {
        assert.equal((fs.statSync(outputPath).mode & 0o777) === 0o600, true);
      }
    }
  });

  it('rejects unknown, reordered, duplicated, and oversized members before writing', async () => {
    const directory = createTemporaryDirectory();
    const adapter = createAdapter('linux');
    const manifest = createMembers()[0];
    const audit = createMembers()[1];
    const maximumPayload = Buffer.alloc(DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes);
    const invalidMemberSets: readonly (readonly DiagnosticsArchiveMember[])[] = [
      [audit, manifest],
      [manifest, audit, audit],
      [manifest, { name: 'private/path.txt', payload: Buffer.alloc(0) }],
      [
        manifest,
        {
          name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
          payload: Buffer.alloc(DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes + 1),
        },
      ],
      [
        { ...manifest, payload: maximumPayload },
        { ...audit, payload: maximumPayload },
        {
          name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
          payload: Buffer.alloc(1),
        },
      ],
    ];

    for (const [index, members] of invalidMemberSets.entries()) {
      const outputPath = path.join(directory, `invalid-${index}.tar.gz`);
      await assert.rejects(adapter.writeAndVerify('tar-gzip', outputPath, members));
      assert.equal(fs.existsSync(outputPath), false);
    }
  });

  it('creates exact 128 MiB incompressible ZIP and tar.gz payloads within the 130 MiB outer limit', async () => {
    const directory = createTemporaryDirectory();
    const payload = Buffer.allocUnsafe(DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes);
    randomFillSync(payload);
    const members: readonly DiagnosticsArchiveMember[] = [
      { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest, payload },
      { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, payload },
    ];

    for (const [format, platform, filename] of [
      ['zip', 'win32', 'boundary.zip'],
      ['tar-gzip', 'linux', 'boundary.tar.gz'],
    ] as const) {
      const outputPath = path.join(directory, filename);
      await createAdapter(platform).writeAndVerify(format, outputPath, members);
      const outerBytes = fs.statSync(outputPath).size;
      assert.ok(outerBytes > MINIMUM_INCOMPRESSIBLE_ARCHIVE_BYTES);
      assert.ok(outerBytes <= DIAGNOSTICS_ARCHIVE_LIMITS.MaxOuterArchiveBytes);
    }
  });

  it('retains the 1000:1 compression-ratio rule from the one MiB member threshold', async () => {
    const directory = createTemporaryDirectory();
    const adapter = createAdapter('linux');
    const manifest = createMembers()[0];
    const belowThreshold: readonly DiagnosticsArchiveMember[] = [
      manifest,
      {
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
        payload: Buffer.alloc(DIAGNOSTICS_ARCHIVE_LIMITS.MinCompressionRatioMemberBytes - 1),
      },
    ];
    const atThreshold: readonly DiagnosticsArchiveMember[] = [
      manifest,
      {
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
        payload: Buffer.alloc(DIAGNOSTICS_ARCHIVE_LIMITS.MinCompressionRatioMemberBytes),
      },
    ];

    await adapter.writeAndVerify('tar-gzip', path.join(directory, 'ratio-below-threshold.tar.gz'), belowThreshold);
    await assert.rejects(
      adapter.writeAndVerify('tar-gzip', path.join(directory, 'ratio-at-threshold.tar.gz'), atThreshold),
    );
  });

  it('accepts exact ZIP and tar.gz structure bytes and rejects one byte over', async () => {
    const directory = createTemporaryDirectory();
    const members = createMembers();

    for (const [format, platform, filename] of [
      ['zip', 'win32', 'structure.zip'],
      ['tar-gzip', 'linux', 'structure.tar.gz'],
    ] as const) {
      const outputPath = path.join(directory, filename);
      await createAdapter(platform).writeAndVerify(format, outputPath, members);
      const archiveBytes = await fs.promises.readFile(outputPath);
      const exact =
        format === 'zip'
          ? padZipStructure(archiveBytes, DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes)
          : padTarStructure(archiveBytes, members, DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes);
      const over =
        format === 'zip'
          ? padZipStructure(archiveBytes, DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes + 1)
          : padTarStructure(archiveBytes, members, DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes + 1);

      assert.deepEqual(
        [...inspectDiagnosticsArchiveForVerification(format, exact).keys()],
        members.map((member) => member.name),
      );
      assert.throws(() => inspectDiagnosticsArchiveForVerification(format, over));
    }
  });

  it('enforces the exact outer and structure guards and rejects oversized writer output before publication', async () => {
    assert.equal(isDiagnosticsArchiveOuterByteLengthWithinLimit(DIAGNOSTICS_ARCHIVE_LIMITS.MaxOuterArchiveBytes), true);
    assert.equal(
      isDiagnosticsArchiveOuterByteLengthWithinLimit(DIAGNOSTICS_ARCHIVE_LIMITS.MaxOuterArchiveBytes + 1),
      false,
    );
    assert.equal(
      isDiagnosticsArchiveStructureByteLengthWithinLimit(DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes),
      true,
    );
    assert.equal(
      isDiagnosticsArchiveStructureByteLengthWithinLimit(DIAGNOSTICS_ARCHIVE_LIMITS.MaxArchiveStructureBytes + 1),
      false,
    );

    const directory = createTemporaryDirectory();
    const outputPath = path.join(directory, 'oversized-after-finalize.zip');
    let completedOutputRead = false;
    const adapter = new DiagnosticsArchiveFormatAdapter({
      fileSystem: {
        chmod: (filePath, mode) => fs.promises.chmod(filePath, mode),
        createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
        readFile: async () => {
          completedOutputRead = true;
          return Buffer.alloc(DIAGNOSTICS_ARCHIVE_LIMITS.MaxOuterArchiveBytes + 1);
        },
      },
      platform: 'win32',
      writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
    });

    await assert.rejects(adapter.writeAndVerify('zip', outputPath, createMembers()));
    assert.equal(completedOutputRead, true);
  });

  it('normalizes throwing writer and filesystem dependencies without exposing private failures', async () => {
    const directory = createTemporaryDirectory();
    const members = createMembers();
    const realFileSystem = {
      chmod: (filePath: string, mode: number) => fs.promises.chmod(filePath, mode),
      createWriteStream: (filePath: string, options: { readonly flags: 'wx'; readonly mode: number }): fs.WriteStream =>
        fs.createWriteStream(filePath, options),
      readFile: (filePath: string) => fs.promises.readFile(filePath),
    };
    const cases = [
      new DiagnosticsArchiveFormatAdapter({
        fileSystem: realFileSystem,
        platform: 'linux',
        writerFactory: new ThrowingDiagnosticsArchiveWriterFactory(),
      }),
      new DiagnosticsArchiveFormatAdapter({
        fileSystem: {
          ...realFileSystem,
          createWriteStream: () => {
            throw new Error(PRIVATE_FAILURE_CANARY);
          },
        },
        platform: 'linux',
        writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
      }),
      new DiagnosticsArchiveFormatAdapter({
        fileSystem: {
          ...realFileSystem,
          readFile: async () => {
            throw new Error(PRIVATE_FAILURE_CANARY);
          },
        },
        platform: 'linux',
        writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
      }),
    ];

    for (const [index, adapter] of cases.entries()) {
      const outputPath = path.join(directory, `throwing-dependency-${index}.tar.gz`);
      await assert.rejects(
        adapter.writeAndVerify('tar-gzip', outputPath, members),
        (error: unknown) =>
          error instanceof Error &&
          error.message === 'Diagnostics archive creation failed' &&
          !error.message.includes(PRIVATE_FAILURE_CANARY),
      );
    }
  });

  it('rejects tampered payloads and unsupported outer signatures', async () => {
    const directory = createTemporaryDirectory();
    const members = createMembers();
    const adapter = createAdapter('linux');
    const outputPath = path.join(directory, 'diagnostics.tar.gz');
    await adapter.writeAndVerify('tar-gzip', outputPath, members);
    const archiveBytes = await fs.promises.readFile(outputPath);

    assert.throws(() => adapter.verify('tar-gzip', archiveBytes, [{ ...members[0], payload: Buffer.from('changed') }]));
    assert.throws(() => inspectDiagnosticsArchiveForVerification('zip', archiveBytes));
    assert.throws(() => inspectDiagnosticsArchiveForVerification('tar-gzip', Buffer.from('not-an-archive')));
  });
});
