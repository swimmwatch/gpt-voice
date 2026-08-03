import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('package metadata accepts an explicit candidate version without treating package.json as authority', async () => {
  const source = await readFile('scripts/generate-package-metadata.mjs', 'utf8');
  assert.match(source, /releaseVersion\(optionValue\('version'\) \|\| packageJson\.version\)/u);
  assert.match(source, /Version: \$\{packageVersion\}/u);
  assert.match(source, /<release version="\$\{xmlEscape\(packageVersion\)\}"/u);
  assert.doesNotMatch(source, /Version: \$\{packageJson\.version\}/u);
});
