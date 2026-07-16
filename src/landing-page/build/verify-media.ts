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
import { assertApprovedDemoVideo, assertNoStreamingFiles } from './sync-public-assets.js';

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
    assertApprovedDemoVideo(videoPath),
    assertScreenshotGeometry(mediaDirectory),
    assertCaptionFiles(captionsDirectory),
    assertTranscriptFiles(transcriptsDirectory),
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
    assertCaptionCueTiming(caption, requiredMediaAssets.captions[index] ?? 'caption');
  }
}

async function assertTranscriptFiles(transcriptsDirectory: string): Promise<void> {
  const transcripts = await Promise.all(
    requiredMediaAssets.transcriptFiles.map((fileName) => readFile(path.join(transcriptsDirectory, fileName), 'utf8')),
  );

  for (const [index, transcript] of transcripts.entries()) {
    const fileName = requiredMediaAssets.transcriptFiles[index] ?? 'transcript';

    if (transcript.trim().length === 0) {
      throw new Error(`Localized transcript is empty: ${fileName}`);
    }
    if (transcript !== transcript.normalize('NFC')) {
      throw new Error(`Localized transcript must use NFC text: ${fileName}`);
    }
  }
}

export function assertEnglishMediaText(source: string, fileName: string): void {
  if (/\p{Script=Cyrillic}/u.test(source)) {
    throw new Error(`English landing media must not render Cyrillic text: ${fileName}`);
  }
}

export function assertCaptionCueTiming(source: string, fileName: string): void {
  const cueMatches = source.matchAll(/^(\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}\.\d{3})$/gm);
  let previousEnd = -1;
  let cueCount = 0;

  for (const [, start, end] of cueMatches) {
    const startMilliseconds = getTimestampMilliseconds(start ?? '');
    const endMilliseconds = getTimestampMilliseconds(end ?? '');

    if (startMilliseconds >= endMilliseconds || startMilliseconds < previousEnd) {
      throw new Error(`WebVTT cue timing must be ordered and non-overlapping: ${fileName}`);
    }
    previousEnd = endMilliseconds;
    cueCount += 1;
  }

  if (cueCount === 0) {
    throw new Error(`WebVTT caption file has no timed cues: ${fileName}`);
  }
}

function getTimestampMilliseconds(timestamp: string): number {
  const [minutes, seconds] = timestamp.split(':');

  return (Number(minutes) * 60 + Number(seconds)) * 1000;
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
