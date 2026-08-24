import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { validateRelativePath } from '../source-import/native-source-core.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveDestination(root, relativePath) {
  validateRelativePath(relativePath);
  const destination = resolve(root, ...relativePath.split('/'));
  const child = relative(root, destination);
  assert(
    child.length > 0 && !child.startsWith('..') && !isAbsolute(child),
    'Verified raw-file destination escaped root',
  );
  return destination;
}

function createBoundedParent(root, destination) {
  const relativeParent = relative(root, dirname(destination));
  assert(
    relativeParent.length === 0 || (!relativeParent.startsWith('..') && !isAbsolute(relativeParent)),
    'Verified raw-file parent escaped root',
  );
  let current = root;
  for (const segment of relativeParent.split(sep).filter((value) => value.length > 0)) {
    const next = resolve(current, segment);
    if (existsSync(next)) {
      const metadata = lstatSync(next);
      assert(
        metadata.isDirectory() && !metadata.isSymbolicLink(),
        'Verified raw-file parent is not an owned directory',
      );
    } else {
      mkdirSync(next, { mode: 0o700 });
    }
    current = realpathSync(next);
    assert(relative(root, current).startsWith('..') === false, 'Verified raw-file parent escaped root');
  }
  return current;
}

function writeVerifiedDestination(destination, bytes, sizeBytes) {
  let descriptor;
  try {
    descriptor = openSync(destination, 'wx', 0o600);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      assert(written > 0, 'Verified raw-file destination write failed');
      offset += written;
    }
    fsyncSync(descriptor);
    const metadata = fstatSync(descriptor);
    assert(
      metadata.isFile() && metadata.size === sizeBytes,
      'Verified raw-file destination is not the expected regular file',
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function verifySource(source) {
  assert(source && typeof source === 'object' && !Array.isArray(source), 'Verified raw-file source is invalid');
  assert(typeof source.path === 'string', 'Verified raw-file destination is invalid');
  assert(Number.isSafeInteger(source.sizeBytes) && source.sizeBytes > 0, 'Verified raw-file size is invalid');
  assert(
    typeof source.sha256 === 'string' && SHA256_PATTERN.test(source.sha256),
    'Verified raw-file digest is invalid',
  );
  assert(typeof source.url === 'string', 'Verified raw-file URL is invalid');
  let url;
  try {
    url = new URL(source.url);
  } catch {
    throw new Error('Verified raw-file URL is invalid');
  }
  assert(
    url.protocol === 'https:' &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.search.length === 0 &&
      url.hash.length === 0,
    'Verified raw-file URL is not an exact HTTPS origin',
  );
}

/** Materializes one exact HTTPS object into a fresh bounded destination without redirect authority. */
export class VerifiedRawFileMaterializer {
  constructor({ fetcher = globalThis.fetch } = {}) {
    assert(typeof fetcher === 'function', 'Verified raw-file fetcher is unavailable');
    this.fetcher = fetcher;
  }

  async materialize({ source, root }) {
    verifySource(source);
    assert(typeof root === 'string' && isAbsolute(root) && existsSync(root), 'Verified raw-file root is unavailable');
    const canonicalRoot = realpathSync(root);
    assert(lstatSync(canonicalRoot).isDirectory(), 'Verified raw-file root is not a directory');
    const destination = resolveDestination(canonicalRoot, source.path);
    assert(!existsSync(destination), 'Verified raw-file destination is not fresh');

    let response;
    try {
      response = await this.fetcher(source.url, { redirect: 'error' });
    } catch {
      throw new Error('Verified raw-file download failed');
    }
    assert(response && typeof response === 'object' && response.ok === true, 'Verified raw-file download failed');
    assert(typeof response.arrayBuffer === 'function', 'Verified raw-file response is invalid');
    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch {
      throw new Error('Verified raw-file response is invalid');
    }
    assert(bytes.byteLength === source.sizeBytes, 'Verified raw-file size mismatch');
    assert(sha256(bytes) === source.sha256, 'Verified raw-file digest mismatch');

    createBoundedParent(canonicalRoot, destination);
    writeVerifiedDestination(destination, bytes, source.sizeBytes);
    return Object.freeze({ path: destination, sha256: source.sha256, sizeBytes: source.sizeBytes });
  }
}
