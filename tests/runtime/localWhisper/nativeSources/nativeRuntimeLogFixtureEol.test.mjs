import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const attributesPath = resolve(workspaceRoot, '.gitattributes');
const fixturePath = resolve(
  workspaceRoot,
  'tests',
  'fixtures',
  'local-whisper',
  'native-runtime-log',
  'v1',
  'valid.jsonl',
);

test('native runtime JSONL fixtures retain canonical LF bytes on Windows and Linux', () => {
  const fixture = readFileSync(fixturePath);

  assert.equal(fixture.includes(0x0d), false);
  assert.equal(fixture.at(-1), 0x0a);
});

test('repository text and binary attributes keep clean Windows checkouts byte-stable', () => {
  const attributes = readFileSync(attributesPath, 'utf8');

  assert.match(attributes, /^\* text=auto eol=lf$/mu);
  for (const extension of ['bin', 'ico', 'jpeg', 'jpg', 'png']) {
    assert.match(attributes, new RegExp(`^\\*\\.${extension} binary$`, 'mu'));
  }
});
