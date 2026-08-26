import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import type { LoadedLinuxQualificationEvidence } from '@scripts/local-whisper/qualification/LinuxQualificationEvidenceLoader';
import {
  FocusedLinuxPerformancePrivateInputPreflight,
  LinuxPerformancePrivateInputPreflight,
  snapshotLinuxPerformanceCache,
} from '@scripts/local-whisper/qualification/LinuxPerformancePrivateInputs';

function loadedEvidence(): LoadedLinuxQualificationEvidence {
  return {
    cachedModels: [{ sizeBytes: 10, sha256: '1'.repeat(64) }],
    candidateCorpus: { manifestDigest: '2'.repeat(64), noticeDigest: '3'.repeat(64) },
    directEngineArtifacts: [
      {
        backend: 'cpu',
        binarySha256: '4'.repeat(64),
        manifestDigest: '5'.repeat(64),
        sourceCommit: '6'.repeat(40),
        toolchainDigest: '7'.repeat(64),
      },
    ],
    modelNoticeDigest: '8'.repeat(64),
    modelSetManifestDigest: '9'.repeat(64),
    runtimes: [
      {
        directEngineBinarySha256: 'a'.repeat(64),
        directEngineManifestDigest: 'b'.repeat(64),
        profileId: 'linux-cpu',
        toolchainDigest: 'c'.repeat(64),
      },
    ],
  } as unknown as LoadedLinuxQualificationEvidence;
}

async function fixtureRoot(): Promise<{
  readonly root: string;
  readonly cache: string;
  readonly parent: string;
  readonly child: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-private-inputs-'));
  const cache = path.join(root, 'cache');
  const parent = path.join(root, 'private');
  const child = path.join(parent, 'run');
  await Promise.all([mkdir(path.join(cache, 'nested'), { recursive: true }), mkdir(parent, { mode: 0o700 })]);
  await chmod(parent, 0o700);
  await Promise.all([
    writeFile(path.join(cache, 'manifest.json'), '{"schemaVersion":1}\n'),
    writeFile(path.join(cache, 'nested', 'artifact.bin'), Buffer.from('artifact')),
  ]);
  return { root, cache, parent, child };
}

describe('Linux performance private input preflight', { skip: process.platform !== 'linux' }, () => {
  it('rejects a focused cache whose Base file is not the pinned artifact without loading the retired cache', async () => {
    if (process.platform !== 'linux') return;
    const fixture = await fixtureRoot();
    try {
      await writeFile(path.join(fixture.cache, 'ggml-base.bin'), Buffer.alloc(1));
      await writeFile(
        path.join(fixture.cache, 'qualification-input.wav'),
        Buffer.concat([Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'binary'), Buffer.alloc(32)]),
      );
      await assert.rejects(
        new FocusedLinuxPerformancePrivateInputPreflight().verify({
          workspaceRoot: path.resolve('.'),
          cacheRoot: fixture.cache,
          privateParent: fixture.parent,
          privateRunRoot: fixture.child,
        }),
        /FOCUSED_PRIVATE_INPUT_MODEL_INVALID/u,
      );
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('snapshots a populated cache, invokes the evidence loader read-only, and keeps the private child absent', async () => {
    if (process.platform !== 'linux') return;
    const fixture = await fixtureRoot();
    try {
      let loads = 0;
      const preflight = new LinuxPerformancePrivateInputPreflight({
        load: async (cacheRoot, workspaceRoot) => {
          loads += 1;
          assert.equal(cacheRoot, fixture.cache);
          assert.equal(workspaceRoot, path.resolve('.'));
          return loadedEvidence();
        },
      });
      const proof = await preflight.verify({
        workspaceRoot: path.resolve('.'),
        cacheRoot: fixture.cache,
        privateParent: fixture.parent,
        privateRunRoot: fixture.child,
      });
      assert.equal(loads, 1);
      assert.equal(proof.cacheSnapshot.fileCount, 2);
      assert.match(proof.cacheSnapshot.digest, /^[a-f0-9]{64}$/u);
      assert.match(proof.evidenceIdentityDigest, /^[a-f0-9]{64}$/u);
      await assert.rejects(lstat(fixture.child));
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });

  it('rejects cache mutation, symlinks, empty roots, existing children, and non-private parents', async () => {
    if (process.platform !== 'linux') return;
    const failures: string[] = [];
    for (const kind of ['mutation', 'symlink', 'empty', 'existingChild', 'parentMode'] as const) {
      const fixture = await fixtureRoot();
      try {
        if (kind === 'symlink')
          await symlink(path.join(fixture.cache, 'manifest.json'), path.join(fixture.cache, 'link'));
        if (kind === 'empty') {
          await rm(fixture.cache, { force: true, recursive: true });
          await mkdir(fixture.cache);
        }
        if (kind === 'existingChild') await mkdir(fixture.child);
        if (kind === 'parentMode') await chmod(fixture.parent, 0o755);
        const preflight = new LinuxPerformancePrivateInputPreflight({
          load: async () => {
            if (kind === 'mutation') await writeFile(path.join(fixture.cache, 'manifest.json'), 'changed');
            return loadedEvidence();
          },
        });
        await assert.rejects(
          preflight.verify({
            workspaceRoot: path.resolve('.'),
            cacheRoot: fixture.cache,
            privateParent: fixture.parent,
            privateRunRoot: fixture.child,
          }),
          (error: unknown) => {
            failures.push(String(error));
            return /PRIVATE_(?:INPUT|RUN)_/u.test(String(error));
          },
        );
      } finally {
        await rm(fixture.root, { force: true, recursive: true });
      }
    }
    assert.doesNotMatch(failures.join('\n'), /local-whisper-private-inputs|manifest\.json/u);
  });

  it('produces a stable digest and detects byte changes without exposing manifest paths', async () => {
    const fixture = await fixtureRoot();
    try {
      const first = await snapshotLinuxPerformanceCache(fixture.cache);
      const second = await snapshotLinuxPerformanceCache(fixture.cache);
      assert.deepEqual(second, first);
      await writeFile(path.join(fixture.cache, 'nested', 'artifact.bin'), Buffer.from('ARTIFACT'));
      const changed = await snapshotLinuxPerformanceCache(fixture.cache);
      assert.notEqual(changed.digest, first.digest);
      assert.doesNotMatch(JSON.stringify(changed), /nested|artifact\.bin/u);
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });
});
