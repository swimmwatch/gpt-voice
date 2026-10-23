import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  conffilesFromDebianControlTar,
  DebianDataTarInventoryCollector,
  packageFilesFromDebianDataTar,
} from '@scripts/local-whisper/alpha-smoke/SafeDebianTarArchive';

const TAR_BLOCK_BYTES = 512;

interface TarFixtureEntry {
  readonly content?: string;
  readonly linkTarget?: string;
  readonly name: string;
  readonly type?: '0' | '2' | '5';
}

function writeString(target: Buffer, offset: number, length: number, value: string): void {
  const source = Buffer.from(value, 'utf8');
  source.copy(target, offset, 0, Math.min(source.length, length));
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  writeString(target, offset, length, `${value.toString(8).padStart(length - 1, '0')}\0`);
}

function createTar(entries: readonly TarFixtureEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const payload = Buffer.from(entry.content ?? '', 'utf8');
    const header = Buffer.alloc(TAR_BLOCK_BYTES);
    writeString(header, 0, 100, entry.name);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 124, 12, payload.length);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    if (entry.linkTarget) writeString(header, 157, 100, entry.linkTarget);
    header.fill(' '.charCodeAt(0), 148, 156);
    let checksum = 0;
    for (const value of header) checksum += value;
    writeOctal(header, 148, 8, checksum);
    blocks.push(
      header,
      payload,
      Buffer.alloc((TAR_BLOCK_BYTES - (payload.length % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES),
    );
  }
  blocks.push(Buffer.alloc(TAR_BLOCK_BYTES), Buffer.alloc(TAR_BLOCK_BYTES));
  return Buffer.concat(blocks);
}

describe('SafeDebianTarArchive', () => {
  it('streams package identities across arbitrary chunk boundaries', () => {
    const archive = createTar([
      { name: './opt/', type: '5' },
      { content: 'ordinary payload', name: './opt/GPT-Voice/gpt-voice' },
      { linkTarget: '../GPT-Voice/gpt-voice', name: './usr/bin/gpt-voice', type: '2' },
    ]);
    const collector = new DebianDataTarInventoryCollector();
    for (let offset = 0; offset < archive.length; offset += 137) {
      collector.write(archive.subarray(offset, Math.min(offset + 137, archive.length)));
    }

    assert.deepEqual(collector.finish(), packageFilesFromDebianDataTar(archive));
  });

  it('rejects non-zero trailing bytes in the streaming inventory', () => {
    const archive = createTar([{ content: 'x', name: './opt/GPT-Voice/gpt-voice' }]);
    const collector = new DebianDataTarInventoryCollector();
    collector.write(archive);
    assert.throws(() => collector.write(Buffer.from([1])), /ALPHA_SMOKE_LINUX_ARCHIVE_TRAILING_BYTES_INVALID/u);
  });

  it('derives only canonical regular-file and symlink identities without extracting to the host', () => {
    const archive = createTar([
      { name: './', type: '5' },
      { name: './opt/', type: '5' },
      { content: 'binary', name: './opt/GPT-Voice/gpt-voice' },
      { linkTarget: '../GPT-Voice/gpt-voice', name: './usr/bin/gpt-voice', type: '2' },
    ]);
    assert.deepEqual(packageFilesFromDebianDataTar(archive), [
      {
        kind: 'file',
        mode: 0o644,
        path: '/opt/GPT-Voice/gpt-voice',
        value: createHash('sha256').update('binary').digest('hex'),
      },
      { kind: 'symlink', mode: 0o644, path: '/usr/bin/gpt-voice', value: '../GPT-Voice/gpt-voice' },
    ]);
  });

  it('rejects traversal, duplicate entries, and invalid tar integrity before package comparison', () => {
    assert.throws(
      () => packageFilesFromDebianDataTar(createTar([{ content: 'x', name: '../escape' }])),
      /ALPHA_SMOKE_LINUX_ARCHIVE_PATH_INVALID/u,
    );
    assert.throws(
      () =>
        packageFilesFromDebianDataTar(
          createTar([
            { content: 'x', name: './opt/GPT-Voice/gpt-voice' },
            { content: 'y', name: './opt/GPT-Voice/gpt-voice' },
          ]),
        ),
      /ALPHA_SMOKE_LINUX_ARCHIVE_DUPLICATE_PATH/u,
    );
    const corrupted = createTar([{ content: 'x', name: './opt/GPT-Voice/gpt-voice' }]);
    corrupted[0] = 'x'.charCodeAt(0);
    assert.throws(() => packageFilesFromDebianDataTar(corrupted), /ALPHA_SMOKE_LINUX_ARCHIVE_CHECKSUM_INVALID/u);

    const trailingBytes = Buffer.concat([
      createTar([{ content: 'x', name: './opt/GPT-Voice/gpt-voice' }]),
      Buffer.concat([Buffer.from([1]), Buffer.alloc(TAR_BLOCK_BYTES - 1)]),
    ]);
    assert.throws(
      () => packageFilesFromDebianDataTar(trailingBytes),
      /ALPHA_SMOKE_LINUX_ARCHIVE_TRAILING_BYTES_INVALID/u,
    );
  });

  it('uses the exact Debian control conffile list', () => {
    const control = createTar([{ content: '/etc/gpt-voice.conf\n', name: './conffiles' }]);
    assert.deepEqual(conffilesFromDebianControlTar(control), ['/etc/gpt-voice.conf']);
    const duplicate = createTar([{ content: '/etc/gpt-voice.conf\n/etc/gpt-voice.conf\n', name: './conffiles' }]);
    assert.throws(() => conffilesFromDebianControlTar(duplicate), /ALPHA_SMOKE_LINUX_ARCHIVE_CONFFILES_INVALID/u);
  });
});
