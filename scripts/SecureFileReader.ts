import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';

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

export interface VerifiedRegularFileDigest {
  readonly sha256: string;
  readonly sizeBytes: number;
}

async function consumeVerifiedRegularFile<T>(
  filePath: string,
  consume: (handle: FileHandle) => Promise<T>,
): Promise<Readonly<{ readonly result: T; readonly sizeBytes: number }>> {
  const handle = await open(filePath, 'r');
  try {
    const opened = await handle.stat();
    const linked = await lstat(filePath);
    if (!opened.isFile() || !linked.isFile() || linked.isSymbolicLink() || !hasSameFileIdentity(opened, linked)) {
      throw new Error('Opened file identity cannot be verified');
    }
    const result = await consume(handle);
    const confirmed = await handle.stat();
    if (!hasUnchangedFileMetadata(opened, confirmed)) throw new Error('Opened file changed while being read');
    return Object.freeze({ result, sizeBytes: confirmed.size });
  } finally {
    await handle.close();
  }
}

/** Reads one final regular file through an already-open descriptor and verifies the path still resolves to it. */
export async function readVerifiedRegularFile(filePath: string): Promise<VerifiedRegularFile> {
  const consumed = await consumeVerifiedRegularFile(filePath, async (handle) => Buffer.from(await handle.readFile()));
  return Object.freeze({ bytes: consumed.result, sizeBytes: consumed.sizeBytes });
}

/** Streams one final regular file through an already-open descriptor and verifies its stable SHA-256 identity. */
export async function sha256VerifiedRegularFile(filePath: string): Promise<VerifiedRegularFileDigest> {
  const consumed = await consumeVerifiedRegularFile(filePath, async (handle) => {
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      const bytes: unknown = chunk;
      if (!(bytes instanceof Uint8Array)) throw new Error('Opened file produced a non-binary chunk');
      hash.update(bytes);
    }
    return hash.digest('hex');
  });
  return Object.freeze({ sha256: consumed.result, sizeBytes: consumed.sizeBytes });
}
