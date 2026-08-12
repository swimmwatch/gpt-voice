import { closeSync, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';

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

/** Reads one final regular file through an already-open descriptor and verifies the path still resolves to it. */
export function readVerifiedRegularFileSync(filePath) {
  const descriptor = openSync(filePath, 'r');
  try {
    const opened = fstatSync(descriptor);
    const linked = lstatSync(filePath);
    if (!opened.isFile() || !linked.isFile() || linked.isSymbolicLink() || !sameFileIdentity(opened, linked)) {
      throw new Error('Opened file identity cannot be verified');
    }
    const bytes = readFileSync(descriptor);
    const confirmed = fstatSync(descriptor);
    if (!hasUnchangedFileMetadata(opened, confirmed)) throw new Error('Opened file changed while being read');
    return Object.freeze({ bytes, stat: confirmed });
  } finally {
    closeSync(descriptor);
  }
}
