import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseLocalWhisperWorkerJson } from '@shared/localWhisper';

interface LexicalManifest {
  readonly lexical: readonly { readonly binaryFile: string; readonly name: string; readonly valid: boolean }[];
}

const FIXTURE_ROOT = 'tests/fixtures/local-whisper/protocol/v1';

test('bounded worker JSON parser consumes every language-neutral N/N+1 vector', () => {
  const manifest = JSON.parse(readFileSync(`${FIXTURE_ROOT}/manifest.json`, 'utf8')) as LexicalManifest;
  for (const vector of manifest.lexical) {
    const bytes = readFileSync(`${FIXTURE_ROOT}/${vector.binaryFile}`);
    if (vector.valid) {
      assert.doesNotThrow(() => parseLocalWhisperWorkerJson(bytes), vector.name);
    } else {
      assert.throws(() => parseLocalWhisperWorkerJson(bytes), vector.name);
    }
  }
});

test('bounded worker JSON parser keeps object prototypes inert', () => {
  const parsed = parseLocalWhisperWorkerJson(new TextEncoder().encode('{"__proto__":{"polluted":true}}'));
  assert.deepEqual(parsed, { ['__proto__']: { polluted: true } });
  assert.equal(Reflect.get(Object.prototype, 'polluted'), undefined);
});
