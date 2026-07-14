import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateLocalePages } from '../../src/landing-page/build/generate-locales';
import { verifyAccessibility } from '../../src/landing-page/build/verify-accessibility';

test('accepts the generated English static accessibility structure', async () => {
  const outputDirectory = await createGeneratedEnglishPage();

  try {
    await assert.doesNotReject(() => verifyAccessibility(outputDirectory));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('rejects duplicate main landmarks', async () => {
  const outputDirectory = await createGeneratedEnglishPage();

  try {
    const pagePath = path.join(outputDirectory, 'index.html');
    const document = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, document.replace('</body>', '<main id="duplicate-main"></main></body>'));

    await assert.rejects(() => verifyAccessibility(outputDirectory), /landmark-no-duplicate-main/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

async function createGeneratedEnglishPage(): Promise<string> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-a11y-'));
  await writeFile(
    path.join(outputDirectory, 'index.html'),
    '<!doctype html><html lang="en"><head><title>Placeholder</title><script type="module" src="/gpt-voice/assets/index.js"></script></head><body><div id="root"></div><script nomodule id="vite-legacy-entry" src="/gpt-voice/assets/index-legacy.js"></script></body></html>',
  );
  await generateLocalePages({ outputDirectory });

  return outputDirectory;
}
