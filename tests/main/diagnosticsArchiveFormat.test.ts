import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  inspectDiagnosticsArchiveForVerification,
  type DiagnosticsArchiveMember,
} from '@main/services/diagnosticsArchiveFormat';
import { DIAGNOSTICS_ARCHIVE_MEMBER_NAMES } from '@shared/diagnosticsArchive';

const temporaryDirectories: string[] = [];

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
    const invalidMemberSets: readonly (readonly DiagnosticsArchiveMember[])[] = [
      [audit, manifest],
      [manifest, audit, audit],
      [manifest, { name: 'private/path.txt', payload: Buffer.alloc(0) }],
      [
        manifest,
        {
          name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
          payload: Buffer.alloc(128 * 1024 * 1024 + 1),
        },
      ],
    ];

    for (const [index, members] of invalidMemberSets.entries()) {
      const outputPath = path.join(directory, `invalid-${index}.tar.gz`);
      await assert.rejects(adapter.writeAndVerify('tar-gzip', outputPath, members));
      assert.equal(fs.existsSync(outputPath), false);
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
