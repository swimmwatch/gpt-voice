import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readVerifiedRegularFile } from '../../scripts/SecureFileReader';

test('secure file reader returns bytes only after regular-file identity validation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  context.after(async () => rm(root, { force: true, recursive: true }));
  const filePath = join(root, 'fixture.txt');
  await writeFile(filePath, 'fixture', { mode: 0o600 });

  const result = await readVerifiedRegularFile(filePath);

  assert.equal(result.bytes.toString('utf8'), 'fixture');
  assert.equal(result.sizeBytes, Buffer.byteLength('fixture'));
});

test('secure file reader rejects a directory before exposing bytes', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  context.after(async () => rm(root, { force: true, recursive: true }));
  const directoryPath = join(root, 'directory');
  await mkdir(directoryPath, { mode: 0o700 });

  await assert.rejects(() => readVerifiedRegularFile(directoryPath), /identity cannot be verified/u);
});
