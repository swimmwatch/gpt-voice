import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  assertFileExists,
  assertManifestFileHash,
  getSafeRelativePath,
  isStreamingPath,
  readHashManifest,
  requiredMediaAssets,
} from '../../src/landing-page/build/media-contract';
import { syncPublicAssets, syncShellAssets } from '../../src/landing-page/build/sync-public-assets';
import { verifyMediaAssets } from '../../src/landing-page/build/verify-media';

const rootDirectory = path.resolve(__dirname, '../..');
const specificationAssets = path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets');

test('keeps approved capture and icon sources hash-pinned', async () => {
  const [captures, interfaceIcons, providerIcons] = await Promise.all([
    readHashManifest(path.join(specificationAssets, 'capture-manifest.json')),
    readHashManifest(path.join(specificationAssets, 'interface-icons/manifest.json')),
    readHashManifest(path.join(specificationAssets, 'provider-icons/manifest.json')),
  ]);

  await Promise.all([
    ...captures.files.map((file) => assertManifestFileHash(specificationAssets, file)),
    ...interfaceIcons.files.map((file) =>
      assertManifestFileHash(path.join(specificationAssets, 'interface-icons'), file),
    ),
    ...providerIcons.files.map((file) =>
      assertManifestFileHash(path.join(specificationAssets, 'provider-icons'), file),
    ),
  ]);
});

test('defines one HLS-free media contract for every locale', () => {
  assert.equal(requiredMediaAssets.videoFileName, 'demo.mp4');
  assert.equal(requiredMediaAssets.posterFileName, 'demo-poster.webp');
  assert.equal(requiredMediaAssets.captions.length, 11);
  assert.equal(requiredMediaAssets.transcriptFiles.length, 11);
  assert.equal(isStreamingPath('media/demo.mp4'), false);
  assert.equal(isStreamingPath('media/segments/0001.m4s'), true);
  assert.equal(isStreamingPath('media/demo.m3u8'), true);
  assert.equal(isStreamingPath('media/playlist.mpd'), true);
});

test('rejects asset paths outside their approved source directory', () => {
  assert.equal(
    getSafeRelativePath(specificationAssets, path.join(specificationAssets, 'captures/app-main.png')),
    'captures/app-main.png',
  );
  assert.throws(() => getSafeRelativePath(specificationAssets, path.join(rootDirectory, 'assets/icon.svg')));
});

test('blocks asset synchronization until the approved demo media is present', async () => {
  await assert.rejects(syncPublicAssets, /Required landing asset is missing: .*assets\/demo/);
});

test('synchronizes the approved hero screenshot while video production is pending', async () => {
  await syncShellAssets();

  await Promise.all(
    ['app-main.png', 'app-main.webp', 'app-main.avif'].map((fileName) =>
      assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/media', fileName)),
    ),
  );
});

test('does not validate an incomplete generated media set as publishable', async () => {
  await assert.rejects(verifyMediaAssets, /Required landing asset is missing/);
});
