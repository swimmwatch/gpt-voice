import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RELEASE_BUNDLE_FILES } from './constants.mjs';

const BUNDLE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export async function releaseBundleDigest() {
  const hash = createHash('sha256');
  for (const fileName of RELEASE_BUNDLE_FILES) {
    const contents = await readFile(path.join(BUNDLE_DIRECTORY, fileName));
    hash.update(fileName);
    hash.update('\0');
    hash.update(String(contents.byteLength));
    hash.update('\0');
    hash.update(contents);
  }
  return hash.digest('hex');
}

export async function assertReleaseBundleDigest(expected) {
  if (!/^[a-f\d]{64}$/u.test(expected) || (await releaseBundleDigest()) !== expected) {
    throw new Error('release-bundle-integrity-failed');
  }
}
