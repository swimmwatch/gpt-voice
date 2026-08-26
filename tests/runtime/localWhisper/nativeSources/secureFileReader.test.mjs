import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, mkdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readVerifiedRegularFileSync } from '../../../../scripts/local-whisper/secure-file-reader.mjs';

test('secure file reader verifies and reads one ordinary file through its descriptor', () => {
  const root = mkdtempSync(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  const filePath = join(root, 'fixture.txt');
  writeFileSync(filePath, 'fixture', { mode: 0o600 });

  const result = readVerifiedRegularFileSync(filePath);
  const boundedResult = readVerifiedRegularFileSync(filePath, { maximumBytes: Buffer.byteLength('fixture') });

  assert.equal(result.bytes.toString('utf8'), 'fixture');
  assert.equal(boundedResult.bytes.toString('utf8'), 'fixture');
  assert.equal(result.stat.isFile(), true);
  assert.equal(result.stat.size, Buffer.byteLength('fixture'));
});

test('secure file reader rejects a non-file path before exposing bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  const directoryPath = join(root, 'directory');
  mkdirSync(directoryPath, { mode: 0o700 });

  assert.throws(() => readVerifiedRegularFileSync(directoryPath), /identity cannot be verified/u);
});

test('secure file reader rejects invalid maximum-byte options before opening the target', () => {
  for (const options of [
    { maximumBytes: 0 },
    { maximumBytes: 1.5 },
    { maximumBytes: Number.MAX_SAFE_INTEGER + 1 },
    { maximumBytes: '1' },
    { unexpected: 1 },
  ]) {
    assert.throws(
      () => readVerifiedRegularFileSync('unavailable-fixture', options),
      /(?:maximum bytes is|options are) invalid/u,
    );
  }
});

test('secure file reader rejects an oversized sparse file before reading its bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'gpt-voice-secure-file-reader-'));
  try {
    const filePath = join(root, 'oversized.bin');
    writeFileSync(filePath, '', { mode: 0o600 });
    truncateSync(filePath, 8 * 1024 * 1024);

    assert.throws(() => readVerifiedRegularFileSync(filePath, { maximumBytes: 1024 }), /exceeds maximum bytes/u);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
