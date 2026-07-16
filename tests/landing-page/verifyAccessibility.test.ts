import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { verifyAccessibility } from '../../src/landing-page/build/verify-accessibility';
import { createGeneratedEnglishPage } from './helpers/createGeneratedEnglishPage';

test('accepts the generated English static accessibility structure', async () => {
  const outputDirectory = await createGeneratedEnglishPage('gpt-voice-a11y-');

  try {
    await assert.doesNotReject(() => verifyAccessibility(outputDirectory));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('rejects duplicate main landmarks', async () => {
  const outputDirectory = await createGeneratedEnglishPage('gpt-voice-a11y-');

  try {
    const pagePath = path.join(outputDirectory, 'index.html');
    const document = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, document.replace('</body>', '<main id="duplicate-main"></main></body>'));

    await assert.rejects(() => verifyAccessibility(outputDirectory), /landmark-no-duplicate-main/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
