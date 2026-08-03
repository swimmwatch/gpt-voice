import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { it } from 'node:test';

it('writes runtime reproducibility evidence with the canonical producer', async () => {
  const source = await readFile(path.resolve('scripts/local-whisper/qualification/produce-runtime-packs.mjs'), 'utf8');
  assert.match(source, /canonicalDigest, canonicalJson/u);
  assert.match(source, /writeFileSync\([^;]+canonicalJson\(record\)/u);
  assert.doesNotMatch(source, /JSON\.stringify\(record, null, 2\)/u);
});
