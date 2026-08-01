import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  LocalWhisperArtifactLifecycleError,
  type ArtifactEntryType,
  type LocalWhisperArtifactDownloadSpec,
  type StreamingArtifactEntry,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { StreamingArtifactExtractor } from '@main/localWhisper/artifacts/StreamingArtifactExtractor';
import type { ManagedArtifactExpectedFile } from '@main/localWhisper/filesystem/ManagedArtifactStore';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { MODEL_FILE, createArtifactServiceHarness, entry, sha256 } from './artifactTestUtils';

const SECOND_FILE = Buffer.from('second fixture model file', 'utf8');

function secondExpectedFile(fileId = 'second-model-file'): ManagedArtifactExpectedFile {
  const parsed = toLocalWhisperArtifactId(fileId);
  assert.ok(parsed);
  return Object.freeze({
    fileId: parsed,
    kind: 'data',
    mode: 0o600,
    sha256: sha256(SECOND_FILE),
    sizeBytes: SECOND_FILE.byteLength,
  });
}

function withExpectedFiles(
  base: LocalWhisperArtifactDownloadSpec,
  expectedFiles: readonly ManagedArtifactExpectedFile[],
): LocalWhisperArtifactDownloadSpec {
  return Object.freeze({
    ...base,
    descriptor: Object.freeze({ ...base.descriptor, expectedFiles: Object.freeze([...expectedFiles]) }),
    expandedSizeBytes: expectedFiles.reduce((total, file) => total + file.sizeBytes, 0),
    expectedFiles: Object.freeze([...expectedFiles]),
  });
}

async function* noChunks(): AsyncIterable<Uint8Array> {
  for (const chunk of [] as Uint8Array[]) yield chunk;
}

async function* oneChunk(value: Uint8Array): AsyncIterable<Uint8Array> {
  yield value;
}

async function expectArchiveInvalid(
  spec: LocalWhisperArtifactDownloadSpec,
  entries: readonly StreamingArtifactEntry[],
): Promise<void> {
  const harness = createArtifactServiceHarness();
  harness.store.installed.add(harness.catalogFixture.runtime.artifactId);
  await assert.rejects(
    new StreamingArtifactExtractor(harness.store).install(spec, entries, new AbortController().signal),
    (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'ARCHIVE_INVALID',
  );
  assert.deepEqual(harness.store.installed, new Set([harness.catalogFixture.runtime.artifactId]));
  assert.equal(harness.store.promotions, 0);
}

describe('StreamingArtifactExtractor manifest-first boundary', () => {
  test('rejects traversal, absolute paths, and undeclared names before staging', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    for (const name of ['../outside', '/absolute', String.raw`C:\absolute`, 'unexpected-file']) {
      await expectArchiveInvalid(base, [entry(name, MODEL_FILE)]);
    }
  });

  test('rejects duplicate and case-colliding entries', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const second = secondExpectedFile();
    const duplicateSpec = withExpectedFiles(base, [...base.expectedFiles, second]);
    await expectArchiveInvalid(duplicateSpec, [
      entry(base.expectedFiles[0].fileId, MODEL_FILE),
      entry(base.expectedFiles[0].fileId, SECOND_FILE),
    ]);

    const caseId = String(base.expectedFiles[0].fileId).toUpperCase();
    const caseSpec = withExpectedFiles(base, [...base.expectedFiles, secondExpectedFile(caseId)]);
    await expectArchiveInvalid(caseSpec, [entry(base.expectedFiles[0].fileId, MODEL_FILE), entry(caseId, SECOND_FILE)]);
  });

  test('rejects every link, special-file, and sparse entry type', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const unsupportedTypes: readonly ArtifactEntryType[] = [
      'directory',
      'symlink',
      'hardlink',
      'junction',
      'fifo',
      'socket',
      'device',
      'sparse',
    ];
    for (const type of unsupportedTypes) {
      await expectArchiveInvalid(base, [entry(base.expectedFiles[0].fileId, MODEL_FILE, { type })]);
    }
  });

  test('rejects wrong mode, declared size, declared hash, and expanded-size evidence', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const expected = base.expectedFiles[0];
    await expectArchiveInvalid(base, [entry(expected.fileId, MODEL_FILE, { mode: 0o755 })]);
    await expectArchiveInvalid(base, [entry(expected.fileId, MODEL_FILE, { sizeBytes: MODEL_FILE.byteLength + 1 })]);
    await expectArchiveInvalid(base, [entry(expected.fileId, MODEL_FILE, { sha256: sha256(Buffer.from('wrong')) })]);
    await expectArchiveInvalid(Object.freeze({ ...base, expandedSizeBytes: base.expandedSizeBytes + 1 }), [
      entry(expected.fileId, MODEL_FILE),
    ]);
  });

  test('streams and independently rejects truncated or content-mismatched declared files', async () => {
    const base = createArtifactServiceHarness().catalogFixture.model;
    const valid = entry(base.expectedFiles[0].fileId, MODEL_FILE);
    await expectArchiveInvalid(base, [{ ...valid, chunks: noChunks() }]);

    const wrongContents = Buffer.alloc(MODEL_FILE.byteLength, 0x78);
    await expectArchiveInvalid(base, [
      {
        ...valid,
        chunks: oneChunk(wrongContents),
        sha256: base.expectedFiles[0].sha256,
      },
    ]);
  });
});
