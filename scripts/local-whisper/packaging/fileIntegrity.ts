import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import { isSafeRelativePath, isSha256, type LocalWhisperBundleFile } from './contracts';
import { readVerifiedRegularFile } from '../../SecureFileReader';

const MAX_JSON_BYTES = 4 * 1024 * 1024;

export function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  return sha256Bytes((await readVerifiedRegularFile(filePath)).bytes);
}

export async function readCanonicalJson(filePath: string): Promise<unknown> {
  const { bytes, sizeBytes } = await readVerifiedRegularFile(filePath);
  if (sizeBytes <= 0 || sizeBytes > MAX_JSON_BYTES) {
    throw new Error(`Invalid bounded JSON file: ${path.basename(filePath)}`);
  }
  const text = bytes.toString('utf8');
  const value = JSON.parse(text) as unknown;
  if (serializeCanonicalLocalWhisperCatalogJson(value) !== text) {
    throw new Error(`Noncanonical JSON file: ${path.basename(filePath)}`);
  }
  return value;
}

export async function writeCanonicalJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, serializeCanonicalLocalWhisperCatalogJson(value), { encoding: 'utf8', mode: 0o600 });
}

export async function inspectFlatDirectory(
  directory: string,
  excludedPaths: readonly string[] = [],
): Promise<LocalWhisperBundleFile[]> {
  const excluded = new Set(excludedPaths);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: LocalWhisperBundleFile[] = [];
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    if (!entry.isFile() || entry.isSymbolicLink() || !isSafeRelativePath(entry.name)) {
      throw new Error(`Unsafe Local Whisper bundle entry: ${entry.name}`);
    }
    const filePath = path.join(directory, entry.name);
    const { bytes, sizeBytes } = await readVerifiedRegularFile(filePath);
    if (sizeBytes <= 0 || !Number.isSafeInteger(sizeBytes)) {
      throw new Error(`Invalid Local Whisper bundle file: ${entry.name}`);
    }
    files.push(Object.freeze({ path: entry.name, sizeBytes, sha256: sha256Bytes(bytes) }));
  }
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

export function assertManifestFilesEqual(
  expected: readonly LocalWhisperBundleFile[],
  actual: readonly LocalWhisperBundleFile[],
): void {
  if (expected.length !== actual.length) throw new Error('Local Whisper bundle file count mismatch');
  for (let index = 0; index < expected.length; index += 1) {
    const expectedFile = expected[index];
    const actualFile = actual[index];
    if (
      expectedFile.path !== actualFile.path ||
      expectedFile.sizeBytes !== actualFile.sizeBytes ||
      expectedFile.sha256 !== actualFile.sha256 ||
      !isSha256(expectedFile.sha256)
    ) {
      throw new Error(`Local Whisper bundle integrity mismatch: ${expectedFile.path}`);
    }
  }
}
