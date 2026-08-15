import { Buffer } from 'node:buffer';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync } from 'node:fs';

function sameFileIdentity(left, right) {
  if (left.dev !== 0 && left.ino !== 0 && right.dev !== 0 && right.ino !== 0) {
    return left.dev === right.dev && left.ino === right.ino;
  }
  return left.size === right.size && left.ctimeMs === right.ctimeMs && left.mtimeMs === right.mtimeMs;
}

function hasUnchangedFileMetadata(left, right) {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.ctimeMs === right.ctimeMs &&
    left.mtimeMs === right.mtimeMs
  );
}

function validatedMaximumBytes(options) {
  if (options === undefined) return null;
  if (
    typeof options !== 'object' ||
    options === null ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== 'maximumBytes')
  ) {
    throw new Error('Verified file reader options are invalid');
  }
  if (options.maximumBytes === undefined) return null;
  if (!Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 1) {
    throw new Error('Verified file maximum bytes is invalid');
  }
  return options.maximumBytes;
}

function readBoundedFileSync(descriptor, expectedSize) {
  const bytes = Buffer.allocUnsafe(expectedSize);
  let offset = 0;
  while (offset < expectedSize) {
    const bytesRead = readSync(descriptor, bytes, offset, expectedSize - offset, offset);
    if (bytesRead === 0) throw new Error('Opened file changed while being read');
    offset += bytesRead;
  }
  const probe = Buffer.allocUnsafe(1);
  if (readSync(descriptor, probe, 0, probe.length, expectedSize) !== 0) {
    throw new Error('Opened file changed while being read');
  }
  return bytes;
}

/** Reads one final regular file through an already-open descriptor and verifies the path still resolves to it. */
export function readVerifiedRegularFileSync(filePath, options = undefined) {
  const maximumBytes = validatedMaximumBytes(options);
  const descriptor = openSync(filePath, 'r');
  try {
    const opened = fstatSync(descriptor);
    const linked = lstatSync(filePath);
    if (!opened.isFile() || !linked.isFile() || linked.isSymbolicLink() || !sameFileIdentity(opened, linked)) {
      throw new Error('Opened file identity cannot be verified');
    }
    if (maximumBytes !== null && opened.size > maximumBytes) {
      throw new Error('Opened file exceeds maximum bytes');
    }
    const bytes = maximumBytes === null ? readFileSync(descriptor) : readBoundedFileSync(descriptor, opened.size);
    const confirmed = fstatSync(descriptor);
    if (!hasUnchangedFileMetadata(opened, confirmed)) throw new Error('Opened file changed while being read');
    return Object.freeze({ bytes, stat: confirmed });
  } finally {
    closeSync(descriptor);
  }
}
