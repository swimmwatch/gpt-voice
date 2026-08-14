import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
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
