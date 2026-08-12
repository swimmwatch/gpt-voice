import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readVerifiedRegularFileSync } from '../../../../scripts/local-whisper/secure-file-reader.mjs';

test('secure file reader verifies and reads one ordinary file through its descriptor', () => {
  const root = mkdtempSync(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  const filePath = join(root, 'fixture.txt');
  writeFileSync(filePath, 'fixture', { mode: 0o600 });

  const result = readVerifiedRegularFileSync(filePath);

  assert.equal(result.bytes.toString('utf8'), 'fixture');
  assert.equal(result.stat.isFile(), true);
  assert.equal(result.stat.size, Buffer.byteLength('fixture'));
});

test('secure file reader rejects a non-file path before exposing bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  const directoryPath = join(root, 'directory');
  mkdirSync(directoryPath, { mode: 0o700 });

  assert.throws(() => readVerifiedRegularFileSync(directoryPath), /identity cannot be verified/u);
});
