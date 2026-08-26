import type { Stats } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';

interface VerifiedRegularFileInput {
  readonly filePath: string;
  readonly invalid: () => never;
  readonly maximumBytes: number;
  readonly minimumBytes?: number;
  readonly unavailable: () => never;
}

function hasNativeFileIdentity(metadata: Stats): boolean {
  return metadata.dev !== 0 && metadata.ino !== 0;
}

function hasPortableFileIdentity(metadata: Stats): boolean {
  return (
    Number.isFinite(metadata.birthtimeMs) &&
    metadata.birthtimeMs > 0 &&
    Number.isFinite(metadata.mtimeMs) &&
    metadata.mtimeMs >= 0
  );
}

export function hasSameVerifiedFileIdentity(expected: Stats, actual: Stats): boolean {
  if (hasNativeFileIdentity(expected) && hasNativeFileIdentity(actual)) {
    return expected.dev === actual.dev && expected.ino === actual.ino;
  }
  return (
    hasPortableFileIdentity(expected) &&
    hasPortableFileIdentity(actual) &&
    expected.size === actual.size &&
    expected.birthtimeMs === actual.birthtimeMs &&
    expected.mtimeMs === actual.mtimeMs
  );
}

function hasUnchangedMetadata(expected: Stats, actual: Stats): boolean {
  return (
    hasSameVerifiedFileIdentity(expected, actual) &&
    expected.size === actual.size &&
    expected.mtimeMs === actual.mtimeMs
  );
}

function isExpectedRegularFile(metadata: Stats, input: VerifiedRegularFileInput): boolean {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.size >= (input.minimumBytes ?? 0) &&
    metadata.size <= input.maximumBytes
  );
}

/** Reads or streams one stable, bounded regular file through an owned descriptor. */
export async function withVerifiedRegularFile<T>(
  input: VerifiedRegularFileInput,
  reader: (file: FileHandle, sizeBytes: number) => Promise<T>,
): Promise<T> {
  const file = await open(input.filePath, 'r').catch(input.unavailable);
  try {
    const opened = await file.stat().catch(input.unavailable);
    const expected = await lstat(input.filePath).catch(input.unavailable);
    if (
      !isExpectedRegularFile(opened, input) ||
      !isExpectedRegularFile(expected, input) ||
      !hasSameVerifiedFileIdentity(expected, opened)
    ) {
      input.invalid();
    }

    const result = await reader(file, expected.size);
    const finalMetadata = await file.stat().catch(input.unavailable);
    const finalPathMetadata = await lstat(input.filePath).catch(input.unavailable);
    if (
      !hasUnchangedMetadata(opened, finalMetadata) ||
      !hasUnchangedMetadata(expected, finalPathMetadata) ||
      !hasSameVerifiedFileIdentity(finalMetadata, finalPathMetadata)
    ) {
      input.invalid();
    }
    return result;
  } finally {
    await file.close().catch(() => undefined);
  }
}
