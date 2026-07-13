import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateLocalePages } from '../../src/landing-page/build/generate-locales';

test('pre-renders the English landing shell without a router or JavaScript dependency', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-landing-'));

  try {
    await writeFile(
      path.join(outputDirectory, 'index.html'),
      '<!doctype html><html lang="en"><head><title>Placeholder</title><script type="module" src="/gpt-voice/assets/index.js"></script></head><body><div id="root"></div></body></html>',
    );
    await generateLocalePages({ outputDirectory });
    const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

    assert.match(document, /<html lang="en" dir="ltr">/);
    assert.match(document, /GPT-Voice — Voice-to-text for faster AI prompts/);
    assert.match(document, /<link rel="canonical" href="https:\/\/swimmwatch.github.io\/gpt-voice\/" \/>/);
    assert.match(document, /<link rel="alternate" type="text\/plain" href="\/gpt-voice\/index.txt" \/>/);
    assert.match(document, /<main id="main-content" tabindex="-1">/);
    assert.match(document, /Writing prompts for AI agents and assistants is work\./);
    assert.match(document, /src="\/gpt-voice\/assets\/index.js"/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
