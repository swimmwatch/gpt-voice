import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LinuxAlphaSmokeAdapter } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeAdapter';
import {
  createPlatformSmokeInput,
  type AlphaSmokeAttempt,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

function createAttempt(): AlphaSmokeAttempt {
  return {
    schemaVersion: 2,
    monotonicDeadline: null,
    completion: null,
    terminalOutcome: null,
    attemptId: 'alpha-test',
    deadlineEpochMilliseconds: 100_000,
    input: createPlatformSmokeInput(
      'linux',
      [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
      'd'.repeat(64),
    ),
    packageDisposition: 'exact-alpha',
    settingsBackupStatus: 'retained-private',
    startedAtEpochMilliseconds: 1_000,
    state: 'CudaExercise',
  };
}

describe('LinuxAlphaSmokeAdapter', () => {
  it('rejects a transient owned GPU allocation during the CPU checkpoint before unload', async () => {
    const noOperation = async (): Promise<void> => undefined;
    let observations = 0;
    const adapter = new LinuxAlphaSmokeAdapter({
      workRoot: '/unused/work',
      evidenceRoot: '/unused/evidence',
      settingsBackupRoot: '/unused/backup',
      settingsSourceRoot: '/unused/source',
      debPath: '/unused/alpha.deb',
      checkpoints: {
        confirm: async (checkpoint) => {
          if (checkpoint === 'cpu-ui-complete') await new Promise((resolve) => setTimeout(resolve, 1_100));
        },
      },
    });
    Object.defineProperties(adapter, {
      backup: { value: () => ({ verifyRetained: noOperation }) },
      packageVerifier: { value: () => ({ assertRetained: noOperation }) },
      isolatedApplication: { value: () => ({ launchOnline: async () => ({ processId: 123, startTime: '100' }) }) },
      persistOwnedProcesses: { value: noOperation },
      assertRuntime: { value: noOperation },
      applicationProcesses: {
        value: () => ({
          registerApplication: noOperation,
          assertNoOwnedGpuAllocation: async () => {
            observations += 1;
            if (observations === 2) throw new Error('TRANSIENT_OWNED_GPU_ALLOCATION');
          },
        }),
      },
    });
    await assert.rejects(adapter.exerciseCpu(createAttempt()), /TRANSIENT_OWNED_GPU_ALLOCATION/u);
    assert.equal(observations, 2);
  });

  it('revalidates a prepared evidence root containing its private control journal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-prepared-resume-'));
    try {
      for (const directory of ['work', 'evidence/control', 'backup'])
        await mkdir(path.join(root, directory), { recursive: true, mode: 0o700 });
      const adapter = new LinuxAlphaSmokeAdapter({
        workRoot: path.join(root, 'work'),
        evidenceRoot: path.join(root, 'evidence'),
        settingsBackupRoot: path.join(root, 'backup'),
        settingsSourceRoot: path.join(root, 'source'),
        debPath: path.join(root, 'work/release/alpha.deb'),
        checkpoints: { confirm: async () => undefined },
      });
      Object.defineProperties(adapter, {
        backup: { value: () => ({ verifyRetained: async () => undefined }) },
        packageVerifier: { value: () => ({ revalidateBeforeAttempt: async () => undefined }) },
      });
      await adapter.revalidateBeforeAttempt(createAttempt());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const model of [
    { family: 'large', variant: 'full' },
    { family: 'base', variant: 'q5_1' },
  ]) {
    it(`rejects the selected model ${model.family}/${model.variant} instead of base/full`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'alpha-selected-model-'));
      const workRoot = path.join(root, 'work');
      const evidenceRoot = path.join(root, 'evidence');
      const profile = path.join(workRoot, 'profile/config/GPT-Voice/local-whisper');
      try {
        await mkdir(profile, { recursive: true, mode: 0o700 });
        await mkdir(path.join(evidenceRoot, 'control'), { recursive: true, mode: 0o700 });
        const attempt = createAttempt();
        const runtime = {
          workerSha256: 'b'.repeat(64),
          runtimeBuildDigest: 'c'.repeat(64),
          runtimeIdentityKey: 'runtime',
        };
        await writeFile(
          path.join(evidenceRoot, 'control/runtime-bindings.json'),
          JSON.stringify({ inputDigest: attempt.input.platformSmokeInputDigest, runtimes: { 'linux:cpu': runtime } }),
          { mode: 0o600 },
        );
        await writeFile(
          path.join(profile, 'worker-session-ownership.json'),
          JSON.stringify({
            pid: 123,
            processStartIdentity: '100',
            runtimeBuildDigest: runtime.runtimeBuildDigest,
            runtimeIdentityKey: runtime.runtimeIdentityKey,
          }),
          { mode: 0o600 },
        );
        await writeFile(
          path.join(profile, 'settings.json'),
          JSON.stringify({ settings: { execution: { backend: 'cpu' }, model } }),
          { mode: 0o600 },
        );
        const noOperation = async (): Promise<void> => undefined;
        const adapter = new LinuxAlphaSmokeAdapter({
          workRoot,
          evidenceRoot,
          settingsBackupRoot: path.join(root, 'backup'),
          settingsSourceRoot: path.join(root, 'source'),
          debPath: path.join(root, 'alpha.deb'),
          checkpoints: { confirm: noOperation },
        });
        Object.defineProperties(adapter, {
          backup: { value: () => ({ verifyRetained: noOperation }) },
          packageVerifier: { value: () => ({ assertRetained: noOperation }) },
          isolatedApplication: { value: () => ({ launchOnline: async () => ({ processId: 123, startTime: '100' }) }) },
          persistOwnedProcesses: { value: noOperation },
          applicationProcesses: {
            value: () => ({
              registerApplication: noOperation,
              assertNoOwnedGpuAllocation: noOperation,
              assertWorkerRuntime: async () => ({ processId: 123, parentProcessId: 1, startTime: '100' }),
            }),
          },
        });
        await assert.rejects(adapter.exerciseCpu(attempt), /SELECTED_MODEL_INVALID/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  for (const changed of ['models/base/model.bin', 'runtimes/cuda/worker', 'models/base/extra.bin'] as const) {
    it(`rejects offline artifact drift in ${changed}`, async () => {
      const workRoot = await mkdtemp(path.join(tmpdir(), 'alpha-offline-inventory-'));
      const managed = path.join(workRoot, 'profile/data/com.swimmwatch.gptvoice/local-whisper');
      try {
        await mkdir(path.join(managed, 'models/base'), { recursive: true, mode: 0o700 });
        await mkdir(path.join(managed, 'runtimes/cuda'), { recursive: true, mode: 0o700 });
        await writeFile(path.join(managed, 'models/base/model.bin'), 'model', { mode: 0o600 });
        await writeFile(path.join(managed, 'runtimes/cuda/worker'), 'runtime', { mode: 0o700 });
        const adapter = new LinuxAlphaSmokeAdapter({
          workRoot,
          evidenceRoot: path.join(workRoot, 'evidence'),
          settingsBackupRoot: path.join(workRoot, 'backup'),
          settingsSourceRoot: path.join(workRoot, 'source'),
          debPath: path.join(workRoot, 'alpha.deb'),
          checkpoints: {
            confirm: async (checkpoint) => {
              if (checkpoint === 'offline-cuda-ui-complete') await writeFile(path.join(managed, changed), 'changed');
            },
          },
        });
        const noOperation = async (): Promise<void> => undefined;
        // Only the artifact boundary is real here; process/GPU responses are deterministic fixtures.
        Object.defineProperties(adapter, {
          backup: { value: () => ({ verifyRetained: noOperation }) },
          packageVerifier: { value: () => ({ assertRetained: noOperation, assertInstalledEquivalent: noOperation }) },
          applicationProcesses: {
            value: () => ({
              assertNoOwnedGpuAllocation: noOperation,
              assertOwnedProcessesExited: noOperation,
              registerApplication: noOperation,
              assertOfflineNamespace: noOperation,
            }),
          },
          isolatedApplication: { value: () => ({ launchOffline: async () => ({ processId: 123, startTime: '100' }) }) },
          persistOwnedProcesses: { value: noOperation },
          assertNoActivePackageProcess: { value: noOperation },
          assertRuntime: { value: noOperation },
        });
        const attempt: AlphaSmokeAttempt = {
          schemaVersion: 2,
          monotonicDeadline: null,
          completion: null,
          terminalOutcome: null,
          attemptId: 'alpha-test',
          deadlineEpochMilliseconds: 100_000,
          input: createPlatformSmokeInput(
            'linux',
            [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
            'd'.repeat(64),
          ),
          packageDisposition: 'exact-alpha',
          settingsBackupStatus: 'retained-private',
          startedAtEpochMilliseconds: 1_000,
          state: 'CudaExercise',
        };
        await adapter.exerciseCuda(attempt);
        await assert.rejects(adapter.exerciseOfflineCuda(attempt), /OFFLINE_ARTIFACTS_CHANGED/u);
      } finally {
        await rm(workRoot, { recursive: true, force: true });
      }
    });
  }

  it('renders the only privileged package action as a deadline-bound shell-safe manual command', async () => {
    const debPath = "/tmp/alpha work/it's/gpt-voice_2.4.0-alpha.1_amd64.deb";
    const confirmations: unknown[][] = [];
    const adapter = new LinuxAlphaSmokeAdapter({
      checkpoints: {
        confirm: async (...arguments_: unknown[]): Promise<void> => {
          confirmations.push(arguments_);
        },
      },
      debPath,
      evidenceRoot: '/tmp/evidence',
      settingsBackupRoot: '/tmp/backup',
      settingsSourceRoot: '/tmp/source',
      workRoot: '/tmp/work',
    });

    await adapter.requestAlphaInstallation(debPath, 12_345);

    assert.deepEqual(confirmations, [
      [
        'install-alpha-deb',
        "Run this exact command in another terminal, then return here:\n/usr/bin/dpkg --install -- '/tmp/alpha work/it'\\''s/gpt-voice_2.4.0-alpha.1_amd64.deb'",
        12_345,
      ],
    ]);
  });
});
