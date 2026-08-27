import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { isSemanticVersion } from '../../scripts/semantic-version.mjs';

test('package metadata accepts an explicit candidate version without treating package.json as authority', async () => {
  const source = await readFile('scripts/generate-package-metadata.mjs', 'utf8');
  assert.match(source, /isSemanticVersion\(value\)/u);
  assert.match(source, /releaseVersion\(optionValue\('version'\) \|\| packageJson\.version\)/u);
  assert.match(source, /Version: \$\{packageVersion\}/u);
  assert.match(source, /<release version="\$\{xmlEscape\(packageVersion\)\}"/u);
  assert.doesNotMatch(source, /Version: \$\{packageJson\.version\}/u);
});

test('semantic version validation accepts prereleases and rejects malformed values', () => {
  assert.equal(isSemanticVersion('2.4.0-alpha.1'), true);
  assert.equal(isSemanticVersion('2.4.0-alpha.1+build.7'), true);
  assert.equal(isSemanticVersion('2.4.0-01'), false);
  assert.equal(isSemanticVersion('2.4'), false);
  assert.equal(isSemanticVersion('2.4.0+'), false);
});
