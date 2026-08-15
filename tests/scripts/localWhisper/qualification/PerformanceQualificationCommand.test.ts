import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { LocalWhisperQualificationValidator } from '@scripts/local-whisper/qualification/QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSelectedModels,
  type PerformancePrivateArtifact,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import { createHostedPerformanceFixture } from '@scripts/local-whisper/qualification/PerformanceQualificationFixtures';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve('.');
const qualificationRoot = path.join(workspaceRoot, 'docs/specs/local-whisper/qualification');
const aggregateCommand = path.join(
  workspaceRoot,
  'scripts/local-whisper/qualification/run-performance-qualification.ts',
);
const collectCommand = path.join(
  workspaceRoot,
  'scripts/local-whisper/qualification/collect-performance-qualification.ts',
);
const maximumInputBytes = 8 * 1024 * 1024;

function commandArguments(
  commandPath: string,
  root: string,
  input: string,
  output: string,
  mode: 'hostedFixture' | 'representativeHost',
): string[] {
  return [
    '--import',
    'tsx',
    commandPath,
    '--platform=linux',
    '--backend=cpu',
    `--mode=${mode}`,
    `--root=${root}`,
    `--input=${input}`,
    `--output=${output}`,
  ];
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function artifact(root: string, relativePath: string, content: string): Promise<PerformancePrivateArtifact> {
  const bytes = Buffer.from(content, 'utf8');
  await writeFile(path.join(root, relativePath), bytes);
  return Object.freeze({ relativePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function gitWorktree(
  root: string,
  name: string,
): Promise<{
  readonly commit: string;
  readonly application: PerformancePrivateArtifact;
  readonly runtime: PerformancePrivateArtifact;
}> {
  const directory = path.join(root, name);
  await execFileAsync('/usr/bin/git', ['init', '--quiet', directory]);
  await execFileAsync('/usr/bin/git', ['-C', directory, 'config', 'user.email', 'qualification@example.invalid']);
  await execFileAsync('/usr/bin/git', ['-C', directory, 'config', 'user.name', 'Qualification Fixture']);
  const applicationSource = `#!/usr/bin/python3
import json, sys
request = json.loads(sys.stdin.readline())
window = request["candidateWindow"]
side = request["side"]
after = {1: 800, 2: 770, 4: 700, 8: 650}[window]
phases = []
for sequence, phase_id in enumerate(request["requiredPhaseIds"]):
    duration = 100
    if phase_id in ("installationPipeWait", "installationWrite"):
        duration = 1000 if side == "before" else after
    phases.append({"id": phase_id, "sequence": sequence, "durationNanoseconds": duration})
resources = [{"id": resource_id, "peakBytes": 1024} for resource_id in request["requiredResourceIds"]]
result = {"schemaVersion": 2, "status": "success", "failureReason": None, "endToEndNanoseconds": 100000, "phases": phases, "resources": resources}
sys.stdout.write(json.dumps(result, separators=(",", ":")) + "\\n")
`;
  const application = await artifact(root, `${name}/attempt.py`, applicationSource);
  const runtime = await artifact(root, `${name}/runtime.bin`, `${name}-runtime`);
  await chmod(path.join(root, application.relativePath), 0o755);
  await execFileAsync('/usr/bin/git', ['-C', directory, 'add', 'attempt.py', 'runtime.bin']);
  await execFileAsync('/usr/bin/git', ['-C', directory, 'commit', '--quiet', '-m', `${name} fixture`]);
  const revision = await execFileAsync('/usr/bin/git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return Object.freeze({ commit: revision.stdout.trim(), application, runtime });
}

describe('Local Whisper performance qualification commands', () => {
  it('aggregates only a complete schema-v2 bundle inside the validated root and never overwrites', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-command-'));
    try {
      const fixture = createHostedPerformanceFixture(
        new LocalWhisperQualificationValidator(qualificationRoot),
        'linux',
        'cpu',
      );
      await writeFile(path.join(root, 'input.json'), JSON.stringify(fixture.bundle), { encoding: 'utf8', mode: 0o600 });
      const execution = await execFileAsync(
        process.execPath,
        commandArguments(aggregateCommand, root, 'input.json', 'result.json', 'hostedFixture'),
        { cwd: workspaceRoot },
      );
      const summary = JSON.parse(execution.stdout) as Readonly<Record<string, unknown>>;
      const result = JSON.parse(await readFile(path.join(root, 'result.json'), 'utf8')) as Readonly<
        Record<string, unknown>
      >;
      assert.equal(summary.status, 'produced');
      assert.equal(result.selectedInFlightWindow, null);
      assert.equal(result.selectionStatus, 'fixtureOnly');
      await assert.rejects(
        execFileAsync(
          process.execPath,
          commandArguments(aggregateCommand, root, 'input.json', 'result.json', 'hostedFixture'),
          { cwd: workspaceRoot },
        ),
        /PERFORMANCE_QUALIFICATION_FAILED/u,
      );
      await assert.rejects(
        execFileAsync(
          process.execPath,
          commandArguments(aggregateCommand, root, 'input.json', '../escaped.json', 'hostedFixture'),
          { cwd: workspaceRoot },
        ),
      );
      if (process.platform === 'linux') {
        const linkedRoot = `${root}-link`;
        await symlink(root, linkedRoot);
        try {
          await assert.rejects(
            execFileAsync(
              process.execPath,
              commandArguments(aggregateCommand, linkedRoot, 'empty.json', 'result.json', 'hostedFixture'),
              { cwd: workspaceRoot },
            ),
          );
          await symlink(path.join(root, 'empty.json'), path.join(root, 'linked.json'));
          await assert.rejects(
            execFileAsync(
              process.execPath,
              commandArguments(aggregateCommand, root, 'linked.json', 'result.json', 'hostedFixture'),
              { cwd: workspaceRoot },
            ),
          );
        } finally {
          await rm(linkedRoot, { force: true });
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('collects the exact 288-attempt contract-only schedule with clean worktrees', async () => {
    if (process.platform !== 'linux') return;
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-collector-'));
    try {
      const before = await gitWorktree(root, 'before');
      const after = await gitWorktree(root, 'after');
      const sourceProof = await artifact(root, 'source-proof.json', '{"proof":true}\n');
      const inputFixture = await artifact(root, 'input.wav', 'fixture-audio');
      const modelArtifacts = [];
      for (const [index] of performanceSelectedModels().entries()) {
        modelArtifacts.push(await artifact(root, `model-${index}.bin`, `model-${index}`));
      }
      const documents = new LocalWhisperPerformanceDocumentProducer(
        new LocalWhisperQualificationValidator(qualificationRoot),
      );
      const plan = documents.produceRunPlan({
        sourceRevision: '4'.repeat(40),
        sourceProofDigest: sourceProof.sha256,
        platform: 'linux',
        backend: 'cpu',
        executionMode: 'representativeHost',
        evidenceClaim: 'contractOnly',
        baselineCommit: before.commit,
        candidateCommit: after.commit,
        sourceProof,
        worktrees: {
          before: { relativePath: 'before', commit: before.commit },
          after: { relativePath: 'after', commit: after.commit },
        },
        applicationArtifacts: { before: before.application, after: after.application },
        runtimeArtifacts: { before: before.runtime, after: after.runtime },
        models: performanceSelectedModels().map((model, index) => ({
          ...model,
          artifact: modelArtifacts[index]!,
        })),
        inputFixture,
        cachePreparation: {
          procedure: 'linuxFileAdviceV1',
          cold: 'fileAdviceDontNeed',
          warm: 'boundedSequentialRead',
        },
        attemptTimeoutMilliseconds: 5000,
      });
      await writeFile(path.join(root, 'plan.json'), JSON.stringify(plan), { mode: 0o600 });
      const execution = await execFileAsync(
        process.execPath,
        commandArguments(collectCommand, root, 'plan.json', 'bundle.json', 'representativeHost'),
        { cwd: workspaceRoot, maxBuffer: maximumInputBytes },
      );
      const summary = JSON.parse(execution.stdout) as Readonly<Record<string, unknown>>;
      const bundle = JSON.parse(await readFile(path.join(root, 'bundle.json'), 'utf8')) as Readonly<
        Record<string, unknown>
      >;
      assert.equal(summary.status, 'collected');
      assert.equal(summary.attemptCount, 288);
      assert.equal(bundle.evidenceClaim, 'contractOnly');
      assert.equal((bundle.samples as readonly unknown[]).length, 288);
      assert.equal((bundle.cacheReceipts as readonly unknown[]).length, 288);
      for (const worktree of ['before', 'after']) {
        const status = await execFileAsync('/usr/bin/git', [
          '-C',
          path.join(root, worktree),
          'status',
          '--porcelain=v1',
        ]);
        assert.equal(status.stdout, '');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects unknown, repeated, empty, oversized, and root-escaping command inputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-performance-input-bounds-'));
    try {
      await writeFile(path.join(root, 'empty.json'), '');
      await writeFile(path.join(root, 'oversized.json'), Buffer.alloc(maximumInputBytes + 1));
      for (const input of ['empty.json', 'oversized.json']) {
        await assert.rejects(
          execFileAsync(
            process.execPath,
            commandArguments(aggregateCommand, root, input, `${input}.result`, 'hostedFixture'),
            { cwd: workspaceRoot },
          ),
          /PERFORMANCE_QUALIFICATION_FAILED/u,
        );
      }
      const base = commandArguments(aggregateCommand, root, 'empty.json', 'result.json', 'hostedFixture');
      await assert.rejects(execFileAsync(process.execPath, [...base, '--extra=value'], { cwd: workspaceRoot }));
      await assert.rejects(
        execFileAsync(process.execPath, [...base.slice(0, -1), '--input=duplicate.json', '--output=result.json'], {
          cwd: workspaceRoot,
        }),
      );
      await assert.rejects(
        execFileAsync(
          process.execPath,
          commandArguments(aggregateCommand, root, '/absolute.json', 'result.json', 'hostedFixture'),
          { cwd: workspaceRoot },
        ),
      );
      await assert.rejects(
        execFileAsync(
          process.execPath,
          commandArguments(aggregateCommand, path.parse(root).root, 'empty.json', 'result.json', 'hostedFixture'),
          { cwd: workspaceRoot },
        ),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
