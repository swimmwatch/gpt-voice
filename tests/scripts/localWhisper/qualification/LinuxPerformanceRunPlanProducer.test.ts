import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import type {
  PerformanceDerivedSourceAuthority,
  PerformanceDerivedSourceProducer,
} from '@scripts/local-whisper/qualification/PerformanceDerivedSourceProducer';
import type { LoadedLinuxQualificationEvidence } from '@scripts/local-whisper/qualification/LinuxQualificationEvidenceLoader';
import type { LinuxPerformancePrivateInputProof } from '@scripts/local-whisper/qualification/LinuxPerformancePrivateInputs';
import { LinuxPerformanceRunPlanCommand } from '@scripts/local-whisper/qualification/LinuxPerformanceRunPlanCommand';
import {
  LinuxPerformanceRunPlanProducer,
  type PerformanceAttemptBuildPort,
  type PerformanceRunPlanArtifactCopyInput,
} from '@scripts/local-whisper/qualification/LinuxPerformanceRunPlanProducer';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSelectedModels,
  type PerformancePrivateArtifact,
  type PerformanceSide,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import type { ReviewedPerformanceQualificationOverlay } from '@scripts/local-whisper/qualification/PerformanceQualificationOverlay';
import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
  LocalWhisperQualificationValidator,
} from '@scripts/local-whisper/qualification/QualificationContracts';
import { LocalWhisperQualificationSourceBaselineVerifier } from '@scripts/local-whisper/qualification/QualificationSourceBaseline';

const workspaceRoot = path.resolve('.');
const validator = new LocalWhisperQualificationValidator(
  path.join(workspaceRoot, 'docs/specs/local-whisper/qualification'),
);
const documents = new LocalWhisperPerformanceDocumentProducer(validator);
const overlay: ReviewedPerformanceQualificationOverlay = Object.freeze({
  bytes: Buffer.from('overlay'),
  sha256: 'a'.repeat(64),
  manifestSha256: 'b'.repeat(64),
});
const executableBytes = Buffer.from('attempt-executable');
const executableSha256 = createHash('sha256').update(executableBytes).digest('hex');

function modelSize(family: string, variant: string): number {
  const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    (candidate) => candidate.family === family && candidate.variant === variant,
  );
  if (!model) throw new Error('fixture model missing');
  return model.sizeBytes;
}

function loadedEvidence(root: string): LoadedLinuxQualificationEvidence {
  const models = performanceSelectedModels().map((model) => ({
    ...model,
    filePath: path.join(root, `source-${model.family}-${model.variant}.bin`),
    sizeBytes: modelSize(model.family, model.variant),
  }));
  const runtimes = (['cpu', 'cuda'] as const).map((backend, index) => ({
    application: { backend },
    bundle: { archivePath: path.join(root, `source-runtime-${backend}.tar.gz`) },
    platformArtifact: { sizeBytes: index + 1, sha256: String(index + 1).repeat(64) },
  }));
  return {
    application: {
      models,
      performanceFixtures: [{ filePath: path.join(root, 'source-input.wav'), sizeBytes: 1, sha256: 'f'.repeat(64) }],
    },
    runtimes,
  } as unknown as LoadedLinuxQualificationEvidence;
}

class FixtureDerivation {
  public async derive(input: Readonly<Record<string, unknown>>): Promise<PerformanceDerivedSourceAuthority> {
    const privateRoot = String(input.privateRoot);
    const destinationName = String(input.destinationName);
    const side = input.side as PerformanceSide;
    const authority = Object.freeze({
      rootPath: path.join(privateRoot, destinationName),
      side,
      parentCommit: String(input.parentCommit),
      sourceProofDigest: String(input.sourceProofDigest),
      instrumentationOverlaySha256: overlay.sha256,
      derivedTreeManifestSha256: side === 'before' ? 'c'.repeat(64) : 'd'.repeat(64),
    });
    await mkdir(authority.rootPath, { mode: 0o700 });
    return authority;
  }

  public async bindExecutable(authority: PerformanceDerivedSourceAuthority) {
    return documents.produceDerivedSourceReceipt({
      side: authority.side,
      parentCommit: authority.parentCommit,
      sourceProofDigest: authority.sourceProofDigest,
      instrumentationOverlaySha256: authority.instrumentationOverlaySha256,
      derivedTreeManifestSha256: authority.derivedTreeManifestSha256,
      executableArtifactIdentity: Object.freeze({
        sizeBytes: executableBytes.byteLength,
        sha256: executableSha256,
      }),
    });
  }
}

class FixtureBuilder implements PerformanceAttemptBuildPort {
  public readonly sides: PerformanceSide[] = [];
  public failuresRemaining = 0;
  public createSourceProofConflict = false;
  public abortAfterBuild: AbortController | null = null;

  public async build(input: Parameters<PerformanceAttemptBuildPort['build']>[0]) {
    this.sides.push(input.side);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('fixture build failure');
    }
    const relativePath = 'build/performance-attempt/local-whisper-performance-attempt';
    const executablePath = path.join(input.authority.rootPath, relativePath);
    await mkdir(path.dirname(executablePath), { recursive: true, mode: 0o700 });
    await writeFile(executablePath, executableBytes, { flag: 'wx', mode: 0o500 });
    if (this.createSourceProofConflict && input.side === 'after') {
      const readOnly = path.join(input.authority.rootPath, '..', 'read-only');
      await mkdir(readOnly, { mode: 0o700 });
      await writeFile(path.join(readOnly, 'record'), 'read-only', { mode: 0o400 });
      await chmod(readOnly, 0o500);
      await symlink(path.join(input.authority.rootPath, '..', '..'), path.join(input.authority.rootPath, '..', 'link'));
      await writeFile(path.join(input.authority.rootPath, '..', 'source-proof-v3.json'), 'conflict', {
        flag: 'wx',
        mode: 0o600,
      });
    }
    const runtimeArtifacts = {} as Record<
      'cpu' | 'cuda',
      Readonly<{ readonly relativePath: string; readonly sizeBytes: number; readonly sha256: string }>
    >;
    for (const backend of ['cpu', 'cuda'] as const) {
      const bytes = Buffer.from(`instrumented-${backend}-runtime`);
      const runtimeRelativePath = `build/runtime-${backend}/runtime.tar.gz`;
      await mkdir(path.join(input.authority.rootPath, 'build', `runtime-${backend}`), {
        recursive: true,
        mode: 0o700,
      });
      await writeFile(path.join(input.authority.rootPath, runtimeRelativePath), bytes, { flag: 'wx', mode: 0o600 });
      runtimeArtifacts[backend] = Object.freeze({
        relativePath: runtimeRelativePath,
        sizeBytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    this.abortAfterBuild?.abort();
    return Object.freeze({ executableRelativePath: relativePath, runtimeArtifacts: Object.freeze(runtimeArtifacts) });
  }
}

async function copiedArtifact(input: PerformanceRunPlanArtifactCopyInput): Promise<PerformancePrivateArtifact> {
  await mkdir(path.dirname(input.destinationPath), { recursive: true, mode: 0o700 });
  await writeFile(input.destinationPath, 'private-copy', { flag: 'wx', mode: 0o600 });
  return Object.freeze({ relativePath: '', sizeBytes: input.expectedSizeBytes, sha256: input.expectedSha256 });
}

async function fixture(input?: Readonly<{ readonly builder?: FixtureBuilder; readonly runName?: string }>) {
  const privateParent = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-plan-'));
  await chmod(privateParent, 0o700);
  const baselineWorktree = path.join(privateParent, 'parent-before');
  const candidateWorktree = path.join(privateParent, 'parent-after');
  await Promise.all([mkdir(baselineWorktree, { mode: 0o700 }), mkdir(candidateWorktree, { mode: 0o700 })]);
  const privateRunRoot = path.join(privateParent, input?.runName ?? 'run');
  const builder = input?.builder ?? new FixtureBuilder();
  const producer = new LinuxPerformanceRunPlanProducer(validator, {
    preflight: {
      verify: async (request): Promise<LinuxPerformancePrivateInputProof> =>
        Object.freeze({
          cacheSnapshot: Object.freeze({
            schemaVersion: 1,
            digest: 'e'.repeat(64),
            entryCount: 7,
            fileCount: 6,
            sizeBytes: 5,
          }),
          evidenceIdentityDigest: '9'.repeat(64),
          loaded: loadedEvidence(privateParent),
          privateParent,
          privateRunRoot: request.privateRunRoot,
        }),
    },
    overlay: { produce: async () => overlay },
    sourceBaseline: new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot),
    createDerivation: () => new FixtureDerivation() as unknown as PerformanceDerivedSourceProducer,
    builder,
    copyArtifact: copiedArtifact,
  });
  return Object.freeze({
    privateParent,
    privateRunRoot,
    baselineWorktree,
    candidateWorktree,
    builder,
    producer,
    request: Object.freeze({
      workspaceRoot,
      cacheRoot: path.join(privateParent, 'cache'),
      privateParent,
      privateRunRoot,
      baselineWorktree,
      candidateWorktree,
      candidateCommit: '3'.repeat(40),
      attemptTimeoutMilliseconds: 60_000,
    }),
  });
}

async function missing(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return false;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
  }
}

describe('Linux performance run-plan producer', { skip: process.platform !== 'linux' }, () => {
  it('accepts only the exact path-explicit private producer command', () => {
    const root = path.resolve('/tmp/private-performance-plan');
    const arguments_ = [
      `--candidate-worktree=${root}/candidate`,
      '--candidate-commit=3333333333333333333333333333333333333333',
      `--cache-root=${root}/cache`,
      '--attempt-timeout-milliseconds=60000',
      `--workspace-root=${root}/workspace`,
      `--private-run-root=${root}/private/run`,
      `--baseline-worktree=${root}/baseline`,
      `--private-parent=${root}/private`,
    ];
    const command = LinuxPerformanceRunPlanCommand.parse(arguments_);
    assert.equal(command.candidateCommit, '3'.repeat(40));
    assert.equal(command.attemptTimeoutMilliseconds, 60_000);
    for (const invalid of [
      arguments_.slice(1),
      [...arguments_, '--unknown=value'],
      arguments_.map((value) => (value.startsWith('--cache-root=') ? '--cache-root=relative' : value)),
      arguments_.map((value) => (value.startsWith('--candidate-commit=') ? '--candidate-commit=not-a-commit' : value)),
      arguments_.map((value) =>
        value.startsWith('--attempt-timeout-milliseconds=') ? '--attempt-timeout-milliseconds=999' : value,
      ),
    ]) {
      assert.throws(() => LinuxPerformanceRunPlanCommand.parse(invalid), /PERFORMANCE_PLAN_ARGUMENT_INVALID/u);
    }
  });

  it('writes digest-linked CPU/CUDA plans and receipts exclusively with private modes', async () => {
    const state = await fixture();
    try {
      const result = await state.producer.produce(state.request);
      assert.deepEqual(state.builder.sides, ['before', 'after']);
      assert.equal(result.overlaySha256, overlay.sha256);
      assert.equal(result.overlayManifestSha256, overlay.manifestSha256);
      assert.deepEqual(Object.keys(result.plans), ['cpu', 'cuda']);
      for (const backend of ['cpu', 'cuda'] as const) {
        const plan = result.plans[backend];
        assert.equal(plan.backend, backend);
        assert.equal(plan.sourceProofDigest, LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST);
        assert.equal(plan.qualificationCache.snapshotDigest, 'e'.repeat(64));
        assert.equal(plan.qualificationCache.evidenceIdentityDigest, '9'.repeat(64));
        assert.deepEqual(plan.candidateWindows, [1, 2, 4, 8]);
        assert.equal(plan.models.length * plan.candidateWindows.length * plan.cacheStates.length * 6 * 2, 288);
        assert.equal(plan.derivedSources.before.receipt.instrumentationOverlaySha256, overlay.sha256);
        assert.equal(plan.derivedSources.after.receipt.instrumentationOverlaySha256, overlay.sha256);
      }
      const privateFiles = [
        'source-proof-v3.json',
        'derived-source-before-v3.json',
        'derived-source-after-v3.json',
        'performance-run-plan-linux-cpu-v3.json',
        'performance-run-plan-linux-cuda-v3.json',
        'inputs/performance-input.wav',
      ];
      for (const relativePath of privateFiles) {
        assert.equal((await stat(path.join(state.privateRunRoot, relativePath))).mode & 0o777, 0o600);
      }
      assert.equal((await stat(state.privateRunRoot)).mode & 0o777, 0o700);
      const persisted = JSON.parse(
        await readFile(path.join(state.privateRunRoot, 'performance-run-plan-linux-cpu-v3.json'), 'utf8'),
      ) as Readonly<Record<string, unknown>>;
      assert.equal(persisted.performanceRunPlanDigest, result.plans.cpu.performanceRunPlanDigest);
    } finally {
      await rm(state.privateParent, { force: true, recursive: true });
    }
  });

  it('removes only its failed absent-child output and permits a clean sibling retry', async () => {
    const builder = new FixtureBuilder();
    builder.failuresRemaining = 1;
    const first = await fixture({ builder, runName: 'failed-run' });
    try {
      await assert.rejects(first.producer.produce(first.request), /fixture build failure/u);
      assert.equal(await missing(first.privateRunRoot), true);
      const retryRequest = { ...first.request, privateRunRoot: path.join(first.privateParent, 'retry-run') };
      const result = await first.producer.produce(retryRequest);
      assert.equal(result.plans.cpu.backend, 'cpu');
      assert.equal((await stat(retryRequest.privateRunRoot)).mode & 0o777, 0o700);
    } finally {
      await rm(first.privateParent, { force: true, recursive: true });
    }
  });

  it('rejects cancellation and output conflicts without retaining partial private roots', async () => {
    const cancelled = await fixture({ runName: 'cancelled-run' });
    try {
      const abort = new AbortController();
      abort.abort();
      await assert.rejects(cancelled.producer.produce({ ...cancelled.request, signal: abort.signal }), {
        message: 'PERFORMANCE_PLAN_INPUT_INVALID',
      });
      assert.equal(await missing(cancelled.privateRunRoot), true);
    } finally {
      await rm(cancelled.privateParent, { force: true, recursive: true });
    }

    const builder = new FixtureBuilder();
    builder.createSourceProofConflict = true;
    const conflict = await fixture({ builder, runName: 'conflict-run' });
    try {
      await assert.rejects(conflict.producer.produce(conflict.request), {
        message: 'PERFORMANCE_PLAN_OUTPUT_EXISTS',
      });
      assert.equal(await missing(conflict.privateRunRoot), true);
      assert.equal((await stat(conflict.baselineWorktree)).isDirectory(), true);
    } finally {
      await rm(conflict.privateParent, { force: true, recursive: true });
    }

    const midFlightBuilder = new FixtureBuilder();
    const midFlightAbort = new AbortController();
    midFlightBuilder.abortAfterBuild = midFlightAbort;
    const midFlight = await fixture({ builder: midFlightBuilder, runName: 'mid-flight-cancelled-run' });
    try {
      await assert.rejects(
        midFlight.producer.produce({ ...midFlight.request, signal: midFlightAbort.signal }),
        /PERFORMANCE_PLAN_CANCELLED/u,
      );
      assert.equal(await missing(midFlight.privateRunRoot), true);
    } finally {
      await rm(midFlight.privateParent, { force: true, recursive: true });
    }
  });
});
