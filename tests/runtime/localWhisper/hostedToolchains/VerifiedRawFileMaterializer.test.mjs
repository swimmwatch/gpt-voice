import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { loadNinjaLicenseLock } from '../../../../scripts/local-whisper/native-build/provision-ninja-license.mjs';
import { VerifiedRawFileMaterializer } from '../../../../scripts/local-whisper/native-build/verified-raw-file-materializer.mjs';

function source(bytes = Buffer.from('locked license\n', 'utf8')) {
  return {
    path: 'licenses/locked-license.txt',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.byteLength,
    url: 'https://licenses.example.invalid/locked-license.txt',
  };
}

function response(bytes, ok = true) {
  return { arrayBuffer: async () => bytes, ok };
}

function root() {
  const path = mkdtempSync(resolve(tmpdir(), 'local-whisper-verified-raw-file-'));
  mkdirSync(resolve(path, 'toolchains'));
  return resolve(path, 'toolchains');
}

test('loads the commit-pinned canonical Ninja 1.12.1 license identity', () => {
  assert.deepEqual(loadNinjaLicenseLock(), {
    lockId: 'ninja-1.12.1-license-v1',
    source: {
      path: 'ninja-1.12.1/COPYING',
      sha256: 'eb7e9ab9690124c5c9f42bdc81383d886a3dede26345b6ed15bbad7caf81f7ea',
      sizeBytes: 11358,
      url: 'https://raw.githubusercontent.com/ninja-build/ninja/2daa09ba270b0a43e1929d29b073348aa985dfaa/COPYING',
    },
  });
});

test('materializes an exact unredirected HTTPS object into a fresh bounded path', async () => {
  const bytes = Buffer.from('locked license\n', 'utf8');
  const destinationRoot = root();
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://licenses.example.invalid/locked-license.txt');
    assert.deepEqual(options, { redirect: 'error' });
    return response(bytes);
  };

  const result = await new VerifiedRawFileMaterializer({ fetcher }).materialize({
    root: destinationRoot,
    source: source(bytes),
  });

  assert.equal(result.path, resolve(destinationRoot, 'licenses', 'locked-license.txt'));
  assert.deepEqual(readFileSync(result.path), bytes);
  await assert.rejects(
    () => new VerifiedRawFileMaterializer({ fetcher }).materialize({ root: destinationRoot, source: source(bytes) }),
    /destination is not fresh/u,
  );
});

test('rejects redirects, tampered bytes, and paths outside the declared root', async () => {
  const destinationRoot = root();
  const bytes = Buffer.from('locked license\n', 'utf8');
  const materializer = new VerifiedRawFileMaterializer({
    fetcher: async () => response(bytes, false),
  });
  await assert.rejects(
    () => materializer.materialize({ root: destinationRoot, source: source(bytes) }),
    /download failed/u,
  );
  assert.equal(existsSync(resolve(destinationRoot, 'licenses', 'locked-license.txt')), false);

  const tampered = new VerifiedRawFileMaterializer({
    fetcher: async () => response(Buffer.from('tampered\n', 'utf8')),
  });
  await assert.rejects(() => tampered.materialize({ root: destinationRoot, source: source(bytes) }), /size mismatch/u);

  const escaped = { ...source(bytes), path: '../escaped-license.txt' };
  await assert.rejects(
    () =>
      new VerifiedRawFileMaterializer({ fetcher: async () => response(bytes) }).materialize({
        root: destinationRoot,
        source: escaped,
      }),
    /Unsafe native source path/u,
  );
});
