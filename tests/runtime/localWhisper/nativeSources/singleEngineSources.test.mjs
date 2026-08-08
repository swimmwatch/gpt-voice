import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  SOURCE_LOCK_DEFINITIONS,
  getSourceDefinition,
} from '../../../../scripts/local-whisper/source-import/source-definitions.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..', '..');
const lockRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks');
const expectedLockIds = Object.freeze([
  'googletest-v1.17.0-52eb810',
  'nlohmann-json-v3.12.0-subset',
  'whisper-cpp-v1.9.1-f049fff',
]);

test('native source authority contains exactly the three approved single-engine locks', () => {
  assert.deepEqual(Object.keys(SOURCE_LOCK_DEFINITIONS).sort(), [...expectedLockIds]);
  assert.deepEqual(
    readdirSync(lockRoot)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/u, ''))
      .sort(),
    [...expectedLockIds],
  );
  for (const lockId of expectedLockIds) assert.equal(getSourceDefinition(lockId), SOURCE_LOCK_DEFINITIONS[lockId]);
});

test('removed alternate-engine lock identifiers cannot resolve', () => {
  for (const lockId of ['faster-whisper-v1.2.1-65882ee', 'ctranslate2-v4.8.1-0d8bcd3']) {
    assert.throws(() => getSourceDefinition(lockId), /Unknown Local Whisper source lock/u);
  }
});
