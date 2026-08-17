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
} from '@scripts/local-whisper/qualification/PerformanceDerivedSourceProducer';
import { PerformanceQualificationOverlayProducer } from '@scripts/local-whisper/qualification/PerformanceQualificationOverlay';
import { LocalWhisperQualificationValidator } from '@scripts/local-whisper/qualification/QualificationContracts';

const execFileAsync = promisify(execFile);
const BASELINE = '1f6ce9c988a275f1ef9faa295b1bb04879943e89';
const CANDIDATE_PARENT = '06b93d695d2b956939df78b519bb669fa70d6e66';
const COMPOSITION = 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts';
const SUPERVISOR = 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts';
const NATIVE_FILES = Object.freeze([
  'runtime/local-whisper/fs-guard/src/common/guard_application.cpp',
  'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
  'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
  'runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp',
  'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
  'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
  'runtime/local-whisper/whisper-cpp/core/main.cpp',
]);

async function repository(root: string, name: string, files: Readonly<Record<string, Buffer>>) {
  const repo = path.join(root, name);
  for (const [relativePath, bytes] of Object.entries(files)) {
    await mkdir(path.join(repo, path.dirname(relativePath)), { recursive: true });
    await writeFile(path.join(repo, relativePath), bytes);
  }
  await execFileAsync('git', ['init', '--quiet', repo]);
  await execFileAsync('git', ['-C', repo, 'config', 'user.email', 'overlay@example.invalid']);
  await execFileAsync('git', ['-C', repo, 'config', 'user.name', 'Overlay Fixture']);
  await execFileAsync('git', ['-C', repo, 'add', '--all']);
  await execFileAsync('git', ['-C', repo, 'commit', '--quiet', '-m', 'overlay fixture']);
  const revision = await execFileAsync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return { root: repo, commit: revision.stdout.trim() };
}

describe('performance qualification reviewed overlay', () => {
  it('produces identical bytes and applies side-specific anchored controls to both exact source shapes', async () => {
    const workspaceRoot = path.resolve('.');
    const first = await new PerformanceQualificationOverlayProducer().produce(workspaceRoot);
    const second = await new PerformanceQualificationOverlayProducer().produce(workspaceRoot);
    assert.equal(second.sha256, first.sha256);
    assert.deepEqual(second.bytes, first.bytes);
    const entries = new UstarPerformanceSourceArchiveAdapter().parse(first.bytes);
    assert.equal(
      entries.some(({ relativePath }) => relativePath === '.local-whisper-performance-overlay-v3.json'),
      true,
    );

    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-overlay-pair-'));
    try {
      const baselineFiles = Object.fromEntries(
        await Promise.all(
        [COMPOSITION, SUPERVISOR, ...NATIVE_FILES].map(async (relativePath) => {
            const source = await execFileAsync('git', ['show', `${BASELINE}:${relativePath}`], {
              cwd: workspaceRoot,
              encoding: 'buffer',
              maxBuffer: 4 * 1024 * 1024,
            });
            return [relativePath, source.stdout] as const;
          }),
        ),
      );
      const candidateFiles = Object.fromEntries(
        await Promise.all(
        [COMPOSITION, SUPERVISOR, ...NATIVE_FILES].map(async (relativePath) => {
            const source = await execFileAsync('git', ['show', `${CANDIDATE_PARENT}:${relativePath}`], {
              cwd: workspaceRoot,
              encoding: 'buffer',
              maxBuffer: 4 * 1024 * 1024,
            });
            return [relativePath, source.stdout] as const;
          }),
        ),
      );
      const before = await repository(root, 'before', baselineFiles);
      const after = await repository(root, 'after', candidateFiles);
      const producer = new PerformanceDerivedSourceProducer(
        new LocalWhisperQualificationValidator(path.join(workspaceRoot, 'docs/specs/local-whisper/qualification')),
        {
          git: new GitPerformanceDerivedSourceAdapter('git'),
          archive: new UstarPerformanceSourceArchiveAdapter(),
          filesystem: new NodePerformanceDerivedSourceFilesystemAdapter(),
          digest: new NodePerformanceDigestAdapter(),
        },
        first,
      );
      const beforeAuthority = await producer.derive({
        privateRoot: root,
        parentRoot: before.root,
        parentCommit: before.commit,
        destinationName: 'derived-before',
        sourceProofDigest: '1'.repeat(64),
        side: 'before',
      });
      const afterAuthority = await producer.derive({
        privateRoot: root,
        parentRoot: after.root,
        parentCommit: after.commit,
        destinationName: 'derived-after',
        sourceProofDigest: '1'.repeat(64),
        side: 'after',
      });
      const afterSource = await readFile(path.join(afterAuthority.rootPath, COMPOSITION), 'utf8');
      assert.match(afterSource, /qualificationHooks\.onArtifactOperationCompleted/u);
      assert.match(afterSource, /qualificationHooks\.onArtifactInstallationStage/u);
      assert.match(afterSource, /publishQualificationStage\('coordinatorPreflightStarted'\)/u);
      assert.match(afterSource, /publishQualificationStage\('coordinatorPreflightCompleted'\)/u);
      const afterSupervisor = await readFile(path.join(afterAuthority.rootPath, SUPERVISOR), 'utf8');
      assert.match(afterSupervisor, /publishQualificationStage\('supervisorHandshakeTimedOut'\)/u);
      assert.match(afterSupervisor, /publishQualificationStage\('supervisorCleanupCompleted'\)/u);
      const afterModelLaunch = await readFile(
        path.join(
          afterAuthority.rootPath,
          'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
        ),
        'utf8',
      );
      assert.match(afterModelLaunch, /kPerformanceQualificationProbeSourceDescriptor/u);
      assert.match(afterModelLaunch, /"stage", "modelLauncherExecRequested"/u);
      const afterLauncher = await readFile(
        path.join(afterAuthority.rootPath, 'runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp'),
        'utf8',
      );
      assert.match(afterLauncher, /"stage", "launcherEntered"/u);
      assert.match(afterLauncher, /"stage", "workerExecRequested"/u);
      const afterWorkerMain = await readFile(
        path.join(afterAuthority.rootPath, 'runtime/local-whisper/whisper-cpp/core/main.cpp'),
        'utf8',
      );
      assert.match(afterWorkerMain, /"stage", "workerEntered"/u);
      const executable = 'scripts/local-whisper/qualification/PerformanceQualificationAttemptRunner.ts';
      const beforeReceipt = await producer.bindExecutable(beforeAuthority, executable);
      const afterReceipt = await producer.bindExecutable(afterAuthority, executable);
      assert.equal(beforeReceipt.instrumentationOverlaySha256, afterReceipt.instrumentationOverlaySha256);
      assert.equal(beforeReceipt.instrumentationOverlaySha256, first.sha256);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects a deliberate source-anchor mismatch before creating a derived tree', async () => {
    const workspaceRoot = path.resolve('.');
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-overlay-mismatch-'));
    try {
      const changed = await repository(root, 'changed', {
        [COMPOSITION]: Buffer.from('export const changed = true;\n'),
      });
      const overlay = await new PerformanceQualificationOverlayProducer().produce(workspaceRoot);
      const producer = new PerformanceDerivedSourceProducer(
        new LocalWhisperQualificationValidator(path.join(workspaceRoot, 'docs/specs/local-whisper/qualification')),
        {
          git: new GitPerformanceDerivedSourceAdapter('git'),
          archive: new UstarPerformanceSourceArchiveAdapter(),
          filesystem: new NodePerformanceDerivedSourceFilesystemAdapter(),
          digest: new NodePerformanceDigestAdapter(),
        },
        overlay,
      );
      await assert.rejects(
        producer.derive({
          privateRoot: root,
          parentRoot: changed.root,
          parentCommit: changed.commit,
          destinationName: 'derived',
          sourceProofDigest: '2'.repeat(64),
          side: 'after',
        }),
        /SOURCE_OVERLAY_ANCHOR_MISMATCH/u,
      );
      await assert.rejects(readFile(path.join(root, 'derived', COMPOSITION)));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
