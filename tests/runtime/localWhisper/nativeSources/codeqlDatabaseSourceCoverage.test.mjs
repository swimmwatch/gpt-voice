import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  assertCodeqlDatabaseSourceCoverage,
  codeqlDatabaseSources,
  codeqlDatabaseSourceSha256,
  workspaceSourceSha256,
} from '../../../../scripts/local-whisper/native-build/codeql-database-source-coverage.mjs';

const manifest = Object.freeze([
  Object.freeze({
    kind: 'translation-unit',
    path: 'runtime/local-whisper/common/src/a.cpp',
    platforms: ['linux', 'windows'],
  }),
  Object.freeze({ kind: 'translation-unit', path: 'runtime/local-whisper/launcher/src/b.cpp', platforms: ['linux'] }),
  Object.freeze({
    kind: 'translation-unit',
    path: 'runtime/local-whisper/launcher/src/windows.cpp',
    platforms: ['windows'],
  }),
  Object.freeze({
    kind: 'header',
    path: 'runtime/local-whisper/common/include/a.hpp',
    platforms: ['linux', 'windows'],
  }),
]);

const workspaceSources = Object.freeze({
  'runtime/local-whisper/common/src/a.cpp': 'shared translation unit\n',
  'runtime/local-whisper/launcher/src/b.cpp': 'linux translation unit\n',
  'runtime/local-whisper/launcher/src/windows.cpp': 'windows translation unit\n',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourcePathForArchiveEntry(archiveEntry) {
  const normalized = archiveEntry.replace(/\\/gu, '/');
  const matches = Object.keys(workspaceSources).filter(
    (sourcePath) => normalized === sourcePath || normalized.endsWith(`/${sourcePath}`),
  );
  assert.equal(matches.length, 1);
  return matches[0];
}

function fixtureDigests(databaseOverrides = {}) {
  return {
    databaseSha256: (archiveEntry) => {
      const sourcePath = sourcePathForArchiveEntry(archiveEntry);
      return sha256(databaseOverrides[archiveEntry] ?? workspaceSources[sourcePath]);
    },
    workspaceSha256: (sourcePath) => sha256(workspaceSources[sourcePath]),
  };
}

describe('CodeQL database source coverage', () => {
  it('requires every manifest translation unit in the finalized database source archive', () => {
    assert.doesNotThrow(() =>
      assertCodeqlDatabaseSourceCoverage(
        manifest,
        'linux',
        [
          'source-root/runtime/local-whisper/common/src/a.cpp',
          'source-root/runtime/local-whisper/launcher/src/b.cpp',
          'source-root/runtime/local-whisper/common/include/a.hpp',
        ],
        fixtureDigests(),
      ),
    );
  });

  it('requires only host-applicable translation units', () => {
    assert.doesNotThrow(() =>
      assertCodeqlDatabaseSourceCoverage(
        manifest,
        'windows',
        ['runtime/local-whisper/common/src/a.cpp', 'runtime/local-whisper/launcher/src/windows.cpp'],
        fixtureDigests(),
      ),
    );
  });

  it('rejects a database source archive that omits one compiled translation unit', () => {
    assert.throws(
      () =>
        assertCodeqlDatabaseSourceCoverage(
          manifest,
          'linux',
          ['runtime/local-whisper/common/src/a.cpp'],
          fixtureDigests(),
        ),
      /omitted 1 translation unit/u,
    );
  });

  it('rejects absent and traversal-bearing database source inventories', () => {
    assert.throws(
      () => assertCodeqlDatabaseSourceCoverage(manifest, 'linux', [], fixtureDigests()),
      /inventory is unavailable/u,
    );
    assert.throws(
      () =>
        assertCodeqlDatabaseSourceCoverage(
          manifest,
          'linux',
          ['runtime/local-whisper/common/src/a.cpp', '../runtime/local-whisper/launcher/src/b.cpp'],
          fixtureDigests(),
        ),
      /inventory is malformed/u,
    );
  });

  it('rejects ambiguous or inconsistent repository prefixes', () => {
    assert.throws(
      () =>
        assertCodeqlDatabaseSourceCoverage(
          manifest,
          'linux',
          [
            'first/runtime/local-whisper/common/src/a.cpp',
            'second/runtime/local-whisper/common/src/a.cpp',
            'first/runtime/local-whisper/launcher/src/b.cpp',
          ],
          fixtureDigests(),
        ),
      /omitted 1 translation unit/u,
    );
    assert.throws(
      () =>
        assertCodeqlDatabaseSourceCoverage(
          manifest,
          'linux',
          ['first/runtime/local-whisper/common/src/a.cpp', 'second/runtime/local-whisper/launcher/src/b.cpp'],
          fixtureDigests(),
        ),
      /source prefix is inconsistent/u,
    );
  });

  it('rejects a finalized database whose archived translation-unit content is stale', () => {
    const archiveEntry = 'source-root/runtime/local-whisper/common/src/a.cpp';
    assert.throws(
      () =>
        assertCodeqlDatabaseSourceCoverage(
          manifest,
          'windows',
          [archiveEntry, 'source-root/runtime/local-whisper/launcher/src/windows.cpp'],
          fixtureDigests({ [archiveEntry]: 'stale translation unit\n' }),
        ),
      /has 1 stale translation unit/u,
    );
  });

  it('hashes only the matched archive entry and binds it to the workspace file', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-codeql-source-'));
    try {
      const workspaceRoot = path.join(temporaryRoot, 'workspace');
      const archiveRoot = path.join(temporaryRoot, 'archive');
      const databaseRoot = path.join(temporaryRoot, 'database');
      const sourcePath = 'runtime/local-whisper/common/src/a.cpp';
      const workspaceFile = path.join(workspaceRoot, ...sourcePath.split('/'));
      const archiveFile = path.join(archiveRoot, 'source-root', ...sourcePath.split('/'));
      mkdirSync(path.dirname(workspaceFile), { recursive: true });
      mkdirSync(path.dirname(archiveFile), { recursive: true });
      mkdirSync(databaseRoot, { recursive: true });
      writeFileSync(workspaceFile, 'current translation unit\n', 'utf8');
      writeFileSync(archiveFile, 'current translation unit\n', 'utf8');
      const packed = spawnSync('tar', ['-cf', path.join(databaseRoot, 'src.zip'), 'source-root'], {
        cwd: archiveRoot,
        shell: false,
        windowsHide: true,
      });
      assert.equal(packed.status, 0);

      const inventory = codeqlDatabaseSources(databaseRoot);
      const oneTranslationUnit = manifest.filter((entry) => entry.path === sourcePath);
      const digests = {
        databaseSha256: (archiveEntry) => codeqlDatabaseSourceSha256(inventory, archiveEntry),
        workspaceSha256: (entry) => workspaceSourceSha256(workspaceRoot, entry),
      };
      assert.doesNotThrow(() =>
        assertCodeqlDatabaseSourceCoverage(oneTranslationUnit, 'linux', inventory.entries, digests),
      );

      writeFileSync(workspaceFile, 'newer translation unit\n', 'utf8');
      assert.throws(
        () => assertCodeqlDatabaseSourceCoverage(oneTranslationUnit, 'linux', inventory.entries, digests),
        /has 1 stale translation unit/u,
      );
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });
});
