import assert from 'node:assert/strict';
import { appendFile, copyFile, mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { before } from 'node:test';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

type DocumentationAssetModule = {
  getApprovedDocumentationCapture: (manifest: unknown, capturePath: string) => unknown;
  getSafeAssetPath: (rootDirectory: string, relativePath: string) => string;
  syncDocumentationAssets: (options?: { destinationDirectory?: string; rootDirectory?: string }) => Promise<void>;
};

const projectRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(projectRoot, 'scripts', 'sync-docs-assets.mjs');
const generatedDirectory = path.join(projectRoot, 'docs/user-guide/assets/generated');
const fixtureFiles = [
  'assets/icon.svg',
  'docs/specs/github-pages-landing-page/assets/capture-manifest.json',
  'docs/specs/github-pages-landing-page/assets/captures/app-main.png',
  'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  'node_modules/@fontsource-variable/ubuntu-sans/files/ubuntu-sans-latin-wght-normal.woff2',
];
const expectedFiles = [
  'asset-manifest.json',
  'fonts/jetbrains-mono-latin-wght-normal.woff2',
  'fonts/ubuntu-sans-latin-wght-normal.woff2',
  'icons/gpt-voice.svg',
  'images/app-main.avif',
  'images/app-main.png',
  'images/app-main.webp',
];

let documentationAssets: DocumentationAssetModule;

function isDocumentationAssetModule(value: unknown): value is DocumentationAssetModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).getApprovedDocumentationCapture === 'function' &&
    typeof (value as Record<string, unknown>).getSafeAssetPath === 'function' &&
    typeof (value as Record<string, unknown>).syncDocumentationAssets === 'function'
  );
}

async function listFiles(directory: string, relativeDirectory = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relativePath) : [relativePath];
    }),
  );
  return files.flat().sort();
}

async function copyFixture(rootDirectory: string): Promise<void> {
  await Promise.all(
    fixtureFiles.map(async (file) => {
      const destination = path.join(rootDirectory, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(projectRoot, file), destination);
    }),
  );
}

before(async () => {
  const importedModule: unknown = await import(pathToFileURL(scriptPath).href);
  assert.ok(isDocumentationAssetModule(importedModule));
  documentationAssets = importedModule;
});

test('stages only the approved, hash-pinned documentation assets deterministically', async () => {
  await documentationAssets.syncDocumentationAssets();
  const firstManifest = await readFile(path.join(generatedDirectory, 'asset-manifest.json'), 'utf8');
  await documentationAssets.syncDocumentationAssets();

  assert.deepEqual(await listFiles(generatedDirectory), expectedFiles);
  assert.equal(await readFile(path.join(generatedDirectory, 'asset-manifest.json'), 'utf8'), firstManifest);

  const manifest = JSON.parse(firstManifest) as { files: Record<string, string>; screenshot: Record<string, unknown> };
  assert.deepEqual(Object.keys(manifest.files).sort(), expectedFiles.slice(1));
  assert.deepEqual(manifest.screenshot, {
    height: 840,
    sha256: 'a011bf93e63adbc7fbdd4c0767dafc238b30531899035c6dea15be9661936bb3',
    source: 'captures/app-main.png',
    width: 920,
  });
  for (const file of ['images/app-main.png', 'images/app-main.webp', 'images/app-main.avif']) {
    const metadata = await sharp(path.join(generatedDirectory, file)).metadata();
    assert.equal(metadata.width, 920);
    assert.equal(metadata.height, 840);
  }
  for (const referenceCapture of [
    'app-history.png',
    'app-hotkeys.png',
    'app-prettify.png',
    'app-provider-settings.png',
  ]) {
    assert.equal(
      (await listFiles(generatedDirectory)).some((file) => file.includes(referenceCapture)),
      false,
    );
  }
});

test('rejects reference-only, escaped, tampered, and missing asset sources', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(projectRoot, 'docs/specs/github-pages-landing-page/assets/capture-manifest.json'), 'utf8'),
  );
  assert.throws(() => documentationAssets.getApprovedDocumentationCapture(manifest, 'captures/app-history.png'));

  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-doc-assets-'));
  try {
    await copyFixture(fixtureRoot);
    assert.throws(() => documentationAssets.getSafeAssetPath(fixtureRoot, '../outside'));

    const screenshot = path.join(fixtureRoot, 'docs/specs/github-pages-landing-page/assets/captures/app-main.png');
    await appendFile(screenshot, 'tampered');
    await assert.rejects(documentationAssets.syncDocumentationAssets({ rootDirectory: fixtureRoot }), /hash mismatch/u);

    await copyFile(
      path.join(projectRoot, 'docs/specs/github-pages-landing-page/assets/captures/app-main.png'),
      screenshot,
    );
    await rm(
      path.join(fixtureRoot, 'node_modules/@fontsource-variable/ubuntu-sans/files/ubuntu-sans-latin-wght-normal.woff2'),
    );
    await assert.rejects(documentationAssets.syncDocumentationAssets({ rootDirectory: fixtureRoot }));
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
