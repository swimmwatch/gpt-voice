import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {
  LANDING_PUBLIC_CAPTIONS_DIRECTORY,
  LANDING_PUBLIC_MEDIA_DIRECTORY,
  assertFileExists,
  getPathSha256,
  requiredMediaAssets,
} from './media-contract.js';
import { assertMp4HasNoSubtitleStream, assertNoStreamingFiles } from './sync-public-assets.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const generatedDirectory = path.join(repositoryRoot, 'src/landing-page/public/generated');

export async function verifyMediaAssets(): Promise<void> {
  const mediaDirectory = path.join(generatedDirectory, LANDING_PUBLIC_MEDIA_DIRECTORY);
  const captionsDirectory = path.join(generatedDirectory, LANDING_PUBLIC_CAPTIONS_DIRECTORY);
  const transcriptsDirectory = path.join(mediaDirectory, 'transcripts');
  const videoPath = path.join(mediaDirectory, requiredMediaAssets.videoFileName);

  await Promise.all([
    assertFileExists(path.join(mediaDirectory, 'app-main.png')),
    assertFileExists(path.join(mediaDirectory, 'app-main.webp')),
    assertFileExists(path.join(mediaDirectory, 'app-main.avif')),
    assertFileExists(videoPath),
    assertFileExists(path.join(mediaDirectory, requiredMediaAssets.posterFileName)),
    assertFileExists(path.join(generatedDirectory, 'asset-manifest.json')),
    ...requiredMediaAssets.captions.map((fileName) => assertFileExists(path.join(captionsDirectory, fileName))),
    ...requiredMediaAssets.transcriptFiles.map((fileName) =>
      assertFileExists(path.join(transcriptsDirectory, fileName)),
    ),
  ]);
  await Promise.all([
    assertNoStreamingFiles(generatedDirectory),
    assertMp4HasNoSubtitleStream(videoPath),
    assertScreenshotGeometry(mediaDirectory),
    assertCaptionFiles(captionsDirectory),
    assertAssetManifest(),
  ]);
}

async function assertScreenshotGeometry(mediaDirectory: string): Promise<void> {
  const assets = ['app-main.png', 'app-main.webp', 'app-main.avif'];
  const metadata = await Promise.all(assets.map((fileName) => sharp(path.join(mediaDirectory, fileName)).metadata()));

  for (const [index, image] of metadata.entries()) {
    if (image.width !== 920 || image.height !== 840) {
      throw new Error(`Screenshot derivative has unexpected geometry: ${assets[index]}`);
    }
  }
}

async function assertCaptionFiles(captionsDirectory: string): Promise<void> {
  const captions = await Promise.all(
    requiredMediaAssets.captions.map(async (fileName) => readFile(path.join(captionsDirectory, fileName), 'utf8')),
  );

  for (const [index, caption] of captions.entries()) {
    if (!caption.startsWith('WEBVTT')) {
      throw new Error(`Invalid WebVTT caption file: ${requiredMediaAssets.captions[index]}`);
    }
  }
}

async function assertAssetManifest(): Promise<void> {
  const manifestPath = path.join(generatedDirectory, 'asset-manifest.json');
  const source = await readFile(manifestPath, 'utf8');
  const manifest: unknown = JSON.parse(source);

  if (!isAssetManifest(manifest)) {
    throw new Error('Invalid generated landing asset manifest');
  }
  await Promise.all(
    Object.entries(manifest).map(async ([assetPath, expectedHash]) => {
      const actualHash = await getPathSha256(path.join(generatedDirectory, assetPath));
      if (actualHash !== expectedHash) {
        throw new Error(`Generated landing asset hash mismatch: ${assetPath}`);
      }
    }),
  );
}

function isAssetManifest(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([assetPath, hash]) => assetPath.startsWith('media/') && typeof hash === 'string')
  );
}

export async function listGeneratedMediaPaths(): Promise<string[]> {
  return (await readdir(generatedDirectory, { recursive: true }))
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.replace(/\\/g, '/'))
    .sort();
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-media.ts'))) {
  void verifyMediaAssets().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
