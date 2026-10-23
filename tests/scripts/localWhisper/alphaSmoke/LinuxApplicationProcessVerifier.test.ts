import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';

import type { LinuxAlphaSmokeCommandPort } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeCommandRunner';
import { LinuxAlphaSmokeCommandExitError } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeCommandExitError';
import { LinuxApplicationProcessVerifier } from '@scripts/local-whisper/alpha-smoke/LinuxApplicationProcessVerifier';

class FakeLinuxCommands implements LinuxAlphaSmokeCommandPort {
  public computeApplications = '';
  public gpuInventory = 'GPU-rtx50, 12.0';

  public constructor(private readonly applicationProcesses: string | Error) {}

  public async run(_executable: string, arguments_: readonly string[]): Promise<string> {
    if (arguments_[0] === '-f') {
      if (this.applicationProcesses instanceof Error) throw this.applicationProcesses;
      return this.applicationProcesses;
    }
    if (arguments_[0] === '--query-compute-apps=gpu_uuid,pid,used_gpu_memory') return this.computeApplications;
    if (arguments_[0] === '--query-gpu=uuid,compute_cap') return this.gpuInventory;
    throw new Error('unexpected-command');
  }

  public async runBytes(): Promise<Buffer> {
    throw new Error('unexpected-command');
  }

  public async runStreaming(): Promise<void> {
    throw new Error('unexpected-command');
  }
}

function processStat(processId: number, parentProcessId: number, startTime: string): string {
  const fields = Array.from({ length: 20 }, (_value, index) => {
    if (index === 0) return 'S';
    if (index === 1) return parentProcessId.toString(10);
    if (index === 19) return startTime;
    return '0';
  });
  return `${processId} (gpt-voice) ${fields.join(' ')}\n`;
}

async function writeProcess(
  procRoot: string,
  processId: number,
  parentProcessId: number,
  startTime: string,
): Promise<void> {
  const processRoot = path.join(procRoot, processId.toString(10));
  await mkdir(processRoot);
  await writeFile(path.join(processRoot, 'stat'), processStat(processId, parentProcessId, startTime), 'utf8');
}

describe('LinuxApplicationProcessVerifier', () => {
  it('binds a worker to its catalog bytes, runtime identity and captured PID start time', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-worker-runtime-'));
    try {
      await writeProcess(procRoot, 101, 1, '1001');
      await writeProcess(procRoot, 102, 101, '1002');
      const image = Buffer.from('verified-worker');
      await writeFile(path.join(procRoot, '102/exe'), image);
      const verifier = new LinuxApplicationProcessVerifier({ commands: new FakeLinuxCommands('101'), procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });
      const record = {
        pid: 102,
        processStartIdentity: '1002',
        runtimeBuildDigest: 'a'.repeat(64),
        runtimeIdentityKey: 'expected-runtime',
      };
      const expected = {
        workerSha256: createHash('sha256').update(image).digest('hex'),
        runtimeBuildDigest: record.runtimeBuildDigest,
        runtimeIdentityKey: record.runtimeIdentityKey,
      };
      assert.equal((await verifier.assertWorkerRuntime(record, expected)).processId, 102);
      for (const change of [
        { runtimeBuildDigest: 'b'.repeat(64) },
        { runtimeIdentityKey: 'different-runtime' },
        { processStartIdentity: 'other' },
      ])
        await assert.rejects(
          verifier.assertWorkerRuntime({ ...record, ...change }, expected),
          /WORKER_RUNTIME_INVALID/u,
        );
      await assert.rejects(
        verifier.assertWorkerRuntime(record, { ...expected, workerSha256: 'b'.repeat(64) }),
        /WORKER_RUNTIME_INVALID/u,
      );
      await writeProcess(procRoot, 103, 1, '1003');
      await assert.rejects(
        verifier.assertWorkerRuntime({ ...record, pid: 103, processStartIdentity: '1003' }, expected),
        /WORKER_RUNTIME_INVALID/u,
      );
    } finally {
      await rm(procRoot, { recursive: true, force: true });
    }
  });

  it('retains orphan ownership and refuses PID reuse as exit proof for the original process', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-orphan-'));
    try {
      await writeProcess(procRoot, 101, 1, '1001');
      await writeProcess(procRoot, 102, 101, '1002');
      const verifier = new LinuxApplicationProcessVerifier({ commands: new FakeLinuxCommands('101'), procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });
      await verifier.captureOwnedWorkers();
      await writeFile(path.join(procRoot, '102/stat'), processStat(102, 1, '1002'));
      await rm(path.join(procRoot, '101'), { recursive: true });
      await assert.rejects(verifier.assertOwnedProcessesExited(), /OWNED_PROCESS_ACTIVE/u);
      await writeFile(path.join(procRoot, '102/stat'), processStat(102, 1, '2002'));
      // A reused PID is not the recorded worker and must not be signalled.
      await verifier.assertOwnedProcessesExited();
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });

  it('rejects allocation on a GPU other than the selected device', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-selected-'));
    try {
      await writeProcess(procRoot, 101, 1, '1001');
      await writeProcess(procRoot, 102, 101, '1002');
      const commands = new FakeLinuxCommands('101');
      commands.gpuInventory = 'GPU-rtx50, 12.0\nGPU-other, 12.0';
      commands.computeApplications = 'GPU-other, 102, 10';
      const verifier = new LinuxApplicationProcessVerifier({ commands, procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });
      await assert.rejects(
        verifier.assertSelectedGpuAllocation('GPU-rtx50', { processId: 102, startTime: '1002' }),
        /CUDA_GPU_ALLOCATION_MISSING/u,
      );
      commands.computeApplications = 'GPU-rtx50, 102, 10';
      await verifier.assertSelectedGpuAllocation('GPU-rtx50', { processId: 102, startTime: '1002' });
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });
  it('accepts PID 1 with parent zero while observing the owned application', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-init-'));
    try {
      await writeProcess(procRoot, 1, 0, '1');
      await writeProcess(procRoot, 101, 1, '1001');
      const verifier = new LinuxApplicationProcessVerifier({ commands: new FakeLinuxCommands('101'), procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });
      await verifier.assertNoOwnedGpuAllocation();
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });
  it('accepts only pgrep exit status 1 as a confirmed absence of the installed application', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-none-'));
    try {
      const absent = new LinuxApplicationProcessVerifier({
        commands: new FakeLinuxCommands(new LinuxAlphaSmokeCommandExitError(1, null)),
        procRoot,
      });
      await absent.assertNoActiveApplicationProcess();

      const unavailable = new LinuxApplicationProcessVerifier({
        commands: new FakeLinuxCommands(new LinuxAlphaSmokeCommandExitError(2, null)),
        procRoot,
      });
      await assert.rejects(unavailable.assertNoActiveApplicationProcess(), /ALPHA_SMOKE_LINUX_COMMAND_EXITED/u);
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });

  it('rejects a CPU exercise when an owned child process has a compute allocation', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-cpu-'));
    try {
      await writeProcess(procRoot, 101, 1, '1001');
      await writeProcess(procRoot, 102, 101, '1002');
      const commands = new FakeLinuxCommands('101');
      commands.computeApplications = 'GPU-rtx50, 102, 8';
      const verifier = new LinuxApplicationProcessVerifier({ commands, procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });

      await assert.rejects(verifier.assertNoOwnedGpuAllocation(), /ALPHA_SMOKE_LINUX_CPU_GPU_ALLOCATION/u);
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });

  it('requires a positive owned allocation on an RTX 50 device for CUDA', async () => {
    const procRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-proc-cuda-'));
    try {
      await writeProcess(procRoot, 101, 1, '1001');
      await writeProcess(procRoot, 102, 101, '1002');
      const commands = new FakeLinuxCommands('101');
      commands.computeApplications = 'GPU-rtx50, 102, 8';
      const verifier = new LinuxApplicationProcessVerifier({ commands, procRoot });
      await verifier.registerApplication({ processId: 101, startTime: '1001' });
      await verifier.assertOwnedRtx50GpuAllocation();

      commands.computeApplications = 'GPU-rtx50, 102, 0';
      await assert.rejects(verifier.assertOwnedRtx50GpuAllocation(), /ALPHA_SMOKE_LINUX_CUDA_GPU_ALLOCATION_MISSING/u);
    } finally {
      await rm(procRoot, { force: true, recursive: true });
    }
  });
});
