import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import {
  GitPerformanceDerivedSourceAdapter,
  NodePerformanceDerivedSourceFilesystemAdapter,
  NodePerformanceDigestAdapter,
  PerformanceDerivedSourceProducer,
  UstarPerformanceSourceArchiveAdapter,
  type PerformanceArchiveEntry,
  type PerformanceDerivedSourceFilesystemPort,
  type PerformanceDerivedSourceGitPort,
  type PerformanceSourceArchivePort,
} from '@scripts/local-whisper/qualification/PerformanceDerivedSourceProducer';
import { LocalWhisperQualificationValidator } from '@scripts/local-whisper/qualification/QualificationContracts';

const execFileAsync = promisify(execFile);
const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);
const digest = new NodePerformanceDigestAdapter();

async function createRepository(
  root: string,
  name: string,
  files: Readonly<Record<string, string>>,
): Promise<{
  readonly root: string;
  readonly commit: string;
}> {
  const repository = path.join(root, name);
  await execFileAsync('git', ['init', '--quiet', repository]);
  await execFileAsync('git', ['-C', repository, 'config', 'user.email', 'qualification@example.invalid']);
  await execFileAsync('git', ['-C', repository, 'config', 'user.name', 'Qualification Fixture']);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(repository, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  await execFileAsync('git', ['-C', repository, 'add', '--all']);
  await execFileAsync('git', ['-C', repository, 'commit', '--quiet', '-m', `${name} fixture`]);
  const revision = await execFileAsync('git', ['-C', repository, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return Object.freeze({ root: repository, commit: revision.stdout.trim() });
}

function entry(
  relativePath: string,
  type: PerformanceArchiveEntry['type'] = 'file',
  content = 'content',
): PerformanceArchiveEntry {
  return Object.freeze({
    relativePath,
    type,
    mode: type === 'directory' ? 0o755 : 0o644,
    bytes: type === 'directory' ? Buffer.alloc(0) : Buffer.from(content),
  });
}

class FixtureGit implements PerformanceDerivedSourceGitPort {
  public inspections = 0;
  public dirtyAfterFirstInspection = false;

  public constructor(private readonly commit: string) {}

  public async inspect() {
    this.inspections += 1;
    return Object.freeze({
      headCommit: this.commit,
      clean: !(this.dirtyAfterFirstInspection && this.inspections > 1),
    });
  }

  public async exportTrackedArchive(): Promise<Buffer> {
    return Buffer.from('base');
  }
}

class FixtureArchive implements PerformanceSourceArchivePort {
  public constructor(
    private readonly baseEntries: readonly PerformanceArchiveEntry[],
    private readonly overlayEntries: readonly PerformanceArchiveEntry[] = [entry('instrumentation.txt')],
  ) {}

  public parse(archive: Buffer): readonly PerformanceArchiveEntry[] {
    return archive.toString('utf8') === 'overlay' ? this.overlayEntries : this.baseEntries;
  }
}

class FailOnceFilesystem implements PerformanceDerivedSourceFilesystemPort {
  public removedTrees = 0;
  private fail = true;

  public constructor(private readonly delegate: PerformanceDerivedSourceFilesystemPort) {}

  public async authenticatePrivateRoot(privateRoot: string): Promise<string> {
    return await this.delegate.authenticatePrivateRoot(privateRoot);
  }

  public async createTreeExclusive(treeRoot: string): Promise<void> {
    await this.delegate.createTreeExclusive(treeRoot);
  }

  public async writeDirectory(treeRoot: string, relativePath: string, mode: number): Promise<void> {
    await this.delegate.writeDirectory(treeRoot, relativePath, mode);
  }

  public async writeFile(
    treeRoot: string,
    relativePath: string,
    bytes: Buffer,
    mode: number,
    replace: boolean,
  ): Promise<void> {
    if (this.fail) {
      this.fail = false;
      throw new Error('fixture write failure');
    }
    await this.delegate.writeFile(treeRoot, relativePath, bytes, mode, replace);
  }

  public async readRegularFile(treeRoot: string, relativePath: string, maximumBytes: number): Promise<Buffer> {
    return await this.delegate.readRegularFile(treeRoot, relativePath, maximumBytes);
  }

  public async removeCreatedTree(treeRoot: string): Promise<void> {
    this.removedTrees += 1;
    await this.delegate.removeCreatedTree(treeRoot);
  }
}

function fixtureProducer(input: {
  readonly git: PerformanceDerivedSourceGitPort;
  readonly archive: PerformanceSourceArchivePort;
  readonly filesystem?: PerformanceDerivedSourceFilesystemPort;
}): PerformanceDerivedSourceProducer {
  const overlay = Buffer.from('overlay');
  return new PerformanceDerivedSourceProducer(
    validator,
    {
      git: input.git,
      archive: input.archive,
      filesystem: input.filesystem ?? new NodePerformanceDerivedSourceFilesystemAdapter(),
      digest,
    },
    { bytes: overlay, sha256: digest.sha256(overlay) },
  );
}

describe('PerformanceDerivedSourceProducer', () => {
  it('exports two clean exact parents through one identical overlay and binds path-free executable receipts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-'));
    try {
      const before = await createRepository(root, 'parent-before', {
        'src/app.bin': 'before-parent',
        'src/shared.txt': 'shared',
      });
      const after = await createRepository(root, 'parent-after', {
        'src/app.bin': 'after-parent',
        'src/shared.txt': 'shared',
      });
      const overlay = await createRepository(root, 'overlay', {
        'src/app.bin': 'instrumented-app',
        'src/instrumentation.txt': 'qualification-only',
      });
      const git = new GitPerformanceDerivedSourceAdapter('git');
      const overlayArchive = await git.exportTrackedArchive(overlay.root, overlay.commit);
      const producer = new PerformanceDerivedSourceProducer(
        validator,
        {
          git,
          archive: new UstarPerformanceSourceArchiveAdapter(),
          filesystem: new NodePerformanceDerivedSourceFilesystemAdapter(),
          digest,
        },
        { bytes: overlayArchive, sha256: digest.sha256(overlayArchive) },
      );
      const sourceProofDigest = 'a'.repeat(64);
      const beforeAuthority = await producer.derive({
        privateRoot: root,
        parentRoot: before.root,
        parentCommit: before.commit,
        destinationName: 'derived-before',
        sourceProofDigest,
        side: 'before',
      });
      const afterAuthority = await producer.derive({
        privateRoot: root,
        parentRoot: after.root,
        parentCommit: after.commit,
        destinationName: 'derived-after',
        sourceProofDigest,
        side: 'after',
      });
      const beforeBinding = producer.bindExecutable(beforeAuthority, 'src/app.bin');
      const duplicateBinding = producer.bindExecutable(beforeAuthority, 'src/app.bin');
      const [beforeReceipt] = await Promise.all([
        beforeBinding,
        assert.rejects(duplicateBinding, /AUTHORITY_INVALID/u),
      ]);
      const afterReceipt = await producer.bindExecutable(afterAuthority, 'src/app.bin');
      assert.equal(await readFile(path.join(root, 'derived-before/src/app.bin'), 'utf8'), 'instrumented-app');
      assert.equal(beforeReceipt.parentCommit, before.commit);
      assert.equal(afterReceipt.parentCommit, after.commit);
      assert.equal(beforeReceipt.instrumentationOverlaySha256, afterReceipt.instrumentationOverlaySha256);
      assert.match(beforeReceipt.derivedTreeManifestSha256, /^[a-f0-9]{64}$/u);
      assert.match(afterReceipt.derivedTreeManifestSha256, /^[a-f0-9]{64}$/u);
      assert.doesNotMatch(JSON.stringify([beforeReceipt, afterReceipt]), /parent-before|derived-before|src\/app/u);
      await assert.rejects(producer.bindExecutable(beforeAuthority, 'src/app.bin'), /AUTHORITY_INVALID/u);
      for (const parent of [before, after]) {
        const status = await execFileAsync('git', ['-C', parent.root, 'status', '--porcelain=v1']);
        assert.equal(status.stdout, '');
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects traversal, absolute paths, links, duplicates, case collisions, and entry-count overflow', async () => {
    const unsafeSets: readonly (readonly PerformanceArchiveEntry[])[] = [
      [entry('../escape')],
      [entry('/absolute')],
      [entry('link', 'symbolicLink')],
      [entry('duplicate'), entry('duplicate')],
      [entry('App.cpp'), entry('app.cpp')],
      Object.freeze(Array.from({ length: 32_769 }, (_, index) => entry(`directory-${index}`, 'directory'))),
    ];
    for (const [index, entries] of unsafeSets.entries()) {
      const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-invalid-'));
      try {
        const commit = 'b'.repeat(40);
        const producer = fixtureProducer({ git: new FixtureGit(commit), archive: new FixtureArchive(entries) });
        await assert.rejects(
          producer.derive({
            privateRoot: root,
            parentRoot: path.join(root, 'parent'),
            parentCommit: commit,
            destinationName: `derived-${index}`,
            sourceProofDigest: 'c'.repeat(64),
            side: 'before',
          }),
          /SOURCE_ARCHIVE_/u,
        );
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    }
  });

  it('removes a failed partial tree, grants no authority, and permits a clean retry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-retry-'));
    try {
      const commit = 'd'.repeat(40);
      const filesystem = new FailOnceFilesystem(new NodePerformanceDerivedSourceFilesystemAdapter());
      const producer = fixtureProducer({
        git: new FixtureGit(commit),
        archive: new FixtureArchive([entry('app.bin', 'file', 'parent')], [entry('app.bin', 'file', 'overlay')]),
        filesystem,
      });
      const input = {
        privateRoot: root,
        parentRoot: path.join(root, 'parent'),
        parentCommit: commit,
        destinationName: 'derived',
        sourceProofDigest: 'e'.repeat(64),
        side: 'before' as const,
      };
      await assert.rejects(producer.derive(input), /SOURCE_DERIVATION_FAILED/u);
      assert.equal(filesystem.removedTrees, 1);
      const authority = await producer.derive(input);
      const receipt = await producer.bindExecutable(authority, 'app.bin');
      assert.equal(receipt.executableArtifactIdentity.sha256, digest.sha256(Buffer.from('overlay')));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('applies only the selected side of one reviewed transform manifest and rejects source-anchor drift', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-overlay-'));
    try {
      const commit = '6'.repeat(40);
      const baseBytes = Buffer.from('const productionWindow = 1;\n', 'utf8');
      const manifest = Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          operations: [
            {
              side: 'before',
              targetPath: 'src/pipeline.ts',
              expectedSha256: digest.sha256(baseBytes),
              replacements: [
                {
                  anchor: 'const productionWindow = 1;',
                  replacement: 'const productionWindow = qualificationWindow ?? 1;',
                },
              ],
            },
            {
              side: 'after',
              targetPath: 'src/pipeline.ts',
              expectedSha256: 'f'.repeat(64),
              replacements: [{ anchor: 'never', replacement: 'selected-only-after' }],
            },
          ],
        }),
      );
      const producer = fixtureProducer({
        git: new FixtureGit(commit),
        archive: new FixtureArchive(
          [entry('src/pipeline.ts', 'file', baseBytes.toString('utf8'))],
          [entry('.local-whisper-performance-overlay-v3.json', 'file', manifest.toString('utf8'))],
        ),
      });
      const authority = await producer.derive({
        privateRoot: root,
        parentRoot: path.join(root, 'parent'),
        parentCommit: commit,
        destinationName: 'derived-before',
        sourceProofDigest: '7'.repeat(64),
        side: 'before',
      });
      assert.equal(
        await readFile(path.join(authority.rootPath, 'src/pipeline.ts'), 'utf8'),
        'const productionWindow = qualificationWindow ?? 1;\n',
      );
      await producer.bindExecutable(authority, 'src/pipeline.ts');

      await assert.rejects(
        producer.derive({
          privateRoot: root,
          parentRoot: path.join(root, 'parent'),
          parentCommit: commit,
          destinationName: 'derived-after',
          sourceProofDigest: '7'.repeat(64),
          side: 'after',
        }),
        /SOURCE_OVERLAY_ANCHOR_MISMATCH/u,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('invalidates the derived tree if the parent changes before settlement', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-parent-change-'));
    try {
      const commit = 'f'.repeat(40);
      const git = new FixtureGit(commit);
      git.dirtyAfterFirstInspection = true;
      const producer = fixtureProducer({
        git,
        archive: new FixtureArchive([entry('app.bin')]),
      });
      await assert.rejects(
        producer.derive({
          privateRoot: root,
          parentRoot: path.join(root, 'parent'),
          parentCommit: commit,
          destinationName: 'derived',
          sourceProofDigest: '1'.repeat(64),
          side: 'before',
        }),
        /SOURCE_PARENT_IDENTITY_INVALID/u,
      );
      await assert.rejects(readFile(path.join(root, 'derived/app.bin')));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('cleans and permanently invalidates authority after executable binding fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-binding-'));
    try {
      const commit = '2'.repeat(40);
      const producer = fixtureProducer({
        git: new FixtureGit(commit),
        archive: new FixtureArchive([entry('app.bin')]),
      });
      const authority = await producer.derive({
        privateRoot: root,
        parentRoot: path.join(root, 'parent'),
        parentCommit: commit,
        destinationName: 'derived',
        sourceProofDigest: '3'.repeat(64),
        side: 'after',
      });
      await assert.rejects(producer.bindExecutable(authority, 'missing.bin'), /SOURCE_DERIVED_FILE_INVALID/u);
      await assert.rejects(producer.bindExecutable(authority, 'app.bin'), /AUTHORITY_INVALID/u);
      await assert.rejects(readFile(path.join(root, 'derived/app.bin')));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('honors cancellation before creating any derived tree', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-derived-source-cancel-'));
    try {
      const commit = '4'.repeat(40);
      const producer = fixtureProducer({
        git: new FixtureGit(commit),
        archive: new FixtureArchive([entry('app.bin')]),
      });
      const abort = new AbortController();
      abort.abort();
      await assert.rejects(
        producer.derive({
          privateRoot: root,
          parentRoot: path.join(root, 'parent'),
          parentCommit: commit,
          destinationName: 'derived',
          sourceProofDigest: '5'.repeat(64),
          side: 'before',
          signal: abort.signal,
        }),
        /SOURCE_DERIVATION_CANCELLED/u,
      );
      await assert.rejects(readFile(path.join(root, 'derived/app.bin')));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
