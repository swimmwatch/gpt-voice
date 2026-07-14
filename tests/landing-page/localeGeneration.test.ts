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
      '<!doctype html><html lang="en"><head><title>Placeholder</title><script type="module" src="/gpt-voice/assets/index.js"></script></head><body><div id="root"></div><script nomodule id="vite-legacy-entry" src="/gpt-voice/assets/index-legacy.js"></script></body></html>',
    );
    await generateLocalePages({ outputDirectory });
    const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

    assert.match(document, /<html lang="en" dir="ltr">/);
    assert.match(document, /GPT-Voice — Voice-to-text for faster AI prompts/);
    assert.match(document, /<link rel="canonical" href="https:\/\/swimmwatch.github.io\/gpt-voice\/"\/?>(?:<|$)/);
    assert.match(document, /<link rel="alternate" type="text\/plain" href="\/gpt-voice\/index.txt"\/?>(?:<|$)/);
    assert.match(
      document,
      /<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"\/?>(?:<|$)/,
    );
    assert.match(document, /<meta property="og:locale" content="en_US"\/?>(?:<|$)/);
    assert.match(document, /<meta name="twitter:card" content="summary"\/?>(?:<|$)/);
    const structuredData = document.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    assert.ok(structuredData, 'Expected JSON-LD structured data.');
    const graph = JSON.parse(structuredData) as {
      '@graph': Array<{ '@type': string; contentUrl?: string; mainEntity?: unknown[]; thumbnailUrl?: string }>;
    };
    assert.deepEqual(
      graph['@graph'].map((entry) => entry['@type']),
      ['WebSite', 'SoftwareApplication', 'VideoObject', 'FAQPage'],
    );
    assert.equal(graph['@graph'][2]?.contentUrl, 'https://swimmwatch.github.io/gpt-voice/generated/media/demo.mp4');
    assert.equal(
      graph['@graph'][2]?.thumbnailUrl,
      'https://swimmwatch.github.io/gpt-voice/generated/media/demo-poster.webp',
    );
    assert.equal(graph['@graph'][3]?.mainEntity?.length, 12);
    assert.equal((document.match(/id="root"/g) ?? []).length, 1);
    assert.equal((document.match(/id="main-content"/g) ?? []).length, 1);
    assert.equal((document.match(/class="skip-link"/g) ?? []).length, 1);
    assert.match(document, /<main id="main-content" tabindex="-1">/);
    assert.match(document, /Writing clear, well-structured prompts takes time\./);
    assert.match(document, /src="\/gpt-voice\/assets\/index.js"/);
    assert.match(document, /nomodule id="vite-legacy-entry" src="\/gpt-voice\/assets\/index-legacy.js"/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
