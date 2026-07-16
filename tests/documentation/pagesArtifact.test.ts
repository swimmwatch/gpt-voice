import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyPagesArtifact, writePagesMetadata } from '../../scripts/build-pages.mjs';

const localeSlugs = ['', 'ru', 'be', 'uk', 'es', 'pt-br', 'zh-cn', 'ja', 'de', 'fr', 'hi'];

test('publishes one artifact with reciprocal landing and documentation routes', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-pages-artifact-'));
  await mkdir(path.join(outputDirectory, 'docs'), { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), '<a href="/gpt-voice/docs/">Documentation</a>');
  await writeFile(path.join(outputDirectory, 'docs', 'index.html'), '<a href="/gpt-voice/">GPT-Voice</a>');
  await writeFile(path.join(outputDirectory, 'docs', 'sitemap.xml'), '<urlset />');

  await Promise.all(
    localeSlugs.filter(Boolean).flatMap((localeSlug) => [
      mkdir(path.join(outputDirectory, localeSlug), { recursive: true }).then(() =>
        writeFile(path.join(outputDirectory, localeSlug, 'index.html'), '<html />'),
      ),
      mkdir(path.join(outputDirectory, 'docs', localeSlug), { recursive: true }).then(() =>
        writeFile(path.join(outputDirectory, 'docs', localeSlug, 'index.html'), '<html />'),
      ),
    ]),
  );

  await writePagesMetadata(outputDirectory);
  await verifyPagesArtifact(outputDirectory);
  await assert.doesNotReject(() => verifyPagesArtifact(outputDirectory));
});
