import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyBrowserSupport } from '../../src/landing-page/build/verify-browser-support';

test('accepts isolated modern and legacy browser entries with deferred Plyr', async () => {
  const outputDirectory = await createBrowserFixture();

  try {
    await assert.doesNotReject(() => verifyBrowserSupport(outputDirectory));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test('rejects a runtime asset outside the landing base path', async () => {
  const outputDirectory = await createBrowserFixture();

  try {
    const pagePath = path.join(outputDirectory, 'index.html');
    const document = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, document.replace('/gpt-voice/assets/index.js', 'https://cdn.example/index.js'));

    await assert.rejects(() => verifyBrowserSupport(outputDirectory), /escapes the \/gpt-voice\/ base path/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

async function createBrowserFixture(): Promise<string> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-browser-'));
  const assetsDirectory = path.join(outputDirectory, 'assets');
  const mediaDirectory = path.join(outputDirectory, 'generated/media');
  const captionsDirectory = path.join(outputDirectory, 'generated/captions');
  await Promise.all([
    mkdir(assetsDirectory, { recursive: true }),
    mkdir(mediaDirectory, { recursive: true }),
    mkdir(captionsDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(assetsDirectory, 'index.js'), ''),
    writeFile(path.join(assetsDirectory, 'index.css'), ''),
    writeFile(path.join(assetsDirectory, 'polyfills-legacy.js'), ''),
    writeFile(path.join(assetsDirectory, 'index-legacy.js'), ''),
    writeFile(path.join(mediaDirectory, 'demo.mp4'), ''),
    writeFile(path.join(mediaDirectory, 'demo-poster.webp'), ''),
    writeFile(path.join(captionsDirectory, 'en.vtt'), ''),
  ]);
  await writeFile(
    path.join(outputDirectory, 'index.html'),
    '<script type="module" src="/gpt-voice/assets/index.js"></script><link rel="stylesheet" href="/gpt-voice/assets/index.css"><video poster="/gpt-voice/generated/media/demo-poster.webp"><source src="/gpt-voice/generated/media/demo.mp4"><track src="/gpt-voice/generated/captions/en.vtt"></video><script nomodule id="vite-legacy-polyfill" src="/gpt-voice/assets/polyfills-legacy.js"></script><script nomodule id="vite-legacy-entry" data-src="/gpt-voice/assets/index-legacy.js"></script>',
  );

  return outputDirectory;
}
