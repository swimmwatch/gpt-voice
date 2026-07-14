import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertLandingSizeBudgets,
  landingSizeBudgets,
  measureLandingBuild,
  type LandingSizeReport,
} from '../../src/landing-page/build/verify-sizes';

test('measures browser-initial chunks separately from deferred Plyr assets', async () => {
  const buildDirectory = await createBuildFixture();

  try {
    const report = await measureLandingBuild(buildDirectory);

    assert.equal(report.modernInitialJavaScript.raw, 1024);
    assert.equal(report.legacyInitialJavaScript.raw, 3072);
    assert.equal(report.initialCss.raw, 512);
    assert.equal(report.deferredPlyr.raw, 2048);
    assert.equal(report.sourceMaps.length, 0);
  } finally {
    await rm(buildDirectory, { force: true, recursive: true });
  }
});

test('reports every exceeded budget and published source map together', () => {
  const report: LandingSizeReport = {
    deferredPlyr: encodedSize(landingSizeBudgets.deferredPlyrGzip + 1),
    html: encodedSize(landingSizeBudgets.htmlGzip + 1),
    initialCss: encodedSize(landingSizeBudgets.initialCssGzip + 1),
    legacyInitialJavaScript: encodedSize(landingSizeBudgets.legacyInitialJavaScriptGzip + 1),
    modernInitialJavaScript: encodedSize(landingSizeBudgets.modernInitialJavaScriptGzip + 1),
    sourceMaps: ['assets/index.js.map'],
  };

  assert.throws(
    () => assertLandingSizeBudgets(report),
    /Modern initial JavaScript[\s\S]*Legacy initial JavaScript[\s\S]*Initial CSS[\s\S]*Deferred Plyr[\s\S]*Minified HTML[\s\S]*Source maps/,
  );
});

function encodedSize(gzip: number) {
  return { brotli: gzip, gzip, raw: gzip };
}

async function createBuildFixture(): Promise<string> {
  const buildDirectory = await mkdtemp(path.join(os.tmpdir(), 'landing-size-'));
  const assetsDirectory = path.join(buildDirectory, 'assets');
  await mkdir(assetsDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(assetsDirectory, 'index.js'), randomBytes(1024)),
    writeFile(path.join(assetsDirectory, 'index-legacy.js'), randomBytes(2048)),
    writeFile(path.join(assetsDirectory, 'polyfills-legacy.js'), randomBytes(1024)),
    writeFile(path.join(assetsDirectory, 'index.css'), randomBytes(512)),
    writeFile(path.join(assetsDirectory, 'plyr-main.js'), randomBytes(2048)),
    writeFile(path.join(assetsDirectory, 'plyr-legacy-main.js'), randomBytes(1024)),
  ]);
  await writeFile(
    path.join(buildDirectory, 'index.html'),
    '<script type="module" src="/gpt-voice/assets/index.js"></script><link rel="stylesheet" href="/gpt-voice/assets/index.css"><script nomodule id="vite-legacy-polyfill" src="/gpt-voice/assets/polyfills-legacy.js"></script><script nomodule id="vite-legacy-entry" data-src="/gpt-voice/assets/index-legacy.js"></script>',
  );

  return buildDirectory;
}
