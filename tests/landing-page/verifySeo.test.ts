import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { verifySeoOutput } from '../../src/landing-page/build/verify-seo';
import { createGeneratedEnglishPage } from './helpers/createGeneratedEnglishPage';

test('verifies the generated English canonical metadata and video structured data', async () => {
  const outputDirectory = await createGeneratedEnglishPage('gpt-voice-seo-');

  try {
    await assert.doesNotReject(() => verifySeoOutput(outputDirectory));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('rejects a missing JSON-LD graph', async () => {
  const outputDirectory = await createGeneratedEnglishPage('gpt-voice-seo-');

  try {
    const pagePath = path.join(outputDirectory, 'index.html');
    const document = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, document.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''));

    await assert.rejects(() => verifySeoOutput(outputDirectory), /missing JSON-LD/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
