import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
import {
  assertApprovedDemoVideo,
  syncPublicAssets,
  syncShellAssets,
} from '../../src/landing-page/build/sync-public-assets';
import {
  assertCaptionCueTiming,
  assertEnglishMediaText,
  verifyMediaAssets,
} from '../../src/landing-page/build/verify-media';
import { localeRegistry, publishedLocaleContent } from '../../src/landing-page/content';

const rootDirectory = path.resolve(__dirname, '../..');
const specificationAssets = path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets');

test('keeps the footer signal divider as clean vector artwork', async () => {
  const source = await readFile(path.join(rootDirectory, 'src/landing-page/assets/footer-signal-divider.svg'), 'utf8');

  assert.match(source, /^<svg\b/);
  assert.match(source, /vector-effect="non-scaling-stroke"/);
  assert.doesNotMatch(source, /<(?:filter|image)\b/);
});

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

test('defines an HLS-free media contract for every published locale', () => {
  assert.equal(requiredMediaAssets.videoFileName, 'demo.mp4');
  assert.equal(requiredMediaAssets.posterFileName, 'demo-poster.webp');
  assert.deepEqual(
    requiredMediaAssets.captions,
    localeRegistry.map((locale) => `${locale.routeSlug || 'en'}.vtt`),
  );
  assert.deepEqual(
    requiredMediaAssets.transcriptFiles,
    localeRegistry.map((locale) => `${locale.routeSlug || 'en'}.txt`),
  );
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

test('rejects Cyrillic in English landing media descriptions', () => {
  assert.doesNotThrow(() => assertEnglishMediaText('Russian voice input becomes an English prompt.', 'en.txt'));
  assert.throws(() => assertEnglishMediaText('Русский голосовой ввод.', 'en.txt'), /must not render Cyrillic/);
});

test('requires timed, ordered, non-overlapping WebVTT cues', () => {
  assert.doesNotThrow(() => assertCaptionCueTiming('WEBVTT\n\n00:00.000 --> 00:01.000\nFirst cue', 'en.vtt'));
  assert.throws(() => assertCaptionCueTiming('WEBVTT\n\n00:02.000 --> 00:01.000\nInvalid cue', 'en.vtt'));
  assert.throws(
    () =>
      assertCaptionCueTiming('WEBVTT\n\n00:00.000 --> 00:02.000\nFirst\n\n00:01.000 --> 00:03.000\nSecond', 'en.vtt'),
    /non-overlapping/,
  );
});

test('synchronizes the shared English visual demo with localized accessibility resources', async () => {
  await assertApprovedDemoVideo(path.join(specificationAssets, 'demo/demo.mp4'));
  await syncPublicAssets();

  await Promise.all([
    assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/media/demo.mp4')),
    assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/media/demo-poster.webp')),
    ...requiredMediaAssets.captions.map((fileName) =>
      assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/captions', fileName)),
    ),
    ...requiredMediaAssets.transcriptFiles.map((fileName) =>
      assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/media/transcripts', fileName)),
    ),
    assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/icons/gpt-voice.png')),
    assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/icons/gpt-voice.svg')),
  ]);

  await Promise.all(
    localeRegistry
      .filter((locale) => locale.tag !== 'en')
      .map(async (locale) => {
        const captions = await readFile(
          path.join(rootDirectory, 'src/landing-page/public/generated/captions', `${locale.routeSlug}.vtt`),
          'utf8',
        );
        const visualCues = publishedLocaleContent[locale.tag].demo.transcriptCues.slice(0, 8);

        for (const cue of visualCues) {
          assert.ok(
            captions.includes(cue.visualDescription),
            `${locale.tag} captions must contain the localized ${cue.id} cue`,
          );
        }
      }),
  );
});

test('synchronizes the approved hero screenshot while video production is pending', async () => {
  await syncShellAssets();

  await Promise.all(
    ['app-main.png', 'app-main.webp', 'app-main.avif'].map((fileName) =>
      assertFileExists(path.join(rootDirectory, 'src/landing-page/public/generated/media', fileName)),
    ),
  );
});

test('validates the complete generated localized media set', async () => {
  await verifyMediaAssets();
});
