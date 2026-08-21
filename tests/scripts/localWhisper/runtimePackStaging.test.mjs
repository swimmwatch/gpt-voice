import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  runtimePackFileEvidence,
  writeRuntimePackJson,
} from '../../../scripts/local-whisper/runtime-pack-staging.mjs';
import { canonicalCatalogJson, sha256 } from '../../../scripts/local-whisper/source-import/native-source-core.mjs';

describe('runtime-pack staging files', () => {
  let root;
  let filePath;

  before(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-runtime-pack-staging-'));
    filePath = path.join(root, 'manifest.json');
    writeRuntimePackJson(filePath, { schemaId: 'test-v1', entries: ['one'] });
  });

  after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('writes the canonical runtime-pack JSON representation', async () => {
    assert.equal(
      await readFile(filePath, 'utf8'),
      canonicalCatalogJson({ schemaId: 'test-v1', entries: ['one'] }),
    );
  });

  it('returns frozen evidence from the verified file bytes and metadata', async () => {
    const [bytes, metadata] = await Promise.all([readFile(filePath), stat(filePath)]);

    const evidence = runtimePackFileEvidence(root, 'manifest.json', 'manifest');

    assert.deepEqual(evidence, {
      id: 'manifest',
      mode: metadata.mode & 0o777,
      relativePath: 'manifest.json',
      sha256: sha256(bytes),
      sizeBytes: metadata.size,
    });
    assert.equal(Object.isFrozen(evidence), true);
  });
});
