import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {
  getLocaleDefinition,
  publishedLocaleContent,
  publishedLocaleTags,
  type LandingContent,
  type LandingLocale,
} from '../content/index.js';

import {
  LANDING_PUBLIC_CAPTIONS_DIRECTORY,
  LANDING_PUBLIC_ICONS_DIRECTORY,
  LANDING_PUBLIC_MEDIA_DIRECTORY,
  assertFileExists,
  assertManifestFileHash,
  getPathSha256,
  isStreamingPath,
  readHashManifest,
  requiredMediaAssets,
} from './media-contract.js';

const execFile = promisify(execFileCallback);
const repositoryRoot = path.resolve(__dirname, '../../..');
const specificationAssets = path.join(repositoryRoot, 'docs/specs/github-pages-landing-page/assets');
const landingPublicDirectory = path.join(repositoryRoot, 'src/landing-page/public');
const generatedDirectory = path.join(landingPublicDirectory, 'generated');
const stagingDirectory = path.join(landingPublicDirectory, '.generated-staging');

type ApprovedSources = {
  demoDirectory: string;
  iconRasterSource: string;
  iconSource: string;
  interfaceIconDirectory: string;
  mainCapture: string;
  providerIconDirectory: string;
};

type ProbedVideo = {
  format?: { size?: string };
  streams?: Array<{
    codec_name?: string;
    codec_type?: string;
    height?: number;
    r_frame_rate?: string;
    width?: number;
  }>;
};

export async function syncPublicAssets(): Promise<void> {
  const sources = await collectApprovedSources();
  await rm(stagingDirectory, { force: true, recursive: true });
  await mkdir(stagingDirectory, { recursive: true });

  try {
    await copyApprovedAssets(sources, stagingDirectory);
    await rm(generatedDirectory, { force: true, recursive: true });
    await rename(stagingDirectory, generatedDirectory);
  } catch (error: unknown) {
    await rm(stagingDirectory, { force: true, recursive: true });
    throw error;
  }
}

export async function syncShellAssets(): Promise<void> {
  const captureManifest = await readHashManifest(path.join(specificationAssets, 'capture-manifest.json'));
  const mainCapture = captureManifest.files.find((file) => file.path === 'captures/app-main.png');

  if (!mainCapture) {
    throw new Error('The landing capture manifest must include captures/app-main.png');
  }

  await assertManifestFileHash(specificationAssets, mainCapture);

  const source = path.join(specificationAssets, mainCapture.path);
  const mediaDirectory = path.join(generatedDirectory, LANDING_PUBLIC_MEDIA_DIRECTORY);
  await mkdir(mediaDirectory, { recursive: true });
  await Promise.all([
    copyFile(source, path.join(mediaDirectory, 'app-main.png')),
    sharp(source).webp({ quality: 90 }).toFile(path.join(mediaDirectory, 'app-main.webp')),
    sharp(source).avif({ quality: 65 }).toFile(path.join(mediaDirectory, 'app-main.avif')),
  ]);
}

async function collectApprovedSources(): Promise<ApprovedSources> {
  const captureManifest = await readHashManifest(path.join(specificationAssets, 'capture-manifest.json'));
  const interfaceManifest = await readHashManifest(path.join(specificationAssets, 'interface-icons/manifest.json'));
  const providerManifest = await readHashManifest(path.join(specificationAssets, 'provider-icons/manifest.json'));
  const interfaceIconDirectory = path.join(specificationAssets, 'interface-icons');
  const providerIconDirectory = path.join(specificationAssets, 'provider-icons');
  const demoDirectory = path.join(specificationAssets, 'demo');
  const mainCapture = path.join(specificationAssets, 'captures/app-main.png');
  const iconRasterSource = path.join(repositoryRoot, 'assets/icon.png');
  const iconSource = path.join(repositoryRoot, 'assets/icon.svg');

  await Promise.all([
    ...captureManifest.files.map((file) => assertManifestFileHash(specificationAssets, file)),
    ...interfaceManifest.files.map((file) => assertManifestFileHash(interfaceIconDirectory, file)),
    ...providerManifest.files.map((file) => assertManifestFileHash(providerIconDirectory, file)),
    assertFileExists(iconRasterSource),
    assertFileExists(iconSource),
    assertFileExists(mainCapture),
  ]);
  await assertApprovedDemoAssets(demoDirectory);

  return { demoDirectory, iconRasterSource, iconSource, interfaceIconDirectory, mainCapture, providerIconDirectory };
}

async function assertApprovedDemoAssets(demoDirectory: string): Promise<void> {
  const videoPath = path.join(demoDirectory, requiredMediaAssets.videoFileName);
  const posterPath = path.join(demoDirectory, requiredMediaAssets.posterFileName);
  const captionsDirectory = path.join(demoDirectory, 'captions');
  const transcriptsDirectory = path.join(demoDirectory, 'transcripts');

  await Promise.all([
    assertFileExists(videoPath),
    assertFileExists(posterPath),
    assertFileExists(path.join(captionsDirectory, 'en.vtt')),
    assertFileExists(path.join(transcriptsDirectory, 'en.txt')),
  ]);
  await assertNoStreamingFiles(demoDirectory);
  await assertApprovedDemoVideo(videoPath);
}

const captionTimings = [
  ['00:00.000', '00:15.000'],
  ['00:15.000', '00:19.000'],
  ['00:19.000', '00:29.000'],
  ['00:29.000', '00:38.000'],
  ['00:38.000', '00:45.000'],
  ['00:45.000', '00:52.000'],
  ['00:52.000', '00:57.000'],
  ['00:57.000', '01:00.000'],
] as const;

function renderLocalizedCaptions(content: LandingContent): string {
  const descriptions = content.demo.transcriptCues.map((cue) => cue.visualDescription);

  return `WEBVTT\n\n${captionTimings
    .map(([start, end], index) => `${start} --> ${end}\n${descriptions[index] ?? content.demo.lead}`)
    .join('\n\n')}\n`;
}

function renderLocalizedTranscript(content: LandingContent): string {
  return `${content.demo.title}\n\n${content.demo.transcriptCues
    .map((cue) => `${cue.narration}\n${cue.visualDescription}`)
    .join('\n\n')}\n`;
}

export async function assertNoStreamingFiles(directory: string): Promise<void> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.isSymbolicLink() ||
      isStreamingPath(entry.parentPath ? path.join(entry.parentPath, entry.name) : entry.name)
    ) {
      throw new Error(`Streaming or linked media is not allowed: ${path.join(directory, entry.name)}`);
    }
  }
}

export async function assertMp4HasNoSubtitleStream(videoPath: string): Promise<void> {
  const { stdout } = await execFile('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type',
    '-of',
    'json',
    videoPath,
  ]);
  const report = JSON.parse(stdout) as ProbedVideo;

  if (report.streams?.some((stream) => stream.codec_type === 'subtitle')) {
    throw new Error(`Demo MP4 must not contain a subtitle stream: ${videoPath}`);
  }
}

export async function assertApprovedDemoVideo(videoPath: string): Promise<void> {
  const { stdout } = await execFile('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=size:stream=codec_name,codec_type,width,height,r_frame_rate',
    '-of',
    'json',
    videoPath,
  ]);
  const report = JSON.parse(stdout) as ProbedVideo;
  const videoStreams = report.streams?.filter((stream) => stream.codec_type === 'video') ?? [];
  const audioStreams = report.streams?.filter((stream) => stream.codec_type === 'audio') ?? [];
  const video = videoStreams[0];
  const audio = audioStreams[0];

  if (
    videoStreams.length !== 1 ||
    video?.codec_name !== 'h264' ||
    video.width !== 1920 ||
    video.height !== 1080 ||
    video.r_frame_rate !== '60/1'
  ) {
    throw new Error(`Demo MP4 must contain one 1920x1080 60-fps H.264 video stream: ${videoPath}`);
  }
  if (audioStreams.length !== 1 || audio?.codec_name !== 'aac') {
    throw new Error(`Demo MP4 must contain one AAC audio stream: ${videoPath}`);
  }
  if ((report.streams?.length ?? 0) !== 2) {
    throw new Error(`Demo MP4 may contain only video and audio streams: ${videoPath}`);
  }
  if (Number(report.format?.size) > 35 * 1024 * 1024) {
    throw new Error(`Demo MP4 exceeds the 35 MiB landing budget: ${videoPath}`);
  }

  const header = (await readFile(videoPath)).subarray(0, 1024 * 1024);
  if (!header.includes(Buffer.from('moov'))) {
    throw new Error(`Demo MP4 must be fast-start optimized: ${videoPath}`);
  }
}

async function copyApprovedAssets(sources: ApprovedSources, destination: string): Promise<void> {
  const mediaDirectory = path.join(destination, LANDING_PUBLIC_MEDIA_DIRECTORY);
  const captionsDirectory = path.join(destination, LANDING_PUBLIC_CAPTIONS_DIRECTORY);
  const iconsDirectory = path.join(destination, LANDING_PUBLIC_ICONS_DIRECTORY);
  const transcriptsDirectory = path.join(mediaDirectory, 'transcripts');
  await Promise.all([
    mkdir(mediaDirectory, { recursive: true }),
    mkdir(captionsDirectory, { recursive: true }),
    mkdir(iconsDirectory, { recursive: true }),
    mkdir(transcriptsDirectory, { recursive: true }),
  ]);

  await Promise.all([
    copyFile(sources.iconRasterSource, path.join(iconsDirectory, 'gpt-voice.png')),
    copyFile(sources.iconSource, path.join(iconsDirectory, 'gpt-voice.svg')),
    copyFile(sources.mainCapture, path.join(mediaDirectory, 'app-main.png')),
    copyDirectoryFiles(sources.interfaceIconDirectory, path.join(iconsDirectory, 'interface')),
    copyDirectoryFiles(sources.providerIconDirectory, path.join(iconsDirectory, 'providers')),
    copyFile(
      path.join(sources.demoDirectory, requiredMediaAssets.videoFileName),
      path.join(mediaDirectory, requiredMediaAssets.videoFileName),
    ),
    copyFile(
      path.join(sources.demoDirectory, requiredMediaAssets.posterFileName),
      path.join(mediaDirectory, requiredMediaAssets.posterFileName),
    ),
    copyFile(path.join(sources.demoDirectory, 'captions', 'en.vtt'), path.join(captionsDirectory, 'en.vtt')),
    copyFile(path.join(sources.demoDirectory, 'transcripts', 'en.txt'), path.join(transcriptsDirectory, 'en.txt')),
  ]);
  await Promise.all(
    publishedLocaleTags
      .filter((locale): locale is Exclude<LandingLocale, 'en'> => locale !== 'en')
      .map(async (locale) => {
        const content = publishedLocaleContent[locale];
        const fileStem = getLocaleDefinition(locale).routeSlug;
        await Promise.all([
          writeFile(path.join(captionsDirectory, `${fileStem}.vtt`), renderLocalizedCaptions(content), 'utf8'),
          writeFile(path.join(transcriptsDirectory, `${fileStem}.txt`), renderLocalizedTranscript(content), 'utf8'),
        ]);
      }),
  );

  await Promise.all([
    sharp(sources.mainCapture).webp({ quality: 90 }).toFile(path.join(mediaDirectory, 'app-main.webp')),
    sharp(sources.mainCapture).avif({ quality: 65 }).toFile(path.join(mediaDirectory, 'app-main.avif')),
  ]);
  await writeFile(
    path.join(destination, 'asset-manifest.json'),
    `${JSON.stringify(await createAssetManifest(destination), null, 2)}\n`,
  );
}

async function copyDirectoryFiles(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
      .map((entry) => copyFile(path.join(sourceDirectory, entry.name), path.join(destinationDirectory, entry.name))),
  );
}

async function createAssetManifest(destination: string): Promise<Record<string, string>> {
  const assetPaths = [
    path.join(LANDING_PUBLIC_MEDIA_DIRECTORY, 'app-main.png'),
    path.join(LANDING_PUBLIC_MEDIA_DIRECTORY, 'app-main.webp'),
    path.join(LANDING_PUBLIC_MEDIA_DIRECTORY, 'app-main.avif'),
    path.join(LANDING_PUBLIC_MEDIA_DIRECTORY, requiredMediaAssets.videoFileName),
    path.join(LANDING_PUBLIC_MEDIA_DIRECTORY, requiredMediaAssets.posterFileName),
  ];
  const hashes = await Promise.all(assetPaths.map((assetPath) => getPathSha256(path.join(destination, assetPath))));

  return Object.fromEntries(assetPaths.map((assetPath, index) => [assetPath, hashes[index]]));
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'sync-public-assets.ts'))) {
  const sync = process.argv.includes('--shell-only') ? syncShellAssets : syncPublicAssets;

  void sync().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
