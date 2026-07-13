import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { localeRegistry } from '../content/locale-registry.js';

export const LANDING_PUBLIC_MEDIA_DIRECTORY = 'media';
export const LANDING_PUBLIC_CAPTIONS_DIRECTORY = 'captions';
export const LANDING_PUBLIC_ICONS_DIRECTORY = 'icons';

const STREAMING_EXTENSIONS = new Set(['.m3u8', '.m4s', '.mpd', '.ts']);
const STREAMING_PATH_SEGMENTS = new Set(['dash', 'hls', 'segments']);

export type HashManifestFile = {
  path: string;
  sha256: string;
};

export type HashManifest = {
  files: readonly HashManifestFile[];
};

export type MediaAssetContract = {
  captions: readonly string[];
  posterFileName: string;
  transcriptFiles: readonly string[];
  videoFileName: string;
};

export const requiredMediaAssets: MediaAssetContract = {
  videoFileName: 'demo.mp4',
  posterFileName: 'demo-poster.webp',
  captions: localeRegistry.map(({ tag }) => `${tag}.vtt`),
  transcriptFiles: localeRegistry.map(({ tag }) => `${tag}.txt`),
};

export function getFileSha256(source: Buffer | string): string {
  return createHash('sha256').update(source).digest('hex');
}

export async function getPathSha256(filePath: string): Promise<string> {
  return getFileSha256(await readFile(filePath));
}

export function isStreamingPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const extension = path.posix.extname(normalized);
  const segments = normalized.split('/');

  return STREAMING_EXTENSIONS.has(extension) || segments.some((segment) => STREAMING_PATH_SEGMENTS.has(segment));
}

export function getSafeRelativePath(rootDirectory: string, filePath: string): string {
  const relativePath = path.relative(rootDirectory, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset must be inside ${rootDirectory}: ${filePath}`);
  }
  return relativePath;
}

export async function assertFileExists(filePath: string): Promise<void> {
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new Error(`Expected a file: ${filePath}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Expected a file:')) {
      throw error;
    }
    throw new Error(`Required landing asset is missing: ${filePath}`, { cause: error });
  }
}

export async function assertManifestFileHash(rootDirectory: string, manifestFile: HashManifestFile): Promise<void> {
  const filePath = path.join(rootDirectory, manifestFile.path);
  getSafeRelativePath(rootDirectory, filePath);
  await assertFileExists(filePath);

  const actualHash = await getPathSha256(filePath);
  if (actualHash !== manifestFile.sha256) {
    throw new Error(`Landing asset hash mismatch: ${manifestFile.path}`);
  }
}

export async function readHashManifest(manifestPath: string): Promise<HashManifest> {
  const source = await readFile(manifestPath, 'utf8');
  const manifest: unknown = JSON.parse(source);

  if (!isHashManifest(manifest)) {
    throw new Error(`Invalid landing asset manifest: ${manifestPath}`);
  }
  return manifest;
}

function isHashManifest(value: unknown): value is HashManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'files' in value &&
    Array.isArray(value.files) &&
    value.files.every(isHashManifestFile)
  );
}

function isHashManifestFile(value: unknown): value is HashManifestFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof value.path === 'string' &&
    'sha256' in value &&
    typeof value.sha256 === 'string'
  );
}
