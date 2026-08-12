import type { Stats } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

function hasNativeFileIdentity(value: Stats): boolean {
  return value.dev !== 0 && value.ino !== 0;
}

function hasSameFileIdentity(left: Stats, right: Stats): boolean {
  if (hasNativeFileIdentity(left) && hasNativeFileIdentity(right)) {
    return left.dev === right.dev && left.ino === right.ino;
  }
  return left.size === right.size && left.ctimeMs === right.ctimeMs && left.mtimeMs === right.mtimeMs;
}

function hasUnchangedFileMetadata(left: Stats, right: Stats): boolean {
  return (
    hasSameFileIdentity(left, right) &&
    left.size === right.size &&
    left.ctimeMs === right.ctimeMs &&
    left.mtimeMs === right.mtimeMs
  );
}

export interface VerifiedRegularFile {
  readonly bytes: Buffer;
  readonly sizeBytes: number;
}

/** Reads one final regular file through an already-open descriptor and verifies the path still resolves to it. */
export async function readVerifiedRegularFile(filePath: string): Promise<VerifiedRegularFile> {
  const handle = await open(filePath, 'r');
  try {
    const opened = await handle.stat();
    const linked = await lstat(filePath);
    if (!opened.isFile() || !linked.isFile() || linked.isSymbolicLink() || !hasSameFileIdentity(opened, linked)) {
      throw new Error('Opened file identity cannot be verified');
    }
    const bytes = Buffer.from(await handle.readFile());
    const confirmed = await handle.stat();
    if (!hasUnchangedFileMetadata(opened, confirmed)) throw new Error('Opened file changed while being read');
    return Object.freeze({ bytes, sizeBytes: confirmed.size });
  } finally {
    await handle.close();
  }
}
